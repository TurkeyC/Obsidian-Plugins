import { Modal, App, Setting } from 'obsidian';

export class PasswordModal extends Modal {
    private password: string = '';
    private confirmPassword: string = '';
    private errorEl: HTMLElement | null = null;
    private resolve: (value: string | null) => void;

    constructor(app: App) {
        super(app);
    }

    async openAndGetPassword(): Promise<string | null> {
        return new Promise((resolve) => {
            this.resolve = resolve;
            this.open();
        });
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: '输入主密码' });

        const showError = (message: string) => {
            if (this.errorEl) {
                this.errorEl.textContent = message;
            } else {
                this.errorEl = contentEl.createEl('p', {
                    text: message,
                    cls: 'age-encrypt-error'
                });
                this.errorEl.style.color = 'var(--text-error)';
                this.errorEl.style.marginTop = '1em';
            }
        };

        const clearError = () => {
            if (this.errorEl) {
                this.errorEl.remove();
                this.errorEl = null;
            }
        };

        const submitHandler = () => {
            clearError();

            if (!this.password) {
                showError('请输入密码');
                return;
            }

            if (!this.confirmPassword) {
                showError('请确认密码');
                return;
            }

            if (this.password !== this.confirmPassword) {
                showError('两次输入的密码不一致');
                return;
            }

            this.resolve(this.password);
            this.close();
        };

        new Setting(contentEl)
            .setName('密码')
            .addText(text => {
                text
                    .setPlaceholder('输入主密码')
                    .setValue(this.password)
                    .onChange(value => this.password = value);
                text.inputEl.type = 'password';
                return text;
            });

        new Setting(contentEl)
            .setName('确认密码')
            .addText(text => {
                text
                    .setPlaceholder('再次输入主密码')
                    .setValue(this.confirmPassword)
                    .onChange(value => this.confirmPassword = value);
                text.inputEl.type = 'password';
                text.inputEl.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        submitHandler();
                    }
                });
                return text;
            });

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('确认')
                .setCta()
                .onClick(() => submitHandler()))
            .addButton(btn => btn
                .setButtonText('取消')
                .onClick(() => {
                    this.resolve(null);
                    this.close();
                }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
