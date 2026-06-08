export interface AgeEncryptSettings {
    excludeFrontmatter: boolean;
    autoDecryptOnLoad: boolean;
    showEditIndicator: boolean;
    // 加密模式: 'password' | 'key'
    encryptionMode: 'password' | 'key';
    // 公钥（可持久化，用于密钥模式加密）
    recipientKey?: string;
    // 密钥文件路径（用于自动加载私钥）
    identityKeyPath?: string;
    // 是否将密码保存到 data.json（重启后仍有效）
    savePassword: boolean;
    // 保存的密码（仅在 savePassword 为 true 时持久化）
    savedPassword?: string;
}

export const DEFAULT_SETTINGS: AgeEncryptSettings = {
    excludeFrontmatter: true,
    autoDecryptOnLoad: true,
    showEditIndicator: true,
    encryptionMode: 'password',
    savePassword: false,
};
