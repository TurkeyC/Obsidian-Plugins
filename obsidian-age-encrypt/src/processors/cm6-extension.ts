import { App, Component, MarkdownRenderer } from 'obsidian';
import { StateField, StateEffect, Extension, EditorState } from '@codemirror/state';
import { Decoration, DecorationSet, WidgetType, EditorView, ViewPlugin } from '@codemirror/view';
import { EncryptionService } from '../services/encryption';
import { PasswordManager } from '../services/password-manager';
import { DecryptCache } from '../services/decrypt-cache';

interface AgeBlockRange {
    from: number;
    to: number;
    text: string;
}

const recomputeEffect = StateEffect.define<void>();

export class SourceModeExtension {
    private views: Set<EditorView> = new Set();
    private encryptionService: EncryptionService;
    private passwordManager: PasswordManager;
    private decryptCache: DecryptCache;
    private app: App;
    private plugin: Component;

    constructor(
        app: App,
        encryptionService: EncryptionService,
        passwordManager: PasswordManager,
        decryptCache: DecryptCache,
        plugin: Component
    ) {
        this.app = app;
        this.encryptionService = encryptionService;
        this.passwordManager = passwordManager;
        this.decryptCache = decryptCache;
        this.plugin = plugin;
    }

    createExtension(): Extension[] {
        const outer = this;

        return [
            StateField.define<DecorationSet>({
                create(state: EditorState): DecorationSet {
                    return Decoration.none;
                },
                update(deco: DecorationSet, tr: any): DecorationSet {
                    if (!tr.state.sliceDoc(0, Math.min(tr.state.doc.length, 200)).includes('```age')) {
                        return Decoration.none;
                    }

                    if (tr.docChanged || tr.effects.some((e: any) => e.is(recomputeEffect))) {
                        return outer.computeDecorations(tr.state);
                    }
                    return deco.map(tr.changes);
                },
                provide: (f: any) => EditorView.decorations.from(f),
            }),

            ViewPlugin.fromClass(class {
                constructor(view: EditorView) {
                    outer.views.add(view);
                }
                destroy() {
                    outer.views.delete(this as any);
                }
            }),
        ];
    }

    private computeDecorations(state: EditorState): DecorationSet {
        if (!this.passwordManager.hasAnyCredential()) return Decoration.none;

        const blocks = this.findAgeBlocks(state);
        if (blocks.length === 0) return Decoration.none;

        const decorations: any[] = [];
        const password = this.passwordManager.getPassword() || undefined;
        const identity = this.passwordManager.getIdentity() || undefined;

        for (const block of blocks) {
            const decrypted = this.tryGetDecryptedText(block, password, identity);
            if (decrypted === null) continue;
            if (decrypted === undefined) continue;

            decorations.push(
                Decoration.replace({
                    widget: new DecryptedMarkdownWidget(
                        this.app,
                        decrypted,
                        this.plugin
                    ),
                    block: true,
                }).range(block.from, block.to)
            );
        }

        return Decoration.set(decorations, true);
    }

    private findAgeBlocks(state: EditorState): AgeBlockRange[] {
        const doc = state.doc.toString();
        const blocks: AgeBlockRange[] = [];
        const regex = /```age[\s\S]*?```/g;
        let match: RegExpExecArray | null;

        while ((match = regex.exec(doc)) !== null) {
            blocks.push({
                from: match.index,
                to: match.index + match[0].length,
                text: match[0],
            });
        }

        return blocks;
    }

    private tryGetDecryptedText(
        block: AgeBlockRange,
        password?: string,
        identity?: string
    ): string | null | undefined {
        try {
            const { content } = this.encryptionService.parseEncryptedBlock(block.text);
            const cacheKey = DecryptCache.cacheKey(content);
            const cached = this.decryptCache.get(cacheKey);
            if (cached !== null) {
                return cached;
            }

            // 异步解密，成功后触发重绘
            this.encryptionService.decrypt(content, password, identity).then(decrypted => {
                this.decryptCache.set(cacheKey, decrypted);
                for (const view of this.views) {
                    view.dispatch({ effects: recomputeEffect.of() });
                }
            }).catch(() => {});

            return undefined;
        } catch {
            return null;
        }
    }

    invalidateDecryptions(): void {
        for (const view of this.views) {
            view.dispatch({ effects: recomputeEffect.of() });
        }
    }
}

class DecryptedMarkdownWidget extends WidgetType {
    private rendered = false;
    private container: HTMLDivElement | null = null;

    constructor(
        private app: App,
        private decryptedText: string,
        private plugin: Component
    ) {
        super();
    }

    toDOM(view: EditorView): HTMLElement {
        this.container = document.createElement('div');
        this.container.addClass('age-decrypted-inline');
        this.container.style.minHeight = '1em';
        this.container.style.width = '100%';

        if (!this.rendered) {
            this.rendered = true;
            MarkdownRenderer.render(
                this.app,
                this.decryptedText,
                this.container,
                '',
                this.plugin
            ).then(() => {
                view.requestMeasure();
            }).catch(() => {
                this.container!.textContent = '[解密渲染错误]';
                view.requestMeasure();
            });
        }

        return this.container;
    }

    eq(other: DecryptedMarkdownWidget): boolean {
        return other.decryptedText === this.decryptedText;
    }

    ignoreEvent(_event: Event): boolean {
        return true;
    }
}
