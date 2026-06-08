import { Plugin, WorkspaceLeaf, MarkdownView } from 'obsidian';
import { RSVPSettingTab } from './src/settings/RSVPSettingTab';
import { RSVPView } from './src/components/RSVPView';
import { RSVPEngine } from './src/models/RSVPEngine';
import { TextProcessor } from './src/models/TextProcessor';
import { DataPersister } from './src/utils/DataPersister';

interface RSVPSettings {
  defaultSpeed: number;
  enableIntelligentPause: boolean;
  pauseMultiplierForPunctuation: number;
  highlightFocusWord: boolean;
  enableBreathingGuide: boolean;
  enableSoundFeedback: boolean;
  focusWordColor: string;
  beforeFocusColor: string;
  afterFocusColor: string;
  fontSize: number;
  persistReadingProgress: boolean;
  enableMindmapGeneration: boolean;
  useChineseTokenizer: boolean;
}

const DEFAULT_SETTINGS: RSVPSettings = {
  defaultSpeed: 400,
  enableIntelligentPause: true,
  pauseMultiplierForPunctuation: 1.5,
  highlightFocusWord: true,
  enableBreathingGuide: false,
  enableSoundFeedback: false,
  focusWordColor: '#ff5555',
  beforeFocusColor: '#aaaaaa',
  afterFocusColor: '#aaaaaa',
  fontSize: 24,
  persistReadingProgress: true,
  enableMindmapGeneration: false,
  useChineseTokenizer: true
}

export default class RSVPReaderPlugin extends Plugin {
  settings: RSVPSettings;
  engine: RSVPEngine;
  textProcessor: TextProcessor;
  dataPersister: DataPersister;
  rsvpView: RSVPView | null = null;
  
  async onload() {
    console.log('加载 RSVP 速读增强插件');
    
    await this.loadSettings();
    
    // 初始化组件
    this.textProcessor = new TextProcessor(this.settings.useChineseTokenizer);
    this.dataPersister = new DataPersister(this);
    this.engine = new RSVPEngine(this.settings, this.textProcessor);
    
    // 添加图标到编辑器菜单
    this.addRibbonIcon('play-circle', '启动速读模式', async (evt: MouseEvent) => {
      this.activateRSVPReader();
    });

    // 添加命令
    this.addCommand({
      id: 'start-rsvp-reader',
      name: '启动速读模式',
      editorCallback: (editor, view) => {
        this.activateRSVPReader();
      }
    });
    
    this.addCommand({
      id: 'increase-rsvp-speed',
      name: '提高速读速度',
      callback: () => {
        if (this.rsvpView) {
          this.rsvpView.increaseSpeed(50);
        }
      }
    });
    
    this.addCommand({
      id: 'decrease-rsvp-speed',
      name: '降低速读速度',
      callback: () => {
        if (this.rsvpView) {
          this.rsvpView.decreaseSpeed(50);
        }
      }
    });
    
    // 添加设置选项卡
    this.addSettingTab(new RSVPSettingTab(this.app, this));
    
    // 注册事件监听
    this.registerDomEvent(document, 'keydown', (evt: KeyboardEvent) => {
      if (this.rsvpView && evt.key === ' ') {
        this.rsvpView.togglePause();
        evt.preventDefault();
      }
    });
  }
  
  onunload() {
    console.log('卸载 RSVP 速读增强插件');
    if (this.rsvpView) {
      this.rsvpView.destroy();
    }
  }
  
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  
  async saveSettings() {
    await this.saveData(this.settings);
    
    // 如果引擎已初始化，更新设置
    if (this.engine) {
      this.engine.updateSettings(this.settings);
    }
  }
  
  activateRSVPReader() {
    const activeLeaf = this.app.workspace.activeLeaf;
    if (activeLeaf) {
      const view = activeLeaf.view;
      if (view instanceof MarkdownView) {
        const editor = view.editor;
        const cursorPos = editor.getCursor();
        const fileContent = editor.getValue();
        const fileName = view.file?.basename || "未命名";
        
        // 如果已有速读视图，先销毁它
        if (this.rsvpView) {
          this.rsvpView.destroy();
        }
        
        // 创建RSVP视图
        this.rsvpView = new RSVPView({
          content: fileContent,
          fileName: fileName,
          initialPosition: cursorPos,
          container: document.body,
          plugin: this,
          engine: this.engine,
          dataPersister: this.dataPersister,
          file: view.file
        });
        
        this.rsvpView.render();
        
        // 从上次阅读位置恢复
        if (this.settings.persistReadingProgress && view.file) {
          this.dataPersister.loadReadingProgress(view.file).then(progress => {
            if (progress && this.rsvpView) {
              this.rsvpView.setReadingPosition(progress.position);
            }
          });
        }
      } else {
        // 提示用户当前不是Markdown视图
        new Notice('请在Markdown编辑区域中使用速读功能');
      }
    }
  }
}