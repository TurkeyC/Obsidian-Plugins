import { Modal, App, Notice, TFile } from 'obsidian';
import { EncryptionService } from '../services/encryption';
import { PasswordManager } from '../services/password-manager';
import { AgeEncryptSettings } from '../settings';

type MigrationStep = 'choose-mode' | 'enter-old' | 'scanning' | 'confirm' | 'executing' | 'results';

interface ScanResult {
    file: TFile;
    blocks: { lineStart: number; lineEnd: number; decrypted: string; hint?: string }[];
    errors: { lineStart: number; error: string }[];
}

export class MigrationModal extends Modal {
    private step: MigrationStep = 'choose-mode';
    private stepContainer: HTMLElement;

    // 旧凭证
    private oldCredentialType: 'password' | 'key' = 'password';
    private oldPassword = '';
    private oldIdentity = '';

    // 扫描结果
    private scanResults: ScanResult[] = [];
    private totalBlocksFound = 0;
    private totalBlocksToMigrate = 0;

    // 执行结果
    private migratedCount = 0;
    private failedCount = 0;
    private skipCount = 0;

    constructor(
        app: App,
        private encryptionService: EncryptionService,
        private passwordManager: PasswordManager,
        private settings: AgeEncryptSettings,
        private plugin: any
    ) {
        super(app);
        this.titleEl.setText('凭据迁移向导');
    }

    onOpen() {
        this.stepContainer = this.contentEl;
        this.renderStep();
    }

    private renderStep(): void {
        this.stepContainer.empty();

        switch (this.step) {
            case 'choose-mode': this.renderChooseMode(); break;
            case 'enter-old': this.renderEnterOld(); break;
            case 'scanning': this.renderScanning(); break;
            case 'confirm': this.renderConfirm(); break;
            case 'executing': this.renderExecuting(); break;
            case 'results': this.renderResults(); break;
        }
    }

    // ── 步骤 1: 选择旧凭证类型 ──

    private renderChooseMode(): void {
        this.stepContainer.createEl('h2', { text: '凭据迁移' });
        this.stepContainer.createEl('p', {
            text: '此向导将扫描整个仓库，找到所有使用旧凭据加密的内容，并重新加密为新凭据。'
        });

        const infoBox = this.stepContainer.createDiv();
        infoBox.style.background = 'var(--background-secondary)';
        infoBox.style.padding = '12px';
        infoBox.style.borderRadius = '6px';
        infoBox.style.marginBottom = '16px';

        infoBox.createEl('p', {
            text: '当前加密方式：',
            cls: 'mod-cta'
        });

        const modeText = this.settings.encryptionMode === 'key'
            ? `密钥模式（公钥: ${(this.settings.recipientKey || '').slice(0, 20)}...）`
            : '密码模式';
        infoBox.createEl('p', { text: modeText, cls: 'age-encrypt-hint' });

        const hasNewCred = this.passwordManager.hasAnyCredential();
        if (!hasNewCred) {
            const warnEl = this.stepContainer.createDiv();
            warnEl.style.color = 'var(--text-warning)';
            warnEl.style.padding = '8px';
            warnEl.style.marginBottom = '12px';
            warnEl.style.background = 'var(--background-secondary)';
            warnEl.style.borderRadius = '4px';
            warnEl.setText('警告：尚未设置新凭据（密码或密钥）。请在设置页面先配置好新凭据，再进行迁移。');
        }

        this.stepContainer.createEl('p', { text: '你的旧加密凭据是哪种类型？' });

        const btnGroup = this.stepContainer.createDiv();
        btnGroup.style.display = 'flex';
        btnGroup.style.gap = '12px';
        btnGroup.style.marginTop = '12px';

        const pwBtn = btnGroup.createEl('button', { text: '密码', cls: 'mod-cta' });
        pwBtn.onclick = () => {
            this.oldCredentialType = 'password';
            this.step = 'enter-old';
            this.renderStep();
        };

        const keyBtn = btnGroup.createEl('button', { text: '密钥文件', cls: 'mod-cta' });
        keyBtn.onclick = () => {
            this.oldCredentialType = 'key';
            this.step = 'enter-old';
            this.renderStep();
        };

        const cancelBtn = this.stepContainer.createEl('button', { text: '取消' });
        cancelBtn.style.marginTop = '16px';
        cancelBtn.onclick = () => this.close();
    }

    // ── 步骤 2: 输入旧凭据 ──

    private renderEnterOld(): void {
        this.stepContainer.createEl('h2', {
            text: this.oldCredentialType === 'password' ? '输入旧密码' : '输入旧私钥'
        });

        if (this.oldCredentialType === 'password') {
            this.stepContainer.createEl('p', {
                text: '输入之前用于加密的旧密码。此密码不会保存到磁盘，仅用于本次迁移过程。'
            });

            const pwInput = this.stepContainer.createEl('input', {
                attr: { type: 'password', placeholder: '输入旧密码' }
            });
            pwInput.style.width = '100%';
            pwInput.style.marginTop = '8px';
            pwInput.style.padding = '8px';
            pwInput.onchange = () => { this.oldPassword = pwInput.value; };
            pwInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this.startScan();
            });

            const confirmInput = this.stepContainer.createEl('input', {
                attr: { type: 'password', placeholder: '确认旧密码' }
            });
            confirmInput.style.width = '100%';
            confirmInput.style.marginTop = '8px';
            confirmInput.style.padding = '8px';

            const nextBtn = this.createNextButton();
            nextBtn.onclick = () => {
                if (!pwInput.value) { new Notice('请输入旧密码'); return; }
                if (pwInput.value !== confirmInput.value) { new Notice('两次密码不一致'); return; }
                this.oldPassword = pwInput.value;
                this.startScan();
            };
        } else {
            this.stepContainer.createEl('p', {
                text: '粘贴旧的 AGE-SECRET-KEY-1 私钥。此密钥不会保存到磁盘，仅用于本次迁移过程。'
            });

            const keyInput = this.stepContainer.createEl('textarea', {
                attr: { placeholder: '粘贴 AGE-SECRET-KEY-1... 私钥' }
            });
            keyInput.style.width = '100%';
            keyInput.style.minHeight = '60px';
            keyInput.style.marginTop = '8px';
            keyInput.style.fontFamily = 'var(--font-monospace)';
            keyInput.style.fontSize = '12px';

            const nextBtn = this.createNextButton();
            nextBtn.onclick = () => {
                const val = keyInput.value.trim();
                if (!val.startsWith('AGE-SECRET-KEY-1')) {
                    new Notice('私钥格式无效，应以 AGE-SECRET-KEY-1 开头');
                    return;
                }
                this.oldIdentity = val;
                this.startScan();
            };
        }

        const backBtn = this.stepContainer.createEl('button', { text: '返回' });
        backBtn.style.marginTop = '8px';
        backBtn.onclick = () => { this.step = 'choose-mode'; this.renderStep(); };
    }

    private createNextButton(): HTMLButtonElement {
        const btn = this.stepContainer.createEl('button', { text: '下一步', cls: 'mod-cta' });
        btn.style.marginTop = '12px';
        return btn;
    }

    // ── 步骤 3: 扫描仓库 ──

    private async startScan(): Promise<void> {
        this.step = 'scanning';
        this.renderStep();

        const progressText = this.stepContainer.createEl('p', { text: '正在扫描仓库，查找加密块...' });
        const progressBar = this.stepContainer.createEl('progress');
        progressBar.style.width = '100%';
        progressBar.style.marginTop = '8px';

        const files = this.app.vault.getMarkdownFiles();
        progressBar.max = files.length;
        progressBar.value = 0;

        this.scanResults = [];
        this.totalBlocksFound = 0;
        this.totalBlocksToMigrate = 0;

        const password = this.oldCredentialType === 'password' ? this.oldPassword : undefined;
        const identity = this.oldCredentialType === 'key' ? this.oldIdentity : undefined;

        for (let i = 0; i < files.length; i++) {
            progressBar.value = i + 1;
            progressText.setText(`正在扫描: ${files[i].path} (${i + 1}/${files.length})`);

            try {
                const result = await this.scanFile(files[i], password, identity);
                if (result.blocks.length > 0 || result.errors.length > 0) {
                    this.scanResults.push(result);
                    this.totalBlocksFound += result.blocks.length + result.errors.length;
                    this.totalBlocksToMigrate += result.blocks.length;
                }
            } catch (e) {
                // 文件读取失败，跳过
            }
        }

        this.step = 'confirm';
        this.renderStep();
    }

    private async scanFile(
        file: TFile,
        oldPassword?: string,
        oldIdentity?: string
    ): Promise<ScanResult> {
        const content = await this.app.vault.read(file);
        const lines = content.split('\n');
        const blocks: ScanResult['blocks'] = [];
        const errors: ScanResult['errors'] = [];

        // 查找所有 ```age 块
        const ageBlockRegex = /```age[\s\S]*?```/g;
        let match: RegExpExecArray | null;

        // 逐行扫描以确定行号
        let lineIdx = 0;
        while (lineIdx < lines.length) {
            if (lines[lineIdx].trimStart().startsWith('```age')) {
                const blockStart = lineIdx;
                lineIdx++;
                while (lineIdx < lines.length && lines[lineIdx].trimStart() !== '```') {
                    lineIdx++;
                }
                const blockEnd = lineIdx; // 包含 ``` 行
                const blockSource = lines.slice(blockStart, blockEnd + 1).join('\n');

                try {
                    const { content: encryptedContent, hint } = this.encryptionService.parseEncryptedBlock(blockSource);
                    const decrypted = await this.encryptionService.decrypt(
                        encryptedContent,
                        oldPassword,
                        oldIdentity
                    );
                    blocks.push({ lineStart: blockStart, lineEnd: blockEnd, decrypted, hint });
                } catch {
                    errors.push({ lineStart: blockStart, error: '无法解密（凭据不匹配或数据损坏）' });
                }
            }
            lineIdx++;
        }

        return { file, blocks, errors };
    }

    // ── 步骤 4: 确认 ──

    private renderConfirm(): void {
        this.stepContainer.createEl('h2', { text: '扫描完成' });

        const summary = this.stepContainer.createDiv();
        summary.style.background = 'var(--background-secondary)';
        summary.style.padding = '12px';
        summary.style.borderRadius = '6px';
        summary.style.marginBottom = '16px';

        summary.createEl('p', { text: `涉及文件: ${this.scanResults.length} 个` });
        summary.createEl('p', { text: `加密块总计: ${this.totalBlocksFound} 个` });
        summary.createEl('p', {
            text: `将重新加密: ${this.totalBlocksToMigrate} 个`,
            cls: this.totalBlocksToMigrate > 0 ? 'mod-cta' : undefined
        });
        summary.createEl('p', {
            text: `无法解密（跳过）: ${this.totalBlocksFound - this.totalBlocksToMigrate} 个`
        });

        // 列出有错误的文件
        const errorFiles = this.scanResults.filter(r => r.errors.length > 0);
        if (errorFiles.length > 0) {
            const errBox = this.stepContainer.createDiv();
            errBox.style.color = 'var(--text-warning)';
            errBox.style.fontSize = '0.9em';
            errBox.style.marginBottom = '12px';
            errBox.createEl('p', { text: '以下文件的加密块无法解密（可能已使用新凭据加密）：' });
            for (const rf of errorFiles.slice(0, 10)) {
                errBox.createEl('p', {
                    text: `  ${rf.file.path}: ${rf.errors.length} 个块`
                });
            }
            if (errorFiles.length > 10) {
                errBox.createEl('p', { text: `  ...及其他 ${errorFiles.length - 10} 个文件` });
            }
        }

        if (this.totalBlocksToMigrate === 0) {
            this.stepContainer.createEl('p', {
                text: '没有找到可以迁移的加密块。请确认旧凭据是否正确。',
                cls: 'age-encrypt-error-block'
            });
            const closeBtn = this.stepContainer.createEl('button', { text: '关闭' });
            closeBtn.onclick = () => this.close();
            return;
        }

        const warning = this.stepContainer.createDiv();
        warning.style.color = 'var(--text-warning)';
        warning.style.padding = '8px';
        warning.style.marginBottom = '8px';
        warning.style.background = 'var(--background-secondary)';
        warning.style.borderRadius = '4px';
        warning.setText('警告：此操作将修改仓库中的文件。建议先备份 vault。');

        const btnRow = this.stepContainer.createDiv();
        btnRow.style.display = 'flex';
        btnRow.style.gap = '12px';
        btnRow.style.marginTop = '12px';

        const execBtn = btnRow.createEl('button', { text: '开始迁移', cls: 'mod-cta' });
        execBtn.onclick = () => this.executeMigration();

        const cancelBtn = btnRow.createEl('button', { text: '取消' });
        cancelBtn.onclick = () => this.close();
    }

    // ── 步骤 5: 执行迁移 ──

    private async executeMigration(): Promise<void> {
        this.step = 'executing';
        this.renderStep();

        const progressText = this.stepContainer.createEl('p', { text: '正在重新加密...' });
        const progressBar = this.stepContainer.createEl('progress');
        progressBar.style.width = '100%';
        progressBar.style.marginTop = '8px';
        progressBar.max = this.totalBlocksToMigrate;
        progressBar.value = 0;

        this.migratedCount = 0;
        this.failedCount = 0;
        this.skipCount = 0;

        // 获取新凭据
        const newPassword = this.passwordManager.getPassword() || undefined;
        const newRecipient = this.settings.encryptionMode === 'key'
            ? this.settings.recipientKey
            : undefined;

        let processedBlocks = 0;

        for (const fileResult of this.scanResults) {
            if (fileResult.blocks.length === 0) continue;

            progressText.setText(`正在处理: ${fileResult.file.path}`);

            try {
                let content = await this.app.vault.read(fileResult.file);
                let modified = false;

                // 从后往前替换
                const sortedBlocks = [...fileResult.blocks].sort((a, b) => b.lineStart - a.lineStart);

                for (const block of sortedBlocks) {
                    try {
                        const encrypted = await this.encryptionService.encrypt(block.decrypted, {
                            password: newPassword,
                            recipient: newRecipient
                        });
                        const newBlockText = this.encryptionService.formatEncryptedBlock(encrypted, block.hint);

                        const contentLines = content.split('\n');
                        contentLines.splice(block.lineStart, block.lineEnd - block.lineStart + 1, newBlockText);
                        content = contentLines.join('\n');
                        modified = true;
                        this.migratedCount++;
                    } catch {
                        this.failedCount++;
                    }

                    processedBlocks++;
                    progressBar.value = processedBlocks;
                }

                if (modified) {
                    await this.app.vault.modify(fileResult.file, content);
                }
            } catch {
                this.failedCount += fileResult.blocks.length;
                processedBlocks += fileResult.blocks.length;
                progressBar.value = processedBlocks;
            }
        }

        this.step = 'results';
        this.renderStep();
    }

    // ── 步骤 6: 结果 ──

    private renderResults(): void {
        this.stepContainer.createEl('h2', { text: '迁移完成' });

        const resultBox = this.stepContainer.createDiv();
        resultBox.style.background = 'var(--background-secondary)';
        resultBox.style.padding = '12px';
        resultBox.style.borderRadius = '6px';
        resultBox.style.marginBottom = '16px';

        resultBox.createEl('p', {
            text: `成功迁移: ${this.migratedCount} 个块`,
            cls: this.migratedCount > 0 ? 'mod-cta' : undefined
        });
        if (this.failedCount > 0) {
            resultBox.createEl('p', {
                text: `失败: ${this.failedCount} 个块`,
                cls: 'age-encrypt-error-block'
            });
        }

        if (this.failedCount > 0) {
            const tip = this.stepContainer.createDiv();
            tip.style.color = 'var(--text-warning)';
            tip.style.fontSize = '0.9em';
            tip.style.marginTop = '8px';
            tip.setText('部分块迁移失败。请确认新凭据是否正确且已加载，然后重新运行迁移向导。');
        }

        const note = this.stepContainer.createDiv();
        note.style.fontSize = '0.85em';
        note.style.color = 'var(--text-muted)';
        note.style.marginTop = '12px';
        note.setText('提示：旧凭据仍可用于解密尚未迁移的文件。如需完全切换，请重新运行此向导。');

        const closeBtn = this.stepContainer.createEl('button', { text: '完成', cls: 'mod-cta' });
        closeBtn.style.marginTop = '16px';
        closeBtn.onclick = () => {
            // 迁移完成后触发重绘
            this.plugin.decryptCache.clear();
            this.plugin.readingViewProcessor.rerenderAll();
            this.plugin.cm6Extension.invalidateDecryptions();
            this.close();
        };
    }

    // ── 扫描中和执行中的占位渲染 ──

    private renderScanning(): void {
        this.stepContainer.createEl('h2', { text: '正在扫描...' });
    }

    private renderExecuting(): void {
        this.stepContainer.createEl('h2', { text: '正在执行迁移...' });
    }

    onClose() {
        this.stepContainer.empty();
    }
}
