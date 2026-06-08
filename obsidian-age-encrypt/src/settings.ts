export interface AgeEncryptSettings {
    excludeFrontmatter: boolean;
    autoDecryptOnLoad: boolean;
    showEditIndicator: boolean;
}

export const DEFAULT_SETTINGS: AgeEncryptSettings = {
    excludeFrontmatter: true,
    autoDecryptOnLoad: true,
    showEditIndicator: true,
};
