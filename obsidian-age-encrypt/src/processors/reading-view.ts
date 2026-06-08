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

        // Use a bound arrow function to capture the handler reference for cleanup
        const handler = (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
            this.sourcePathCache = ctx.sourcePath;
            this.processBlock(source, el);
        };

        // registerMarkdownCodeBlockProcessor returns something we can use
        // but we'll track cleanup via plugin lifecycle
        (this.plugin as any).registerMarkdownCodeBlockProcessor('age', handler);
    }

    private async processBlock(source: string, el: HTMLElement): Promise<void> {
        let encryptedData: { content: string; hint?: string };
        try {
            encryptedData = this.encryptionService.parseEncryptedBlock(source);
        } catch (_e) {
            this.renderError(el, 'Invalid encrypted block format');
            return;
        }

        const cacheKey = DecryptCache.cacheKey(encryptedData.content);

        // Track element for later re-rendering
        const sourcePath = this.sourcePathCache;
        this.trackedElements.set(el, {
            source,
            cacheKey,
            hint: encryptedData.hint,
            sourcePath
        });

        const password = this.passwordManager.getPassword();
        if (!password) {
            this.renderPasswordRequired(el, encryptedData.hint);
            return;
        }

        // Check cache
        const cached = this.decryptCache.get(cacheKey);
        if (cached) {
            this.renderDecrypted(el, cached);
            return;
        }

        // Show loading state
        this.renderLoading(el);

        // Decrypt
        try {
            const decrypted = await this.encryptionService.decrypt(encryptedData.content, password);
            this.decryptCache.set(cacheKey, decrypted);
            this.renderDecrypted(el, decrypted);
        } catch (_error) {
            this.renderDecryptionError(el, encryptedData.hint);
        }
    }

    private renderPasswordRequired(el: HTMLElement, hint?: string): void {
        el.empty();
        el.addClass('age-encrypt-placeholder');

        const title = el.createDiv({ text: 'Encrypted content' });
        title.style.fontWeight = '600';
        title.style.marginBottom = '4px';

        const sub = el.createDiv({ text: 'Click to enter decryption password' });
        sub.style.fontSize = '0.9em';
        sub.style.color = 'var(--text-muted)';

        if (hint) {
            const hintEl = el.createDiv({ text: `Hint: ${hint}` });
            hintEl.style.fontSize = '0.85em';
            hintEl.style.color = 'var(--text-faint)';
            hintEl.style.marginTop = '4px';
        }

        el.onclick = async () => {
            const modal = new PasswordModal(this.app);
            const password = await modal.openAndGetPassword();
            if (password) {
                this.passwordManager.setPassword(password);
                new Notice('Master password set');
            }
        };
    }

    private renderLoading(el: HTMLElement): void {
        el.empty();
        el.addClass('age-encrypt-loading');
        el.createDiv({ text: 'Decrypting...' });
    }

    private renderDecrypted(el: HTMLElement, text: string): void {
        el.empty();
        el.addClass('age-decrypted-block');

        // Create wrapper for possible edit indicator
        const wrapper = el.createDiv({ cls: 'age-decrypted-wrapper' });
        wrapper.style.position = 'relative';

        // Look up sourcePath from tracked data
        const tracked = this.trackedElements.get(el);
        const sourcePath = tracked?.sourcePath ?? '';

        // Render decrypted text as markdown
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

        el.createDiv({ text: 'Failed to decrypt content' });
        const sub = el.createDiv({
            text: 'Invalid password or corrupted data'
        });
        sub.style.fontSize = '0.9em';
        sub.style.marginTop = '4px';

        const retryBtn = el.createEl('button', {
            text: 'Retry',
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
        // Iterate a copy since processing might modify the map
        const entries = Array.from(this.trackedElements.entries());
        for (const [el, data] of entries) {
            // Skip elements no longer in the DOM
            if (!el.isConnected) {
                this.trackedElements.delete(el);
                continue;
            }
            this.processBlock(data.source, el);
        }
    }

    /** Clean up tracking for a specific element */
    untrackElement(el: HTMLElement): void {
        this.trackedElements.delete(el);
    }
}
