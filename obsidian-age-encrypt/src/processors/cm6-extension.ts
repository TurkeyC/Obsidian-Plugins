import { App, Component, MarkdownRenderer } from 'obsidian';
import { StateField, StateEffect, Extension, EditorState, StateCommand } from '@codemirror/state';
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
                    // Quick check: if document doesn't contain ```age, skip
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
        const password = this.passwordManager.getPassword();
        if (!password) return Decoration.none;

        const blocks = this.findAgeBlocks(state);
        if (blocks.length === 0) return Decoration.none;

        const decorations: any[] = [];

        for (const block of blocks) {
            const decrypted = this.tryGetDecryptedText(block, password);
            if (decrypted === null) continue;
            if (decrypted === undefined) {
                // Cache miss - decrypt needs to happen async, leave raw source for now
                continue;
            }

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
        // Match ```age ... ``` blocks
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
        password: string
    ): string | null | undefined {
        try {
            const { content } = this.encryptionService.parseEncryptedBlock(block.text);
            const cacheKey = DecryptCache.cacheKey(content);
            const cached = this.decryptCache.get(cacheKey);
            if (cached !== null) {
                return cached;
            }

            // Cache miss - trigger async decryption, return undefined
            // to skip this block for now
            this.encryptionService.decrypt(content, password).then(decrypted => {
                this.decryptCache.set(cacheKey, decrypted);
                // Dispatch to all views to trigger re-render
                for (const view of this.views) {
                    view.dispatch({ effects: recomputeEffect.of() });
                }
            }).catch(() => {
                // Decryption failed, skip
            });

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

        // Render decrypted markdown asynchronously
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
                this.container!.textContent = '[Decryption render error]';
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
