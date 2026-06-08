import { Encrypter, Decrypter, generateIdentity, identityToRecipient } from "age-encryption";

export interface EncryptionOptions {
    password?: string;
    recipient?: string;
}

export interface EncryptedBlock {
    content: string;
    hint?: string;
}

export class EncryptionService {

    private arrayBufferToBase64(buffer: Uint8Array): string {
        const base64 = btoa(String.fromCharCode(...buffer));
        return base64.replace(/(.{64})/g, '$1\n').trim();
    }

    private base64ToArrayBuffer(base64: string): Uint8Array {
        const cleanBase64 = base64.replace(/\n/g, '');
        const binary = atob(cleanBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    async encrypt(content: string, options: EncryptionOptions): Promise<string> {
        try {
            const encrypter = new Encrypter();

            if (options.recipient) {
                // 密钥模式加密
                encrypter.addRecipient(options.recipient);
            } else if (options.password) {
                // 密码模式加密
                encrypter.setPassphrase(options.password);
            } else {
                throw new Error('No encryption credential provided');
            }

            const encryptedArray = await encrypter.encrypt(content);
            return this.arrayBufferToBase64(encryptedArray);
        } catch (error: unknown) {
            console.error('Encryption failed:', error);
            throw new Error(error instanceof Error ? error.message : 'Failed to encrypt content');
        }
    }

    async decrypt(encryptedContent: string, password?: string, identity?: string): Promise<string> {
        try {
            const decrypter = new Decrypter();
            if (password) decrypter.addPassphrase(password);
            if (identity) decrypter.addIdentity(identity);

            const encryptedArray = this.base64ToArrayBuffer(encryptedContent);
            return await decrypter.decrypt(encryptedArray, "text");
        } catch (error: unknown) {
            console.error('Decryption failed:', error);
            throw new Error(error instanceof Error ? error.message : 'Failed to decrypt content');
        }
    }

    // ── 密钥对生成 ──

    async generateKeyPair(): Promise<{ identity: string; recipient: string }> {
        const identity = await generateIdentity();
        const recipient = await identityToRecipient(identity);
        return { identity, recipient };
    }

    async identityToRecipient(identity: string): Promise<string> {
        return await identityToRecipient(identity);
    }

    // ── 块格式 ──

    formatEncryptedBlock(encryptedContent: string, hint?: string): string {
        const block = [
            '```age',
            hint ? `hint: ${hint}` : '',
            '-----BEGIN AGE ENCRYPTED FILE-----',
            encryptedContent,
            '-----END AGE ENCRYPTED FILE-----',
            '```'
        ]
            .filter(line => line)
            .join('\n');

        return block;
    }

    parseEncryptedBlock(block: string): EncryptedBlock {
        const lines = block
            .split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('```'));

        if (lines.length === 0) {
            throw new Error('Invalid encrypted block format: empty content');
        }

        let hint: string | undefined;
        let contentStartIndex = 0;

        if (lines[0].startsWith('hint: ')) {
            hint = lines[0].substring(6);
            contentStartIndex = 1;
        }

        const beginIndex = lines.findIndex(line => line === '-----BEGIN AGE ENCRYPTED FILE-----');
        const endIndex = lines.findIndex(line => line === '-----END AGE ENCRYPTED FILE-----');

        if (beginIndex === -1 || endIndex === -1 || beginIndex >= endIndex) {
            throw new Error('Invalid encrypted block format: missing age markers');
        }

        const content = lines.slice(beginIndex + 1, endIndex).join('\n');

        if (!content) {
            throw new Error('Invalid encrypted block format: no content found');
        }

        return { content, hint };
    }
}
