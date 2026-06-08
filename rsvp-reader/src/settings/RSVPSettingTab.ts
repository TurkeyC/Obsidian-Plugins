import { App, PluginSettingTab, Setting } from 'obsidian';
import RSVPReaderPlugin from '../../main';

export class RSVPSettingTab extends PluginSettingTab {
  plugin: RSVPReaderPlugin;
  
  constructor(app: App, plugin: RSVPReaderPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  
  display(): void {
    const { containerEl } = this;
    
    containerEl.empty();
    
    containerEl.createEl('h2', { text: 'RSVP 速读增强 - 设置' });
    
    // 基础阅读设置
    containerEl.createEl('h3', { text: '核心阅读设置' });
    
    new Setting(containerEl)
      .setName('默认阅读速度')
      .setDesc('初始阅读速度 (单词/分钟)')
      .addSlider(slider => slider
        .setLimits(200, 1200, 50)
        .setValue(this.plugin.settings.defaultSpeed)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.defaultSpeed = value;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('智能暂停')
      .setDesc('在标点符号处自动延长停留时间')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enableIntelligentPause)
        .onChange(async (value) => {
          this.plugin.settings.enableIntelligentPause = value;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('标点停留倍数')
      .setDesc('标点符号处停留时间的倍数')
      .addSlider(slider => slider
        .setLimits(1, 3, 0.1)
        .setValue(this.plugin.settings.pauseMultiplierForPunctuation)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.pauseMultiplierForPunctuation = value;
          await this.plugin.saveSettings();
        }));
    
    // 视觉体验设置
    containerEl.createEl('h3', { text: '视觉与交互' });
    
    new Setting(containerEl)
      .setName('焦点词高亮')
      .setDesc('突出显示当前阅读的词')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.highlightFocusWord)
        .onChange(async (value) => {
          this.plugin.settings.highlightFocusWord = value;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('焦点词颜色')
      .setDesc('阅读焦点词的颜色')
      .addColorPicker(color => color
        .setValue(this.plugin.settings.focusWordColor)
        .onChange(async (value) => {
          this.plugin.settings.focusWordColor = value;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('前词颜色')
      .setDesc('焦点词前部分的颜色')
      .addColorPicker(color => color
        .setValue(this.plugin.settings.beforeFocusColor)
        .onChange(async (value) => {
          this.plugin.settings.beforeFocusColor = value;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('后词颜色')
      .setDesc('焦点词后部分的颜色')
      .addColorPicker(color => color
        .setValue(this.plugin.settings.afterFocusColor)
        .onChange(async (value) => {
          this.plugin.settings.afterFocusColor = value;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('字体大小')
      .setDesc('阅读文字的大小(像素)')
      .addSlider(slider => slider
        .setLimits(16, 48, 2)
        .setValue(this.plugin.settings.fontSize)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.fontSize = value;
          await this.plugin.saveSettings();
        }));
    
    // 认知增强设置
    containerEl.createEl('h3', { text: '认知增强功能' });
    
    new Setting(containerEl)
      .setName('呼吸引导')
      .setDesc('根据阅读速度提供呼吸节奏引导')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enableBreathingGuide)
        .onChange(async (value) => {
          this.plugin.settings.enableBreathingGuide = value;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('音效反馈')
      .setDesc('为关键操作提供环境音效')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enableSoundFeedback)
        .onChange(async (value) => {
          this.plugin.settings.enableSoundFeedback = value;
          await this.plugin.saveSettings();
        }));
    
    // 数据与集成设置
    containerEl.createEl('h3', { text: '数据与集成' });
    
    new Setting(containerEl)
      .setName('保存阅读进度')
      .setDesc('记住每个文件的阅读位置')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.persistReadingProgress)
        .onChange(async (value) => {
          this.plugin.settings.persistReadingProgress = value;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('思维导图生成')
      .setDesc('阅读后自动生成文档思维导图')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enableMindmapGeneration)
        .onChange(async (value) => {
          this.plugin.settings.enableMindmapGeneration = value;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('中文分词支持')
      .setDesc('启用中文智能分词（推荐中文用户开启）')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.useChineseTokenizer)
        .onChange(async (value) => {
          this.plugin.settings.useChineseTokenizer = value;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('更新笔记元数据')
      .setDesc('将阅读进度保存到笔记的frontmatter')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.updateFileFrontmatter || false)
        .onChange(async (value) => {
          this.plugin.settings.updateFileFrontmatter = value;
          await this.plugin.saveSettings();
        }));

    // 关于与反馈
    containerEl.createEl('h3', { text: '关于与帮助' });
    
    containerEl.createEl('p', {
      text: 'RSVP 速读增强插件结合了RSVP(Rapid Serial Visual Presentation)技术与Obsidian的强大知识管理功能，旨在提升您的阅读效率。'
    });
    
    containerEl.createEl('p', {
      text: '如果您喜欢这个插件，请考虑给项目点个星标。'
    });
    
    new Setting(containerEl)
      .setName('使用说明')
      .setDesc('查看插件详细使用指南')
      .addButton(button => button
        .setButtonText('打开教程')
        .onClick(() => {
          const tutorialFileName = 'RSVP-速读增强-使用指南.md';
          const tutorialPath = normalizePath(tutorialFileName);
          
          // 检查教程文件是否存在
          this.app.vault.adapter.exists(tutorialPath).then(exists => {
            if (!exists) {
              // 如果不存在，创建教程文件
              this.createTutorialFile(tutorialPath).then(() => {
                this.openTutorialFile(tutorialPath);
              });
            } else {
              this.openTutorialFile(tutorialPath);
            }
          });
        }));
  }
  
  async createTutorialFile(path: string) {
    const content = `# RSVP 速读增强 使用指南

## 什么是RSVP阅读法？

RSVP (Rapid Serial Visual Presentation) 是一种快速连续视觉呈现技术，通过逐个显示单词来消除眼球移动，可以显著提高阅读速度。

## 基础操作

1. **启动速读**: 
   - 点击ribbon栏的速读图标
   - 或使用命令面板执行"启动速读模式"

2. **控制阅读**:
   - 暂停/继续: 空格键或点击播放/暂停按钮
   - 加速/减速: 点击🐇/🐢按钮或使用左右滑动手势
   - 跳转段落: 点击⏮/⏭按钮或使用上下滑动手势

## 提高效率的小技巧

- 从低速开始(300wpm)，逐渐提高到舒适值
- 使用呼吸引导功能保持专注
- 对重要文档阅读后生成思维导图
- 配合间隔复习系统使用

## 高级功能

- **智能暂停**: 在标点处自动延长停留
- **进度保存**: 记住每个文件的阅读位置
- **中文分词**: 针对中文内容的智能分词
- **思维导图**: 阅读后生成文档结构图

祝您阅读愉快！`;

    await this.app.vault.create(path, content);
  }
  
  openTutorialFile(path: string) {
    // 尝试打开教程文件
    let fileOpened = false;
    
    this.app.workspace.iterateAllLeaves(leaf => {
      if (fileOpened) return;
      
      const file = this.app.vault.getAbstractFileByPath(path);
      if (file && file instanceof TFile) {
        leaf.openFile(file);
        fileOpened = true;
      }
    });
    
    if (!fileOpened) {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (file && file instanceof TFile) {
        this.app.workspace.openLinkText(path, '', false);
      }
    }
  }
}