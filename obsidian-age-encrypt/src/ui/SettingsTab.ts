import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import AgeEncryptPlugin from '../../main';

export class AgeEncryptSettingTab extends PluginSettingTab {
    plugin: AgeEncryptPlugin;

    constructor(app: App, plugin: AgeEncryptPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h3', { text: 'Master Password' });

        const passwordDesc = containerEl.createDiv();
        passwordDesc.style.marginBottom = '8px';
        this.updatePasswordStatus(passwordDesc);

        const passwordSetting = new Setting(containerEl)
            .setName('Password')
            .setDesc('Enter your master password. Password is stored in memory only and never saved to disk.')
            .addText(text => {
                text
                    .setPlaceholder('Enter master password')
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

        const setBtn = btnRow.createEl('button', { text: 'Set', cls: 'mod-cta' });
        setBtn.onclick = async () => {
            if (this.passwordInput) {
                this.plugin.passwordManager.setPassword(this.passwordInput);
                if (this.passwordInputEl) this.passwordInputEl.value = '';
                this.passwordInput = '';
                this.updatePasswordStatus(passwordDesc);
                new Notice('Master password set for this session');
            }
        };

        const clearBtn = btnRow.createEl('button', { text: 'Clear' });
        clearBtn.onclick = async () => {
            this.plugin.passwordManager.clearPassword();
            this.passwordInput = '';
            if (this.passwordInputEl) this.passwordInputEl.value = '';
            this.updatePasswordStatus(passwordDesc);
        };

        const togglePasswordBtn = btnRow.createEl('button', { text: 'Show/Hide' });
        togglePasswordBtn.onclick = () => {
            if (this.passwordInputEl) {
                this.passwordInputEl.type = this.passwordInputEl.type === 'password' ? 'text' : 'password';
            }
        };

        containerEl.createEl('hr');

        new Setting(containerEl)
            .setName('Exclude frontmatter from encryption')
            .setDesc('If enabled, the YAML frontmatter will not be encrypted when using the "Encrypt file" command.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.excludeFrontmatter)
                .onChange(async (value) => {
                    this.plugin.settings.excludeFrontmatter = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Auto-decrypt on load')
            .setDesc('When master password is set, automatically decrypt all encrypted blocks without manual interaction.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoDecryptOnLoad)
                .onChange(async (value) => {
                    this.plugin.settings.autoDecryptOnLoad = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Show edit indicator')
            .setDesc('Show a subtle edit button on hover over decrypted content blocks.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showEditIndicator)
                .onChange(async (value) => {
                    this.plugin.settings.showEditIndicator = value;
                    await this.plugin.saveSettings();
                }));
    }

    private passwordInput = '';
    private passwordInputEl: HTMLInputElement | null = null;
    private passwordDescEl: HTMLElement | null = null;

    private updatePasswordStatus(el: HTMLElement): void {
        this.passwordDescEl = el;
        if (this.plugin.passwordManager.isPasswordSet()) {
            el.setText('Status: Password is set for this session');
            el.style.color = 'var(--color-green)';
        } else {
            el.setText('Status: No password configured');
            el.style.color = 'var(--text-muted)';
        }
    }
}
