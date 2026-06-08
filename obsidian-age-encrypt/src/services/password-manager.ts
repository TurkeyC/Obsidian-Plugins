export class PasswordManager {
    private password: string | null = null;
    private identity: string | null = null;
    private listeners: Map<string, Set<() => void>> = new Map();

    // ── 密码管理 ──

    setPassword(password: string): void {
        this.password = password;
        this.emit('changed');
    }

    getPassword(): string | null {
        return this.password;
    }

    clearPassword(): void {
        this.password = null;
        this.emit('cleared');
    }

    isPasswordSet(): boolean {
        return this.password !== null;
    }

    // ── 密钥管理 ──

    setIdentity(identity: string): void {
        this.identity = identity;
        this.emit('changed');
    }

    getIdentity(): string | null {
        return this.identity;
    }

    clearIdentity(): void {
        this.identity = null;
        this.emit('cleared');
    }

    isIdentitySet(): boolean {
        return this.identity !== null;
    }

    hasAnyCredential(): boolean {
        return this.password !== null || this.identity !== null;
    }

    // ── 统一清理 ──

    clearAll(): void {
        this.password = null;
        this.identity = null;
        this.emit('cleared');
    }

    // ── 事件系统 ──

    on(event: 'changed' | 'cleared', cb: () => void): void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(cb);
    }

    off(event: string, cb: () => void): void {
        this.listeners.get(event)?.delete(cb);
    }

    removeAllListeners(): void {
        this.listeners.clear();
    }

    private emit(event: string): void {
        this.listeners.get(event)?.forEach(cb => cb());
    }
}
