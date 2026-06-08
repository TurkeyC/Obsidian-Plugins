import { Modal, App, Setting } from 'obsidian';

export interface EditModalResult {
    action: 'save-encrypted' | 'save-plaintext';
    text: string;
}

export class EditModal extends Modal {
    private text: string;
    private hint: string | undefined;
    private textareaEl: HTMLTextAreaElement | null = null;
    private resolve: (value: EditModalResult | null) => void;

    constructor(app: App, initialText: string, hint?: string) {
        super(app);
        this.text = initialText;
        this.hint = hint;
    }

    async openAndGetResult(): Promise<EditModalResult | null> {
        return new Promise((resolve) => {
            this.resolve = resolve;
            this.open();
        });
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('age-encrypt-edit-modal');

        contentEl.createEl('h2', { text: '编辑加密内容' });

        if (this.hint) {
            const hintEl = contentEl.createEl('p', {
                text: `提示: ${this.hint}`,
                cls: 'age-encrypt-hint'
            });
            hintEl.style.color = 'var(--text-muted)';
            hintEl.style.fontSize = '0.9em';
        }

        this.textareaEl = contentEl.createEl('textarea', {
            text: this.text,
            cls: 'age-encrypt-edit-textarea'
        });
        this.textareaEl.style.width = '100%';
        this.textareaEl.style.minHeight = '200px';
        this.textareaEl.style.marginTop = '12px';
        this.textareaEl.style.padding = '8px';
        this.textareaEl.style.fontFamily = 'var(--font-monospace)';
        this.textareaEl.style.resize = 'vertical';

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('保存为加密')
                .setCta()
                .onClick(() => {
                    this.resolve({
                        action: 'save-encrypted',
                        text: this.textareaEl?.value || ''
                    });
                    this.close();
                }))
            .addButton(btn => btn
                .setButtonText('保存为纯文本')
                .onClick(() => {
                    this.resolve({
                        action: 'save-plaintext',
                        text: this.textareaEl?.value || ''
                    });
                    this.close();
                }))
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
