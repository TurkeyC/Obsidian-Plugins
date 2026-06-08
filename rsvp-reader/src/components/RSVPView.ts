import { TFile, normalizePath } from 'obsidian';
import { RSVPEngine } from '../models/RSVPEngine';
import { DataPersister } from '../utils/DataPersister';
import { RSVPControl } from './RSVPControl';
import RSVPReaderPlugin from '../../main';

interface RSVPViewOptions {
  content: string;
  fileName: string;
  initialPosition: { line: number, ch: number };
  container: HTMLElement;
  plugin: RSVPReaderPlugin;
  engine: RSVPEngine;
  dataPersister: DataPersister;
  file: TFile | null;
}

export class RSVPView {
  private content: string;
  private fileName: string;
  private initialPosition: { line: number, ch: number };
  private container: HTMLElement;
  private viewEl: HTMLElement;
  private wordEl: HTMLElement;
  private engine: RSVPEngine;
  private plugin: RSVPReaderPlugin;
  private dataPersister: DataPersister;
  private file: TFile | null;
  private currentPosition: number = 0;
  private isPaused: boolean = true;
  private currentSpeed: number;
  private control: RSVPControl;
  
  constructor(options: RSVPViewOptions) {
    this.content = options.content;
    this.fileName = options.fileName;
    this.initialPosition = options.initialPosition;
    this.container = options.container;
    this.plugin = options.plugin;
    this.engine = options.engine;
    this.dataPersister = options.dataPersister;
    this.file = options.file;
    this.currentSpeed = this.plugin.settings.defaultSpeed;
    
    // 创建视图元素
    this.viewEl = document.createElement('div');
    this.viewEl.classList.add('rsvp-reader-container');
    
    // 创建内容显示区域
    const displayContainer = document.createElement('div');
    displayContainer.classList.add('rsvp-display-container');
    
    // 创建中央词显示元素
    this.wordEl = document.createElement('div');
    this.wordEl.classList.add('rsvp-word');
    this.wordEl.style.fontSize = `${this.plugin.settings.fontSize}px`;
    
    displayContainer.appendChild(this.wordEl);
    this.viewEl.appendChild(displayContainer);
    
    // 创建控制面板
    this.control = new RSVPControl({
      container: this.viewEl,
      plugin: this.plugin,
      onPlay: () => this.play(),
      onPause: () => this.pause(),
      onClose: () => this.destroy(),
      onSpeedChange: (speed) => this.setSpeed(speed),
      onProgressChange: (progress) => this.setProgress(progress),
      onJumpParagraph: (forward) => this.jumpParagraph(forward)
    });
    
    // 注册手势支持
    this.registerGestures();
  }
  
  render() {
    // 添加到DOM
    this.container.appendChild(this.viewEl);
    
    // 处理文本内容
    this.engine.processText(this.content, this.initialPosition);
    
    // 渲染控制面板
    this.control.render(this.fileName, this.currentSpeed);
    
    // 显示第一个词
    this.showCurrentWord();
  }
  
  play() {
    this.isPaused = false;
    this.control.updatePlayState(false);
    this.readNextWord();
  }
  
  pause() {
    this.isPaused = true;
    this.control.updatePlayState(true);
  }
  
  togglePause() {
    if (this.isPaused) {
      this.play();
    } else {
      this.pause();
    }
  }
  
  destroy() {
    // 保存阅读进度
    if (this.plugin.settings.persistReadingProgress && this.file) {
      this.dataPersister.saveReadingProgress(this.file, {
        position: this.currentPosition,
        timestamp: Date.now()
      });
    }
    
    // 停止阅读
    this.pause();
    
    // 移除DOM元素
    if (this.viewEl && this.viewEl.parentElement) {
      this.viewEl.parentElement.removeChild(this.viewEl);
    }
    
    // 清除引用
    this.plugin.rsvpView = null;
  }
  
  increaseSpeed(amount: number) {
    this.setSpeed(this.currentSpeed + amount);
  }
  
  decreaseSpeed(amount: number) {
    this.setSpeed(Math.max(200, this.currentSpeed - amount));
  }
  
  setSpeed(speed: number) {
    this.currentSpeed = Math.min(1200, Math.max(200, speed));
    this.control.updateSpeed(this.currentSpeed);
  }
  
  setReadingPosition(position: number) {
    this.currentPosition = position;
    this.engine.setCurrentPosition(position);
    this.showCurrentWord();
    this.control.updateProgress(this.engine.getReadingProgress());
  }
  
  setProgress(progress: number) {
    const position = Math.floor(progress * this.engine.getTotalWords());
    this.setReadingPosition(position);
  }
  
  jumpParagraph(forward: boolean) {
    if (forward) {
      this.engine.jumpToNextParagraph();
    } else {
      this.engine.jumpToPreviousParagraph();
    }
    this.currentPosition = this.engine.getCurrentPosition();
    this.showCurrentWord();
    this.control.updateProgress(this.engine.getReadingProgress());
  }
  
  private readNextWord() {
    if (this.isPaused) return;
    
    // 获取下一个词
    const nextWord = this.engine.getNextWord();
    
    if (nextWord) {
      // 更新当前位置
      this.currentPosition = this.engine.getCurrentPosition();
      
      // 显示当前词
      this.showCurrentWord();
      
      // 更新进度条
      this.control.updateProgress(this.engine.getReadingProgress());
      
      // 计算显示时间（考虑智能暂停）
      const displayTime = this.engine.getDisplayTimeForCurrentWord(this.currentSpeed);
      
      // 呼吸引导
      if (this.plugin.settings.enableBreathingGuide) {
        this.updateBreathingGuide();
      }
      
      // 计划下一个词的显示
      setTimeout(() => this.readNextWord(), displayTime);
    } else {
      // 阅读完成
      this.pause();
      this.control.showCompletionMessage();
      
      // 生成思维导图（如果启用）
      if (this.plugin.settings.enableMindmapGeneration) {
        this.generateMindmap();
      }
    }
  }
  
  private showCurrentWord() {
    const wordData = this.engine.getCurrentWordData();
    
    if (!wordData) return;
    
    // 清空当前显示
    this.wordEl.innerHTML = '';
    
    if (this.plugin.settings.highlightFocusWord) {
      // 创建三部分：前焦点、焦点、后焦点
      const beforeFocus = document.createElement('span');
      beforeFocus.classList.add('rsvp-before-focus');
      beforeFocus.style.color = this.plugin.settings.beforeFocusColor;
      beforeFocus.textContent = wordData.word.substring(0, wordData.focusPoint);
      
      const focus = document.createElement('span');
      focus.classList.add('rsvp-focus');
      focus.style.color = this.plugin.settings.focusWordColor;
      focus.textContent = wordData.word.charAt(wordData.focusPoint);
      
      const afterFocus = document.createElement('span');
      afterFocus.classList.add('rsvp-after-focus');
      afterFocus.style.color = this.plugin.settings.afterFocusColor;
      afterFocus.textContent = wordData.word.substring(wordData.focusPoint + 1);
      
      this.wordEl.appendChild(beforeFocus);
      this.wordEl.appendChild(focus);
      this.wordEl.appendChild(afterFocus);
    } else {
      // 简单显示完整单词
      this.wordEl.textContent = wordData.word;
    }
    
    // 如果是双链接，显示特殊样式
    if (wordData.isWikiLink) {
      this.wordEl.classList.add('rsvp-wikilink');
    } else {
      this.wordEl.classList.remove('rsvp-wikilink');
    }
    
    // 如果是关键词，显示特殊样式
    if (wordData.isKeyword) {
      this.wordEl.classList.add('rsvp-keyword');
    } else {
      this.wordEl.classList.remove('rsvp-keyword');
    }
  }
  
  private updateBreathingGuide() {
    // 根据阅读速度调整呼吸节奏引导
    const wordPerSecond = this.currentSpeed / 60;
    // 呼吸引导逻辑...
  }
  
  private generateMindmap() {
    // 提取关键概念和结构，生成思维导图
    const mindmapContent = this.engine.generateMindmap();
    
    if (this.file) {
      const mindmapFileName = `${this.file.basename}-思维导图.md`;
      const mindmapPath = normalizePath(`${this.file.parent?.path || ''}/${mindmapFileName}`);
      
      // 创建思维导图文件
      this.app.vault.create(mindmapPath, mindmapContent).then(() => {
        new Notice(`已生成思维导图：${mindmapFileName}`);
      }).catch(err => {
        console.error('思维导图生成失败', err);
        new Notice('思维导图生成失败');
      });
    }
  }
  
  private registerGestures() {
    // 添加触摸手势支持
    let startX = 0;
    let startY = 0;
    
    this.viewEl.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    });
    
    this.viewEl.addEventListener('touchend', (e) => {
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      
      const diffX = endX - startX;
      const diffY = endY - startY;
      
      // 确定是水平还是垂直滑动
      if (Math.abs(diffX) > Math.abs(diffY)) {
        // 水平滑动：调整速度
        if (diffX > 50) {
          // 左划减速
          this.decreaseSpeed(50);
        } else if (diffX < -50) {
          // 右划加速
          this.increaseSpeed(50);
        }
      } else {
        // 垂直滑动：跳转段落
        if (diffY < -50) {
          // 上划跳到下一段
          this.jumpParagraph(true);
        } else if (diffY > 50) {
          // 下划回到上一段
          this.jumpParagraph(false);
        }
      }
    });
  }
}