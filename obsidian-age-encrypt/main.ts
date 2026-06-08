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

        this.addSettingTab(new AgeEncryptSettingTab(this.app, this));

        // Register Reading View processor
        this.readingViewProcessor = new ReadingViewProcessor(
            this.app,
            this.encryptionService,
            this.passwordManager,
            this.decryptCache,
            this
        );
        this.readingViewProcessor.register();

        // Register CM6 extension for Source Mode
        this.cm6Extension = new SourceModeExtension(
            this.app,
            this.encryptionService,
            this.passwordManager,
            this.decryptCache,
            this
        );
        this.registerEditorExtension(this.cm6Extension.createExtension());

        // Register commands
        this.addCommand({
            id: 'set-password',
            name: 'Set master password',
            callback: async () => {
                const modal = new PasswordModal(this.app);
                const password = await modal.openAndGetPassword();
                if (password) {
                    this.passwordManager.setPassword(password);
                    new Notice('Master password set');
                }
            }
        });

        this.addCommand({
            id: 'encrypt-section',
            name: 'Encrypt selection',
            editorCallback: async (editor: Editor, _view: MarkdownView) => {
                const selection = editor.getSelection();
                if (!selection) {
                    new Notice('No text selected');
                    return;
                }

                const password = this.passwordManager.getPassword();
                if (!password) {
                    new Notice('Please set master password first (Settings tab or "Set master password" command)');
                    return;
                }

                try {
                    const encrypted = await this.encryptionService.encrypt(selection, { password });
                    const formattedBlock = this.encryptionService.formatEncryptedBlock(encrypted);

                    const endOfSelection = editor.posToOffset(editor.getCursor('to'));
                    const endOfFile = editor.getValue().length;
                    let finalBlock = formattedBlock;
                    if (endOfSelection === endOfFile) {
                        finalBlock += '\n';
                    }

                    editor.replaceSelection(finalBlock);
                    new Notice('Selection encrypted');
                } catch (error) {
                    new Notice('Failed to encrypt selection');
                }
            }
        });

        this.addCommand({
            id: 'encrypt-file',
            name: 'Encrypt file',
            callback: async () => {
                const activeFile = this.app.workspace.getActiveFile();
                if (!activeFile) {
                    new Notice('No active file');
                    return;
                }

                const password = this.passwordManager.getPassword();
                if (!password) {
                    new Notice('Please set master password first');
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

                    const encrypted = await this.encryptionService.encrypt(contentToEncrypt, { password });
                    const formattedBlock = this.encryptionService.formatEncryptedBlock(encrypted);

                    let finalContent = frontmatter + formattedBlock;
                    if (contentToEncrypt.length > 0 && !contentToEncrypt.endsWith('\n')) {
                        finalContent += '\n';
                    }

                    await this.app.vault.modify(activeFile, finalContent);
                    new Notice('File encrypted successfully');
                } catch (error) {
                    new Notice('Failed to encrypt file');
                }
            }
        });

        this.addCommand({
            id: 'edit-encrypted',
            name: 'Edit encrypted block',
            editorCallback: async (editor: Editor, _view: MarkdownView) => {
                const password = this.passwordManager.getPassword();
                if (!password) {
                    new Notice('Please set master password first');
                    return;
                }

                const doc = editor.getValue();
                const cursor = editor.getCursor();
                const offset = editor.posToOffset(cursor);
                const lines = doc.split('\n');

                // Find the nearest ```age block around the cursor
                let blockStart = -1;
                let blockEnd = -1;
                let lineOffset = 0;
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].trimStart().startsWith('```age')) {
                        blockStart = i;
                        // Find closing ```
                        for (let j = i + 1; j < lines.length; j++) {
                            if (lines[j].trimStart() === '```') {
                                blockEnd = j;
                                break;
                            }
                        }
                        if (blockEnd !== -1) {
                            // Check if cursor is within this block's line range
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
                    new Notice('No encrypted block found near cursor');
                    return;
                }

                const blockLines = lines.slice(blockStart, blockEnd + 1);
                const blockSource = blockLines.join('\n');

                try {
                    const { content, hint } = this.encryptionService.parseEncryptedBlock(blockSource);
                    const decrypted = await this.encryptionService.decrypt(content, password);

                    const modal = new EditModal(this.app, decrypted, hint);
                    const result = await modal.openAndGetResult();

                    if (!result) return;

                    if (result.action === 'save-encrypted') {
                        const encrypted = await this.encryptionService.encrypt(result.text, { password });
                        const newBlock = this.encryptionService.formatEncryptedBlock(encrypted, hint);
                        const lineStart = blockStart;
                        const lineCount = blockEnd - blockStart + 1;
                        const newLines = doc.split('\n');
                        newLines.splice(lineStart, lineCount, newBlock);
                        editor.setValue(newLines.join('\n'));
                        new Notice('Content re-encrypted');
                    } else if (result.action === 'save-plaintext') {
                        const lineStart = blockStart;
                        const lineCount = blockEnd - blockStart + 1;
                        const newLines = doc.split('\n');
                        newLines.splice(lineStart, lineCount, result.text);
                        editor.setValue(newLines.join('\n'));
                        new Notice('Saved as plain text');
                    }
                } catch (error) {
                    new Notice('Failed to decrypt block');
                }
            }
        });

        // React to password changes
        this.passwordManager.on('changed', () => {
            this.decryptCache.clear();
            this.readingViewProcessor.rerenderAll();
            this.cm6Extension.invalidateDecryptions();
        });

        this.passwordManager.on('cleared', () => {
            this.decryptCache.clear();
            this.readingViewProcessor.rerenderAll();
            this.cm6Extension.invalidateDecryptions();
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
        this.passwordManager.clearPassword();
        this.decryptCache.clear();
    }
}
