import RSVPReaderPlugin from '../../main';

interface RSVPControlOptions {
  container: HTMLElement;
  plugin: RSVPReaderPlugin;
  onPlay: () => void;
  onPause: () => void;
  onClose: () => void;
  onSpeedChange: (speed: number) => void;
  onProgressChange: (progress: number) => void;
  onJumpParagraph: (forward: boolean) => void;
}

export class RSVPControl {
  private container: HTMLElement;
  private plugin: RSVPReaderPlugin;
  private controlEl: HTMLElement;
  private speedEl: HTMLElement;
  private progressEl: HTMLElement;
  private playPauseBtn: HTMLElement;
  
  private callbacks: {
    onPlay: () => void;
    onPause: () => void;
    onClose: () => void;
    onSpeedChange: (speed: number) => void;
    onProgressChange: (progress: number) => void;
    onJumpParagraph: (forward: boolean) => void;
  };
  
  constructor(options: RSVPControlOptions) {
    this.container = options.container;
    this.plugin = options.plugin;
    this.callbacks = {
      onPlay: options.onPlay,
      onPause: options.onPause,
      onClose: options.onClose,
      onSpeedChange: options.onSpeedChange,
      onProgressChange: options.onProgressChange,
      onJumpParagraph: options.onJumpParagraph
    };
    
    // 创建控制面板元素
    this.controlEl = document.createElement('div');
    this.controlEl.classList.add('rsvp-control-panel');
    
    // 创建速度显示元素
    this.speedEl = document.createElement('div');
    this.speedEl.classList.add('rsvp-speed-display');
    
    // 创建进度条元素
    this.progressEl = document.createElement('div');
    this.progressEl.classList.add('rsvp-progress-bar');
    
    // 创建播放/暂停按钮
    this.playPauseBtn = document.createElement('button');
    this.playPauseBtn.classList.add('rsvp-play-pause-button');
    this.playPauseBtn.innerHTML = '▶';
  }
  
  render(fileName: string, initialSpeed: number) {
    // 标题
    const titleEl = document.createElement('div');
    titleEl.classList.add('rsvp-title');
    titleEl.textContent = fileName;
    this.controlEl.appendChild(titleEl);
    
    // 进度条容器
    const progressContainer = document.createElement('div');
    progressContainer.classList.add('rsvp-progress-container');
    
    // 进度条背景
    const progressBg = document.createElement('div');
    progressBg.classList.add('rsvp-progress-background');
    progressBg.appendChild(this.progressEl);
    progressContainer.appendChild(progressBg);
    
    // 为进度条添加点击事件
    progressBg.addEventListener('click', (e) => {
      const rect = progressBg.getBoundingClientRect();
      const progress = (e.clientX - rect.left) / rect.width;
      this.updateProgress(progress);
      this.callbacks.onProgressChange(progress);
    });
    
    this.controlEl.appendChild(progressContainer);
    
    // 控制按钮栏
    const controlBar = document.createElement('div');
    controlBar.classList.add('rsvp-control-bar');
    
    // 上一段按钮
    const prevBtn = document.createElement('button');
    prevBtn.classList.add('rsvp-button');
    prevBtn.innerHTML = '⏮';
    prevBtn.title = '上一段';
    prevBtn.addEventListener('click', () => this.callbacks.onJumpParagraph(false));
    controlBar.appendChild(prevBtn);
    
    // 减速按钮
    const slowDownBtn = document.createElement('button');
    slowDownBtn.classList.add('rsvp-button');
    slowDownBtn.innerHTML = '🐢';
    slowDownBtn.title = '减速';
    slowDownBtn.addEventListener('click', () => {
      const currentSpeed = parseInt(this.speedEl.textContent.replace('wpm', ''));
      this.callbacks.onSpeedChange(Math.max(200, currentSpeed - 50));
    });
    controlBar.appendChild(slowDownBtn);
    
    // 播放/暂停按钮
    this.playPauseBtn.addEventListener('click', () => {
      if (this.playPauseBtn.innerHTML === '▶') {
        this.playPauseBtn.innerHTML = '⏸';
        this.callbacks.onPlay();
      } else {
        this.playPauseBtn.innerHTML = '▶';
        this.callbacks.onPause();
      }
    });
    controlBar.appendChild(this.playPauseBtn);
    
    // 加速按钮
    const speedUpBtn = document.createElement('button');
    speedUpBtn.classList.add('rsvp-button');
    speedUpBtn.innerHTML = '🐇';
    speedUpBtn.title = '加速';
    speedUpBtn.addEventListener('click', () => {
      const currentSpeed = parseInt(this.speedEl.textContent.replace('wpm', ''));
      this.callbacks.onSpeedChange(Math.min(1200, currentSpeed + 50));
    });
    controlBar.appendChild(speedUpBtn);
    
    // 下一段按钮
    const nextBtn = document.createElement('button');
    nextBtn.classList.add('rsvp-button');
    nextBtn.innerHTML = '⏭';
    nextBtn.title = '下一段';
    nextBtn.addEventListener('click', () => this.callbacks.onJumpParagraph(true));
    controlBar.appendChild(nextBtn);
    
    // 关闭按钮
    const closeBtn = document.createElement('button');
    closeBtn.classList.add('rsvp-button', 'rsvp-close-button');
    closeBtn.innerHTML = '✖';
    closeBtn.title = '关闭';
    closeBtn.addEventListener('click', () => this.callbacks.onClose());
    controlBar.appendChild(closeBtn);
    
    this.controlEl.appendChild(controlBar);
    
    // 速度和指导显示区
    const infoBar = document.createElement('div');
    infoBar.classList.add('rsvp-info-bar');
    
    // 速度显示
    this.speedEl.textContent = `${initialSpeed}wpm`;
    infoBar.appendChild(this.speedEl);
    
    // 呼吸指导（如果启用）
    if (this.plugin.settings.enableBreathingGuide) {
      const breathEl = document.createElement('div');
      breathEl.classList.add('rsvp-breath-guide');
      breathEl.innerHTML = '🌬 <span class="breath-animation">◉</span>';
      infoBar.appendChild(breathEl);
    }
    
    this.controlEl.appendChild(infoBar);
    
    // 添加快捷键提示
    const tipEl = document.createElement('div');
    tipEl.classList.add('rsvp-tip');
    tipEl.textContent = '提示: 空格键 = 暂停/继续';
    this.controlEl.appendChild(tipEl);
    
    // 添加到容器
    this.container.appendChild(this.controlEl);
  }
  
  updateSpeed(speed: number) {
    this.speedEl.textContent = `${speed}wpm`;
    
    // 根据速度更新样式
    if (speed > 800) {
      this.speedEl.classList.add('rsvp-speed-high');
      this.speedEl.classList.remove('rsvp-speed-normal', 'rsvp-speed-low');
    } else if (speed > 400) {
      this.speedEl.classList.add('rsvp-speed-normal');
      this.speedEl.classList.remove('rsvp-speed-high', 'rsvp-speed-low');
    } else {
      this.speedEl.classList.add('rsvp-speed-low');
      this.speedEl.classList.remove('rsvp-speed-high', 'rsvp-speed-normal');
    }
  }
  
  updateProgress(progress: number) {
    const percentage = Math.min(100, Math.max(0, progress * 100));
    this.progressEl.style.width = `${percentage}%`;
    
    // 添加波浪动画效果
    this.progressEl.classList.remove('progress-wave-animation');
    void this.progressEl.offsetWidth; // 触发重排
    this.progressEl.classList.add('progress-wave-animation');
  }
  
  updatePlayState(isPaused: boolean) {
    if (isPaused) {
      this.playPauseBtn.innerHTML = '▶';
    } else {
      this.playPauseBtn.innerHTML = '⏸';
    }
  }
  
  showCompletionMessage() {
    const message = document.createElement('div');
    message.classList.add('rsvp-completion-message');
    message.textContent = '阅读完成！';
    
    // 显示体验反馈
    const feedback = document.createElement('div');
    feedback.classList.add('rsvp-feedback');
    feedback.innerHTML = '🎯 有什么感想？';
    feedback.addEventListener('click', () => {
      // 如果有复习功能，这里可以跳转到生成的笔记
    });
    
    message.appendChild(feedback);
    
    // 添加到控制面板
    this.controlEl.appendChild(message);
    
    // 3秒后自动隐藏
    setTimeout(() => {
      if (message.parentNode === this.controlEl) {
        this.controlEl.removeChild(message);
      }
    }, 3000);
  }
}