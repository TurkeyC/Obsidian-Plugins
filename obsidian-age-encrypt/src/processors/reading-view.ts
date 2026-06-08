import { App, Component, MarkdownRenderer, MarkdownPostProcessorContext, Notice } from 'obsidian';
import { EncryptionService } from '../services/encryption';
import { PasswordManager } from '../services/password-manager';
import { DecryptCache } from '../services/decrypt-cache';
import { PasswordModal } from '../ui/PasswordModal';

interface TrackedElement {
    source: string;
    cacheKey: string;
    hint?: string;
    sourcePath: string;
}

export class ReadingViewProcessor {
    private trackedElements: Map<HTMLElement, TrackedElement> = new Map();
    private registered = false;
    private sourcePathCache = '';

    constructor(
        private app: App,
        private encryptionService: EncryptionService,
        private passwordManager: PasswordManager,
        private decryptCache: DecryptCache,
        private plugin: Component
    ) {}

    register(): void {
        if (this.registered) return;
        this.registered = true;

        const handler = (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
            this.sourcePathCache = ctx.sourcePath;
            this.processBlock(source, el);
        };

        (this.plugin as any).registerMarkdownCodeBlockProcessor('age', handler);
    }

    private async processBlock(source: string, el: HTMLElement): Promise<void> {
        let encryptedData: { content: string; hint?: string };
        try {
            encryptedData = this.encryptionService.parseEncryptedBlock(source);
        } catch (_e) {
            this.renderError(el, '加密块格式无效');
            return;
        }

        const cacheKey = DecryptCache.cacheKey(encryptedData.content);
        const sourcePath = this.sourcePathCache;

        this.trackedElements.set(el, {
            source,
            cacheKey,
            hint: encryptedData.hint,
            sourcePath
        });

        const hasCredential = this.passwordManager.hasAnyCredential();
        if (!hasCredential) {
            this.renderPasswordRequired(el, encryptedData.hint);
            return;
        }

        // 检查缓存
        const cached = this.decryptCache.get(cacheKey);
        if (cached) {
            this.renderDecrypted(el, cached);
            return;
        }

        // 解密中
        this.renderLoading(el);

        // 尝试解密（同时尝试密码和密钥）
        try {
            const password = this.passwordManager.getPassword() || undefined;
            const identity = this.passwordManager.getIdentity() || undefined;
            const decrypted = await this.encryptionService.decrypt(
                encryptedData.content,
                password,
                identity
            );
            this.decryptCache.set(cacheKey, decrypted);
            this.renderDecrypted(el, decrypted);
        } catch (_error) {
            this.renderDecryptionError(el, encryptedData.hint);
        }
    }

    private renderPasswordRequired(el: HTMLElement, hint?: string): void {
        el.empty();
        el.addClass('age-encrypt-placeholder');

        const title = el.createDiv({ text: '加密内容' });
        title.style.fontWeight = '600';
        title.style.marginBottom = '4px';

        const sub = el.createDiv({ text: '点击输入密码加载凭证' });
        sub.style.fontSize = '0.9em';
        sub.style.color = 'var(--text-muted)';

        if (hint) {
            const hintEl = el.createDiv({ text: `提示: ${hint}` });
            hintEl.style.fontSize = '0.85em';
            hintEl.style.color = 'var(--text-faint)';
            hintEl.style.marginTop = '4px';
        }

        el.onclick = async () => {
            const modal = new PasswordModal(this.app);
            const password = await modal.openAndGetPassword();
            if (password) {
                this.passwordManager.setPassword(password);
                new Notice('主密码已设置');
            }
        };
    }

    private renderLoading(el: HTMLElement): void {
        el.empty();
        el.addClass('age-encrypt-loading');
        el.createDiv({ text: '解密中...' });
    }

    private renderDecrypted(el: HTMLElement, text: string): void {
        el.empty();
        el.addClass('age-decrypted-block');

        const wrapper = el.createDiv({ cls: 'age-decrypted-wrapper' });
        wrapper.style.position = 'relative';

        const tracked = this.trackedElements.get(el);
        const sourcePath = tracked?.sourcePath ?? '';

        MarkdownRenderer.render(
            this.app,
            text,
            wrapper,
            sourcePath,
            this.plugin
        );
    }

    private renderDecryptionError(el: HTMLElement, hint?: string): void {
        el.empty();
        el.addClass('age-encrypt-error-block');

        el.createDiv({ text: '解密失败' });
        const sub = el.createDiv({
            text: '密码错误、密钥不匹配或数据已损坏'
        });
        sub.style.fontSize = '0.9em';
        sub.style.marginTop = '4px';

        const retryBtn = el.createEl('button', {
            text: '重试',
            cls: 'age-encrypt-retry-btn'
        });
        retryBtn.style.marginTop = '8px';
        retryBtn.onclick = async () => {
            const modal = new PasswordModal(this.app);
            const password = await modal.openAndGetPassword();
            if (password) {
                this.passwordManager.setPassword(password);
            }
        };
    }

    private renderError(el: HTMLElement, message: string): void {
        el.empty();
        el.addClass('age-encrypt-error-block');
        el.createDiv({ text: message });
    }

    rerenderAll(): void {
        const entries = Array.from(this.trackedElements.entries());
        for (const [el, data] of entries) {
            if (!el.isConnected) {
                this.trackedElements.delete(el);
                continue;
            }
            this.processBlock(data.source, el);
        }
    }

    untrackElement(el: HTMLElement): void {
        this.trackedElements.delete(el);
    }
}
