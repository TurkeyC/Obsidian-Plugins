import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import AgeEncryptPlugin from '../../main';
import { MigrationModal } from './MigrationModal';

export class AgeEncryptSettingTab extends PluginSettingTab {
    plugin: AgeEncryptPlugin;
    private passwordInput = '';
    private passwordInputEl: HTMLInputElement | null = null;
    private identityInputEl: HTMLTextAreaElement | null = null;
    private statusEl: HTMLElement | null = null;

    constructor(app: App, plugin: AgeEncryptPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Age Encrypt 设置' });

        // ── 加密模式选择 ──
        containerEl.createEl('h3', { text: '加密方式' });

        new Setting(containerEl)
            .setName('加密模式')
            .setDesc('选择使用密码加密还是密钥对加密。密钥对加密更安全，且不受重启影响。')
            .addDropdown(dropdown => dropdown
                .addOption('password', '密码加密')
                .addOption('key', '密钥加密（推荐）')
                .setValue(this.plugin.settings.encryptionMode)
                .onChange(async (value: 'password' | 'key') => {
                    this.plugin.settings.encryptionMode = value;
                    await this.plugin.saveSettings();
                    this.display(); // 刷新页面
                }));

        // ── 密钥模式 UI ──
        if (this.plugin.settings.encryptionMode === 'key') {
            this.renderKeyModeUI(containerEl);
        } else {
            this.renderPasswordModeUI(containerEl);
        }

        containerEl.createEl('hr');

        // ── 通用设置 ──
        containerEl.createEl('h3', { text: '解密设置' });

        new Setting(containerEl)
            .setName('自动解密')
            .setDesc('密码或密钥已加载时，自动解密所有加密块')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoDecryptOnLoad)
                .onChange(async (value) => {
                    this.plugin.settings.autoDecryptOnLoad = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('显示编辑提示')
            .setDesc('悬停解密后的内容时，显示一个微小的编辑按钮')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showEditIndicator)
                .onChange(async (value) => {
                    this.plugin.settings.showEditIndicator = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('排除 Frontmatter')
            .setDesc('加密整文件时，不加密 YAML 前置元数据')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.excludeFrontmatter)
                .onChange(async (value) => {
                    this.plugin.settings.excludeFrontmatter = value;
                    await this.plugin.saveSettings();
                }));

        // ── 凭据迁移 ──
        containerEl.createEl('hr');
        containerEl.createEl('h3', { text: '凭据迁移' });

        const migrateDesc = containerEl.createDiv();
        migrateDesc.style.fontSize = '0.85em';
        migrateDesc.style.color = 'var(--text-muted)';
        migrateDesc.style.marginBottom = '8px';
        migrateDesc.setText('更换密码或密钥后，已有加密文件仍使用旧凭据。点击下方按钮重新加密整个仓库中的所有内容。');

        const migrateBtn = containerEl.createEl('button', { text: '打开迁移向导', cls: 'mod-cta' });
        migrateBtn.onclick = () => {
            const modal = new MigrationModal(
                this.app,
                this.plugin.encryptionService,
                this.plugin.passwordManager,
                this.plugin.settings,
                this.plugin
            );
            modal.open();
        };
    }

    // ── 密钥模式 UI ──

    private renderKeyModeUI(containerEl: HTMLElement): void {
        // 凭证状态
        this.statusEl = containerEl.createDiv();
        this.statusEl.style.marginBottom = '12px';
        this.updateKeyStatus();

        // 密钥配置区域
        const keyBox = containerEl.createDiv();
        keyBox.style.background = 'var(--background-secondary)';
        keyBox.style.padding = '12px';
        keyBox.style.borderRadius = '6px';
        keyBox.style.marginBottom = '12px';

        keyBox.createEl('strong', { text: '私钥（Identity）' });

        const keyInfo = keyBox.createDiv();
        keyInfo.style.fontSize = '0.85em';
        keyInfo.style.color = 'var(--text-muted)';
        keyInfo.style.marginTop = '4px';
        keyInfo.setText('私钥用于解密。将私钥粘贴到下方输入框，或点击生成新密钥对。');

        this.identityInputEl = keyBox.createEl('textarea', {
            attr: { placeholder: '粘贴 AGE-SECRET-KEY-1... 私钥' }
        });
        this.identityInputEl.style.width = '100%';
        this.identityInputEl.style.minHeight = '60px';
        this.identityInputEl.style.marginTop = '8px';
        this.identityInputEl.style.fontFamily = 'var(--font-monospace)';
        this.identityInputEl.style.fontSize = '12px';

        const keyBtnRow = keyBox.createDiv();
        keyBtnRow.style.display = 'flex';
        keyBtnRow.style.gap = '8px';
        keyBtnRow.style.marginTop = '8px';
        keyBtnRow.style.flexWrap = 'wrap';

        const loadKeyBtn = keyBtnRow.createEl('button', { text: '加载私钥', cls: 'mod-cta' });
        loadKeyBtn.onclick = async () => {
            const identity = this.identityInputEl?.value.trim();
            if (!identity || !identity.startsWith('AGE-SECRET-KEY-1')) {
                new Notice('私钥格式无效，应以 AGE-SECRET-KEY-1 开头');
                return;
            }
            try {
                // 验证私钥有效性
                await this.plugin.encryptionService.identityToRecipient(identity);
                this.plugin.passwordManager.setIdentity(identity);
                if (this.identityInputEl) this.identityInputEl.value = '';
                this.updateKeyStatus();
                new Notice('私钥已加载（内存中，仅本次会话有效）');
            } catch {
                new Notice('私钥无效，请检查后重试');
            }
        };

        const genBtn = keyBtnRow.createEl('button', { text: '生成新密钥对' });
        genBtn.onclick = async () => {
            try {
                const pair = await this.plugin.encryptionService.generateKeyPair();
                this.plugin.passwordManager.setIdentity(pair.identity);
                this.plugin.settings.recipientKey = pair.recipient;
                await this.plugin.saveSettings();

                // 显示密钥信息
                const resultBox = containerEl.createDiv();
                resultBox.style.margin = '12px 0';
                resultBox.style.padding = '12px';
                resultBox.style.border = '1px solid var(--interactive-accent)';
                resultBox.style.borderRadius = '6px';

                resultBox.createEl('strong', { text: '密钥对已生成' });

                const identEl = resultBox.createDiv();
                identEl.style.marginTop = '8px';
                identEl.style.wordBreak = 'break-all';
                identEl.style.fontFamily = 'var(--font-monospace)';
                identEl.style.fontSize = '12px';
                identEl.innerHTML = `<strong>私钥（请妥善保存！）</strong><br>${pair.identity}`;

                const recipEl = resultBox.createDiv();
                recipEl.style.marginTop = '8px';
                recipEl.style.wordBreak = 'break-all';
                recipEl.style.fontFamily = 'var(--font-monospace)';
                recipEl.style.fontSize = '12px';
                recipEl.innerHTML = `<strong>公钥（已保存到设置）</strong><br>${pair.recipient}`;

                const warn = resultBox.createDiv();
                warn.style.marginTop = '8px';
                warn.style.color = 'var(--text-warning)';
                warn.style.fontSize = '0.85em';
                warn.setText('私钥仅存储在内存中。请立即复制私钥并保存到安全位置，关闭此页面后将无法再次查看。');

                const copyBtn = resultBox.createEl('button', { text: '复制私钥到剪贴板' });
                copyBtn.style.marginTop = '8px';
                copyBtn.onclick = () => {
                    navigator.clipboard.writeText(pair.identity);
                    new Notice('私钥已复制');
                };

                this.updateKeyStatus();
                new Notice('密钥对已生成');
            } catch (e) {
                new Notice('生成密钥对失败');
            }
        };

        // 已保存的公钥信息
        if (this.plugin.settings.recipientKey) {
            const recipInfo = keyBox.createDiv();
            recipInfo.style.marginTop = '8px';
            recipInfo.style.fontSize = '0.85em';
            recipInfo.style.color = 'var(--text-muted)';
            recipInfo.style.wordBreak = 'break-all';
            recipInfo.innerHTML = `<strong>已配置公钥：</strong><br>${this.plugin.settings.recipientKey}`;

            const clearRecipBtn = keyBtnRow.createEl('button', { text: '清除公钥' });
            clearRecipBtn.onclick = async () => {
                this.plugin.settings.recipientKey = undefined;
                await this.plugin.saveSettings();
                new Notice('公钥已清除');
                this.display();
            };
        }

        const clearIdentityBtn = keyBtnRow.createEl('button', { text: '清除内存中的私钥' });
        clearIdentityBtn.onclick = () => {
            this.plugin.passwordManager.clearIdentity();
            this.updateKeyStatus();
            new Notice('私钥已从内存清除');
        };
    }

    // ── 密码模式 UI ──

    private renderPasswordModeUI(containerEl: HTMLElement): void {
        this.statusEl = containerEl.createDiv();
        this.statusEl.style.marginBottom = '8px';
        this.updatePasswordStatus();

        const passwordSetting = new Setting(containerEl)
            .setName('主密码')
            .setDesc('设置用于加密和解密的主密码。密码仅存储在内存中（除非勾选下方保存选项）。')
            .addText(text => {
                text
                    .setPlaceholder('输入主密码')
                    .onChange(value => this.passwordInput = value);
                text.inputEl.type = 'password';
                this.passwordInputEl = text.inputEl;
                return text;
            });

        const btnRow = passwordSetting.settingEl.createDiv();
        btnRow.addClass('age-encrypt-settings-buttons');
        btnRow.style.display = 'flex';
        btnRow.style.gap = '8px';
        btnRow.style.marginTop = '8px';

        const setBtn = btnRow.createEl('button', { text: '设置', cls: 'mod-cta' });
        setBtn.onclick = async () => {
            if (this.passwordInput) {
                this.plugin.passwordManager.setPassword(this.passwordInput);
                if (this.passwordInputEl) this.passwordInputEl.value = '';
                this.passwordInput = '';
                this.updatePasswordStatus();
                new Notice('主密码已设置（内存中，本次会话有效）');
            }
        };

        const clearBtn = btnRow.createEl('button', { text: '清除' });
        clearBtn.onclick = async () => {
            this.plugin.passwordManager.clearPassword();
            this.passwordInput = '';
            if (this.passwordInputEl) this.passwordInputEl.value = '';
            this.updatePasswordStatus();
        };

        const togglePwBtn = btnRow.createEl('button', { text: '显示/隐藏' });
        togglePwBtn.onclick = () => {
            if (this.passwordInputEl) {
                this.passwordInputEl.type = this.passwordInputEl.type === 'password' ? 'text' : 'password';
            }
        };

        // 密码持久化选项
        new Setting(containerEl)
            .setName('保存密码到本地')
            .setDesc('将密码保存到 Obsidian 配置文件中，重启后仍有效。密码以明文存储，请谨慎使用。')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.savePassword)
                .onChange(async (value) => {
                    this.plugin.settings.savePassword = value;
                    if (value && this.plugin.passwordManager.getPassword()) {
                        // 保存密码到 data.json
                        this.plugin.settings.savedPassword = this.plugin.passwordManager.getPassword()!;
                    } else if (!value) {
                        // 清除已保存的密码
                        this.plugin.settings.savedPassword = undefined;
                    }
                    await this.plugin.saveSettings();
                    this.updatePasswordStatus();
                }));

        if (this.plugin.settings.savePassword) {
            const warnEl = containerEl.createDiv();
            warnEl.style.color = 'var(--text-warning)';
            warnEl.style.fontSize = '0.85em';
            warnEl.style.padding = '4px 0 8px 0';
            warnEl.setText('密码已保存到 data.json。任何人能访问您的 vault 目录即可读取此密码。');
        }
    }

    private updatePasswordStatus(): void {
        if (!this.statusEl) return;
        const pwSet = this.plugin.passwordManager.isPasswordSet();
        const saved = this.plugin.settings.savePassword;

        if (pwSet && saved) {
            this.statusEl.setText('密码已设置（内存 + 已持久化到 data.json，重启后有效）');
            this.statusEl.style.color = 'var(--color-green)';
        } else if (pwSet) {
            this.statusEl.setText('密码已设置（仅内存，重启后失效）');
            this.statusEl.style.color = 'var(--color-green)';
        } else if (saved && this.plugin.settings.savedPassword) {
            this.statusEl.setText('密码已持久化到本地，但未加载到内存。请设置密码以激活解密。');
            this.statusEl.style.color = 'var(--text-warning)';
        } else {
            this.statusEl.setText('未设置密码');
            this.statusEl.style.color = 'var(--text-muted)';
        }
    }

    private updateKeyStatus(): void {
        if (!this.statusEl) return;
        const idSet = this.plugin.passwordManager.isIdentitySet();
        const hasRecipient = !!this.plugin.settings.recipientKey;

        if (idSet && hasRecipient) {
            this.statusEl.setText('私钥已加载（内存），公钥已保存。可以加密和解密。');
            this.statusEl.style.color = 'var(--color-green)';
        } else if (idSet) {
            this.statusEl.setText('私钥已加载（内存），但未配置公钥。只能解密无法加密。');
            this.statusEl.style.color = 'var(--text-warning)';
        } else if (hasRecipient) {
            this.statusEl.setText('公钥已保存，但私钥未加载。只能加密无法解密。');
            this.statusEl.style.color = 'var(--text-warning)';
        } else {
            this.statusEl.setText('未配置密钥');
            this.statusEl.style.color = 'var(--text-muted)';
        }
    }
}
