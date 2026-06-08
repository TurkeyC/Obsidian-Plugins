import { ChineseTokenizer } from '../utils/ChineseTokenizer';
import { MarkdownParser } from '../utils/MarkdownParser';

interface ParagraphData {
  words: string[];
  wikiLinks: string[];
  keywords: string[];
}

interface DocumentStructure {
  level: number;  // 标题级别 (1-6)
  title: string;
  position: number;
}

export class TextProcessor {
  private chineseTokenizer: ChineseTokenizer;
  private markdownParser: MarkdownParser;
  private useChineseTokenizer: boolean;
  private rawText: string = "";
  private processedStructure: DocumentStructure[] = [];
  
  constructor(useChineseTokenizer: boolean) {
    this.useChineseTokenizer = useChineseTokenizer;
    this.chineseTokenizer = new ChineseTokenizer();
    this.markdownParser = new MarkdownParser();
  }
  
  processMarkdown(text: string): { paragraphs: ParagraphData[] } {
    this.rawText = text;
    
    // 解析Markdown文档结构
    this.processedStructure = this.markdownParser.parseDocumentStructure(text);
    
    // 使用MarkdownParser提取纯文本和Wiki链接
    const { cleanText, wikiLinks } = this.markdownParser.cleanMarkdown(text);
    
    // 提取关键词
    const keywords = this.extractKeywords(cleanText);
    
    // 分割成段落
    const paragraphs: ParagraphData[] = [];
    
    // 按段落分割文本
    const paragraphTexts = cleanText.split(/\n\s*\n/);
    
    paragraphTexts.forEach(paragraphText => {
      if (!paragraphText.trim()) return;
      
      // 处理单词
      const words = this.tokenizeText(paragraphText);
      
      // 找出段落中的Wiki链接
      const paragraphWikiLinks = this.findWikiLinksInParagraph(paragraphText, wikiLinks);
      
      // 找出段落中的关键词
      const paragraphKeywords = this.findKeywordsInParagraph(paragraphText, keywords);
      
      paragraphs.push({
        words,
        wikiLinks: paragraphWikiLinks,
        keywords: paragraphKeywords
      });
    });
    
    return { paragraphs };
  }
  
  approximateWordPosition(fullText: string, textBeforeCursor: string): number {
    // 处理全文
    const { paragraphs } = this.processMarkdown(fullText);
    
    // 将所有单词展平成一个数组
    const allWords = paragraphs.flatMap(p => p.words);
    
    // 处理光标之前的文本
    const { paragraphs: beforeCursorParagraphs } = this.processMarkdown(textBeforeCursor);
    const beforeCursorWords = beforeCursorParagraphs.flatMap(p => p.words);
    
    // 返回大致位置（可能不完全准确，但足够接近）
    return Math.min(beforeCursorWords.length, allWords.length - 1);
  }
  
  analyzeDocumentStructure(): DocumentStructure[] {
    return this.processedStructure;
  }
  
  private tokenizeText(text: string): string[] {
    // 中文处理
    if (this.useChineseTokenizer && this.containsChinese(text)) {
      return this.chineseTokenizer.tokenize(text);
    } 
    
    // 英文和其他语言处理
    return text.trim()
      .split(/\s+/)
      .filter(word => word.length > 0);
  }
  
  private containsChinese(text: string): boolean {
    // 检测文本是否包含中文字符
    const chineseRegex = /[\u4e00-\u9fa5]/;
    return chineseRegex.test(text);
  }
  
  private extractKeywords(text: string): string[] {
    // 这里简单使用词频分析提取关键词
    // 实际应用中可以用更复杂的算法，如TF-IDF
    
    // 移除常见停用词
    const stopwords = new Set(['的', '是', '在', '了', '和', '与', '或', '对', '且', 'the', 'a', 'an', 'is', 'are', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'of', 'and', 'or']);
    
    // 分词
    const words = this.tokenizeText(text);
    
    // 计算词频
    const wordCounts: Record<string, number> = {};
    words.forEach(word => {
      if (!stopwords.has(word.toLowerCase()) && word.length > 1) {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
      }
    });
    
    // 按频率排序
    const sortedWords = Object.entries(wordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(entry => entry[0]);
    
    return sortedWords;
  }
  
  private findWikiLinksInParagraph(paragraphText: string, allWikiLinks: string[]): string[] {
    // 找出段落中包含的Wiki链接
    return allWikiLinks.filter(link => paragraphText.includes(link));
  }
  
  private findKeywordsInParagraph(paragraphText: string, allKeywords: string[]): string[] {
    // 找出段落中包含的关键词
    return allKeywords.filter(keyword => paragraphText.includes(keyword));
  }
}