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
        contentEl.createEl('h2', { text: 'Enter master password' });

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
                showError('Password is required');
                return;
            }

            if (!this.confirmPassword) {
                showError('Please confirm your password');
                return;
            }

            if (this.password !== this.confirmPassword) {
                showError('Passwords do not match');
                return;
            }

            this.resolve(this.password);
            this.close();
        };

        new Setting(contentEl)
            .setName('Password')
            .addText(text => {
                text
                    .setPlaceholder('Enter master password')
                    .setValue(this.password)
                    .onChange(value => this.password = value);
                text.inputEl.type = 'password';
                text.inputEl.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        // Move focus to confirm field or submit
                    }
                });
                return text;
            });

        new Setting(contentEl)
            .setName('Confirm password')
            .addText(text => {
                text
                    .setPlaceholder('Confirm master password')
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
                .setButtonText('Set')
                .setCta()
                .onClick(() => submitHandler()))
            .addButton(btn => btn
                .setButtonText('Cancel')
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
