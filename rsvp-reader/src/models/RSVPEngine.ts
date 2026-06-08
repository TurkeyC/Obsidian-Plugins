import { TextProcessor } from './TextProcessor';
import { ReadingData } from './ReadingData';

interface WordData {
  word: string;
  isWikiLink: boolean;
  isKeyword: boolean;
  isPunctuation: boolean;
  focusPoint: number;
  paragraphBreak: boolean;
}

export class RSVPEngine {
  private settings: any;
  private textProcessor: TextProcessor;
  private words: WordData[] = [];
  private currentPosition: number = 0;
  private paragraphBreakPoints: number[] = [];
  
  constructor(settings: any, textProcessor: TextProcessor) {
    this.settings = settings;
    this.textProcessor = textProcessor;
  }
  
  updateSettings(settings: any) {
    this.settings = settings;
  }
  
  processText(text: string, initialPosition?: { line: number, ch: number }) {
    // 使用TextProcessor处理文本
    const processedText = this.textProcessor.processMarkdown(text);
    
    // 分割成单词
    this.words = [];
    this.paragraphBreakPoints = [];
    
    let startPosition = 0;
    let currentWordIndex = 0;
    
    // 如果提供了初始位置，计算对应的单词索引
    if (initialPosition) {
      const textBefore = text.split('\n').slice(0, initialPosition.line).join('\n') + 
                          text.split('\n')[initialPosition.line].substring(0, initialPosition.ch);
      startPosition = this.textProcessor.approximateWordPosition(text, textBefore);
    }
    
    // 处理每个段落
    processedText.paragraphs.forEach((paragraph, pIndex) => {
      // 处理段落中的每个单词
      paragraph.words.forEach((word, wIndex) => {
        // 计算最佳焦点位置（ORP - Optimal Recognition Point）
        const focusPoint = this.calculateFocusPoint(word);
        
        this.words.push({
          word: word,
          isWikiLink: paragraph.wikiLinks.includes(word),
          isKeyword: paragraph.keywords.includes(word),
          isPunctuation: this.isPunctuation(word),
          focusPoint: focusPoint,
          paragraphBreak: false
        });
        
        currentWordIndex++;
      });
      
      // 标记段落结束
      if (this.words.length > 0) {
        this.words[this.words.length - 1].paragraphBreak = true;
        this.paragraphBreakPoints.push(this.words.length - 1);
      }
    });
    
    // 设置开始位置
    this.setCurrentPosition(startPosition);
  }
  
  getNextWord(): WordData | null {
    if (this.currentPosition >= this.words.length - 1) {
      return null;
    }
    
    this.currentPosition++;
    return this.getCurrentWordData();
  }
  
  getCurrentWordData(): WordData | null {
    if (this.currentPosition >= 0 && this.currentPosition < this.words.length) {
      return this.words[this.currentPosition];
    }
    return null;
  }
  
  getCurrentPosition(): number {
    return this.currentPosition;
  }
  
  setCurrentPosition(position: number) {
    this.currentPosition = Math.max(0, Math.min(position, this.words.length - 1));
  }
  
  getTotalWords(): number {
    return this.words.length;
  }
  
  getReadingProgress(): number {
    if (this.words.length === 0) return 0;
    return this.currentPosition / (this.words.length - 1);
  }
  
  getDisplayTimeForCurrentWord(baseSpeed: number): number {
    const wordData = this.getCurrentWordData();
    if (!wordData) return 60000 / baseSpeed; // 默认值（ms）
    
    // 基础显示时间（毫秒）
    let displayTime = 60000 / baseSpeed;
    
    // 如果启用智能暂停，且当前词是标点符号结尾
    if (this.settings.enableIntelligentPause && wordData.isPunctuation) {
      displayTime *= this.settings.pauseMultiplierForPunctuation;
    }
    
    // 如果是段落结束，额外延长时间
    if (wordData.paragraphBreak) {
      displayTime *= 1.5;
    }
    
    // 根据单词长度适当调整时间
    if (wordData.word.length > 8) {
      displayTime *= 1.2;
    }
    
    return displayTime;
  }
  
  jumpToNextParagraph() {
    // 找到下一个段落断点
    for (const breakPoint of this.paragraphBreakPoints) {
      if (breakPoint > this.currentPosition) {
        this.setCurrentPosition(breakPoint + 1);
        return;
      }
    }
    
    // 如果没有下一段，跳到末尾
    this.setCurrentPosition(this.words.length - 1);
  }
  
  jumpToPreviousParagraph() {
    // 找到上一个段落断点
    let prevBreak = 0;
    for (const breakPoint of this.paragraphBreakPoints) {
      if (breakPoint >= this.currentPosition) {
        break;
      }
      prevBreak = breakPoint;
    }
    
    this.setCurrentPosition(prevBreak);
  }
  
  generateMindmap(): string {
    // 提取文档的关键概念和结构，生成思维导图格式的Markdown
    let mindmapContent = "# 文档思维导图\n\n";
    
    // 收集关键词
    const keywords = new Set<string>();
    this.words.forEach(word => {
      if (word.isKeyword) {
        keywords.add(word.word);
      }
    });
    
    // 分析文档结构
    const structureAnalysis = this.textProcessor.analyzeDocumentStructure();
    
    // 构建思维导图
    mindmapContent += "## 核心概念\n\n";
    keywords.forEach(keyword => {
      mindmapContent += `- ${keyword}\n`;
    });
    
    mindmapContent += "\n## 文档结构\n\n";
    structureAnalysis.forEach((section, index) => {
      const indent = "  ".repeat(section.level - 1);
      mindmapContent += `${indent}- ${section.title}\n`;
    });
    
    return mindmapContent;
  }
  
  private calculateFocusPoint(word: string): number {
    // 计算单词的最佳焦点位置
    // 通常是单词长度的1/3处（四舍五入）
    const wordLength = word.length;
    
    if (wordLength <= 1) return 0;
    
    return Math.min(Math.floor(wordLength / 3), 2);
  }
  
  private isPunctuation(word: string): boolean {
    // 检查词是否以标点符号结尾
    const punctuations = ['.', ',', '!', '?', ';', ':', '。', '，', '！', '？', '；', '：', '、'];
    return punctuations.includes(word[word.length - 1]);
  }
}