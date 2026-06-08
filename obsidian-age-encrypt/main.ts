import {
    Editor,
    MarkdownView,
    Notice,
    Plugin,
    TFile
} from 'obsidian';

import { EncryptionService } from './src/services/encryption';
import { PasswordManager } from './src/services/password-manager';
import { DecryptCache } from './src/services/decrypt-cache';
import { AgeEncryptSettings, DEFAULT_SETTINGS } from './src/settings';
import { AgeEncryptSettingTab } from './src/ui/SettingsTab';
import { PasswordModal } from './src/ui/PasswordModal';
import { EditModal } from './src/ui/EditModal';
import { ReadingViewProcessor } from './src/processors/reading-view';
import { SourceModeExtension } from './src/processors/cm6-extension';

export default class AgeEncryptPlugin extends Plugin {
    settings: AgeEncryptSettings;
    encryptionService: EncryptionService;
    passwordManager: PasswordManager;
    decryptCache: DecryptCache;
    readingViewProcessor: ReadingViewProcessor;
    cm6Extension: SourceModeExtension;

    async onload(): Promise<void> {
        await this.loadSettings();

        this.passwordManager = new PasswordManager();
        this.decryptCache = new DecryptCache();
        this.encryptionService = new EncryptionService();

        // 恢复持久化的密码
        if (this.settings.savePassword && this.settings.savedPassword) {
            this.passwordManager.setPassword(this.settings.savedPassword);
        }

        // 自动加载密钥（如果有配置）
        if (this.settings.encryptionMode === 'key' && this.settings.recipientKey) {
            // 密钥模式：私钥需要在设置页面手动加载
            // 仅公钥持久化，私钥保持内存加载
        }

        this.addSettingTab(new AgeEncryptSettingTab(this.app, this));

        // 注册 Reading View 处理器
        this.readingViewProcessor = new ReadingViewProcessor(
            this.app,
            this.encryptionService,
            this.passwordManager,
            this.decryptCache,
            this
        );
        this.readingViewProcessor.register();

        // 注册 CM6 Source Mode 扩展
        this.cm6Extension = new SourceModeExtension(
            this.app,
            this.encryptionService,
            this.passwordManager,
            this.decryptCache,
            this
        );
        this.registerEditorExtension(this.cm6Extension.createExtension());

        // ── 命令注册 ──

        this.addCommand({
            id: 'set-password',
            name: '设置主密码',
            callback: async () => {
                const modal = new PasswordModal(this.app);
                const password = await modal.openAndGetPassword();
                if (password) {
                    this.passwordManager.setPassword(password);
                    // 如果启用了持久化，同步保存
                    if (this.settings.savePassword) {
                        this.settings.savedPassword = password;
                        await this.saveSettings();
                    }
                    new Notice('主密码已设置');
                }
            }
        });

        this.addCommand({
            id: 'encrypt-section',
            name: '加密选中段落',
            editorCallback: async (editor: Editor, _view: MarkdownView) => {
                const selection = editor.getSelection();
                if (!selection) {
                    new Notice('请先选中要加密的文本');
                    return;
                }

                // 获取加密凭据
                const password = this.passwordManager.getPassword();
                const recipient = (this.settings.encryptionMode === 'key')
                    ? this.settings.recipientKey
                    : undefined;

                if (!password && !recipient) {
                    new Notice('请先在设置页面配置密码或密钥');
                    return;
                }

                try {
                    const encrypted = await this.encryptionService.encrypt(selection, {
                        password: password || undefined,
                        recipient
                    });
                    const formattedBlock = this.encryptionService.formatEncryptedBlock(encrypted);

                    const endOfSelection = editor.posToOffset(editor.getCursor('to'));
                    const endOfFile = editor.getValue().length;
                    let finalBlock = formattedBlock;
                    if (endOfSelection === endOfFile) {
                        finalBlock += '\n';
                    }

                    editor.replaceSelection(finalBlock);
                    new Notice('段落已加密');
                } catch (error) {
                    new Notice('加密失败');
                }
            }
        });

        this.addCommand({
            id: 'encrypt-file',
            name: '加密整个文件',
            callback: async () => {
                const activeFile = this.app.workspace.getActiveFile();
                if (!activeFile) {
                    new Notice('没有打开的文件');
                    return;
                }

                const password = this.passwordManager.getPassword();
                const recipient = (this.settings.encryptionMode === 'key')
                    ? this.settings.recipientKey
                    : undefined;

                if (!password && !recipient) {
                    new Notice('请先在设置页面配置密码或密钥');
                    return;
                }

                try {
                    const fileContent = await this.app.vault.read(activeFile);
                    let contentToEncrypt = fileContent.trimEnd();
                    let frontmatter = '';

                    if (this.settings.excludeFrontmatter) {
                        const frontmatterRegex = /^---\n([\s\S]*?)\n---\n/;
                        const match = fileContent.match(frontmatterRegex);
                        if (match) {
                            frontmatter = match[0];
                            contentToEncrypt = fileContent.substring(frontmatter.length).trimEnd();
                        }
                    }

                    const encrypted = await this.encryptionService.encrypt(contentToEncrypt, {
                        password: password || undefined,
                        recipient
                    });
                    const formattedBlock = this.encryptionService.formatEncryptedBlock(encrypted);

                    let finalContent = frontmatter + formattedBlock;
                    if (contentToEncrypt.length > 0 && !contentToEncrypt.endsWith('\n')) {
                        finalContent += '\n';
                    }

                    await this.app.vault.modify(activeFile, finalContent);
                    new Notice('文件已加密');
                } catch (error) {
                    new Notice('加密失败');
                }
            }
        });

        this.addCommand({
            id: 'edit-encrypted',
            name: '编辑加密块',
            editorCallback: async (editor: Editor, _view: MarkdownView) => {
                const password = this.passwordManager.getPassword();
                const identity = this.passwordManager.getIdentity();

                if (!password && !identity) {
                    new Notice('请先在设置页面配置密码或密钥');
                    return;
                }

                const doc = editor.getValue();
                const cursor = editor.getCursor();
                const offset = editor.posToOffset(cursor);
                const lines = doc.split('\n');

                // 查找光标所在的 ```age 块
                let blockStart = -1;
                let blockEnd = -1;
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].trimStart().startsWith('```age')) {
                        blockStart = i;
                        for (let j = i + 1; j < lines.length; j++) {
                            if (lines[j].trimStart() === '```') {
                                blockEnd = j;
                                break;
                            }
                        }
                        if (blockEnd !== -1) {
                            const blockStartOffset = lines.slice(0, blockStart).join('\n').length + (blockStart > 0 ? 1 : 0);
                            const blockEndOffset = lines.slice(0, blockEnd + 1).join('\n').length;
                            if (offset >= blockStartOffset && offset <= blockEndOffset) {
                                break;
                            }
                        }
                        blockStart = -1;
                        blockEnd = -1;
                    }
                }

                if (blockStart === -1 || blockEnd === -1) {
                    new Notice('光标附近未找到加密块');
                    return;
                }

                const blockLines = lines.slice(blockStart, blockEnd + 1);
                const blockSource = blockLines.join('\n');

                try {
                    const { content, hint } = this.encryptionService.parseEncryptedBlock(blockSource);
                    const decrypted = await this.encryptionService.decrypt(
                        content,
                        password || undefined,
                        identity || undefined
                    );

                    const modal = new EditModal(this.app, decrypted, hint);
                    const result = await modal.openAndGetResult();
                    if (!result) return;

                    const password2 = this.passwordManager.getPassword();
                    const recipient2 = (this.settings.encryptionMode === 'key')
                        ? this.settings.recipientKey
                        : undefined;

                    if (result.action === 'save-encrypted') {
                        const encrypted = await this.encryptionService.encrypt(result.text, {
                            password: password2 || undefined,
                            recipient: recipient2
                        });
                        const newBlock = this.encryptionService.formatEncryptedBlock(encrypted, hint);
                        const newLines = doc.split('\n');
                        newLines.splice(blockStart, blockEnd - blockStart + 1, newBlock);
                        editor.setValue(newLines.join('\n'));
                        new Notice('内容已重新加密');
                    } else if (result.action === 'save-plaintext') {
                        const newLines = doc.split('\n');
                        newLines.splice(blockStart, blockEnd - blockStart + 1, result.text);
                        editor.setValue(newLines.join('\n'));
                        new Notice('已保存为纯文本');
                    }
                } catch (error) {
                    new Notice('解密失败');
                }
            }
        });

        // ── 密码变更事件响应 ──
        this.passwordManager.on('changed', () => {
            this.decryptCache.clear();
            this.readingViewProcessor.rerenderAll();
            this.cm6Extension.invalidateDecryptions();

            // 同步保存密码
            if (this.settings.savePassword) {
                const pw = this.passwordManager.getPassword();
                this.settings.savedPassword = pw || undefined;
                this.saveSettings();
            }
        });

        this.passwordManager.on('cleared', () => {
            this.decryptCache.clear();
            this.readingViewProcessor.rerenderAll();
            this.cm6Extension.invalidateDecryptions();

            // 同步清除持久化密码
            if (this.settings.savePassword) {
                this.settings.savedPassword = undefined;
                this.saveSettings();
            }
        });
    }

    async loadSettings(): Promise<void> {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
    }

    onunload(): void {
        this.passwordManager.removeAllListeners();
        this.passwordManager.clearAll();
        this.decryptCache.clear();
    }
}
