import { TFile } from 'obsidian';
import RSVPReaderPlugin from '../../main';

export interface ReadingProgress {
  position: number;
  timestamp: number;
}

export class DataPersister {
  private plugin: RSVPReaderPlugin;
  private readingProgressMap: Map<string, ReadingProgress> = new Map();
  
  constructor(plugin: RSVPReaderPlugin) {
    this.plugin = plugin;
    this.loadAllReadingProgress();
  }
  
  async saveReadingProgress(file: TFile, progress: ReadingProgress) {
    // 保存到内存
    this.readingProgressMap.set(file.path, progress);
    
    // 保存到数据存储
    await this.saveAllReadingProgress();
    
    // 更新文件的frontmatter（如果启用）
    if (this.plugin.settings.updateFileFrontmatter) {
      await this.updateFileFrontmatter(file, progress);
    }
  }
  
  async loadReadingProgress(file: TFile): Promise<ReadingProgress | undefined> {
    return this.readingProgressMap.get(file.path);
  }
  
  private async loadAllReadingProgress() {
    const data = await this.plugin.loadData();
    if (data && data.readingProgress) {
      Object.entries(data.readingProgress).forEach(([path, progress]) => {
        this.readingProgressMap.set(path, progress as ReadingProgress);
      });
    }
  }
  
  private async saveAllReadingProgress() {
    const data = await this.plugin.loadData() || {};
    data.readingProgress = {};
    
    this.readingProgressMap.forEach((progress, path) => {
      data.readingProgress[path] = progress;
    });
    
    await this.plugin.saveData(data);
  }
  
  private async updateFileFrontmatter(file: TFile, progress: ReadingProgress) {
    // 读取文件内容
    const content = await this.plugin.app.vault.read(file);
    
    // 检查是否有frontmatter
    const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
    const match = content.match(frontmatterRegex);
    
    let newContent;
    const readingTime = new Date(progress.timestamp).toISOString();
    const readingProgressPercentage = progress.position; // 可以计算为百分比
    
    if (match) {
      // 更新现有frontmatter
      let frontmatter = match[1];
      
      // 更新或添加rsvp_last_position
      if (frontmatter.includes('rsvp_last_position:')) {
        frontmatter = frontmatter.replace(/rsvp_last_position:.*$/m, `rsvp_last_position: ${progress.position}`);
      } else {
        frontmatter += `\nrsvp_last_position: ${progress.position}`;
      }
      
      // 更新或添加rsvp_last_read
      if (frontmatter.includes('rsvp_last_read:')) {
        frontmatter = frontmatter.replace(/rsvp_last_read:.*$/m, `rsvp_last_read: ${readingTime}`);
      } else {
        frontmatter += `\nrsvp_last_read: ${readingTime}`;
      }
      
      newContent = content.replace(frontmatterRegex, `---\n${frontmatter}\n---`);
    } else {
      // 创建新的frontmatter
      const newFrontmatter = `---
rsvp_last_position: ${progress.position}
rsvp_last_read: ${readingTime}
---`;
      newContent = `${newFrontmatter}\n\n${content}`;
    }
    
    // 更新文件
    await this.plugin.app.vault.modify(file, newContent);
  }
}