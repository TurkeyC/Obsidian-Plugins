export class PasswordManager {
    private password: string | null = null;
    private listeners: Map<string, Set<() => void>> = new Map();

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
