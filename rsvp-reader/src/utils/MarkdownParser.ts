export class MarkdownParser {
  // 处理Markdown文本，提取纯文本内容和结构
  
  cleanMarkdown(markdown: string): { cleanText: string, wikiLinks: string[] } {
    let cleanText = markdown;
    const wikiLinks: string[] = [];
    
    // 提取Wiki链接 [[链接]]
    const wikiLinkRegex = /\[\[([^\]]+)\]\]/g;
    let match;
    while (match = wikiLinkRegex.exec(markdown)) {
      const linkText = match[1].split('|')[0];
      wikiLinks.push(linkText);
      
      // 在清理后的文本中保留链接文字
      const displayText = match[1].includes('|') ? match[1].split('|')[1] : linkText;
      cleanText = cleanText.replace(match[0], displayText);
    }
    
    // 移除代码块
    cleanText = cleanText.replace(/```[\s\S]*?```/g, '');
    
    // 移除行内代码
    cleanText = cleanText.replace(/`[^`]*`/g, '');
    
    // 移除图片
    cleanText = cleanText.replace(/!\[([^\]]*)\]\([^)]+\)/g, '');
    
    // 处理普通链接 [文字](链接)
    cleanText = cleanText.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    
    // 移除HTML标签
    cleanText = cleanText.replace(/<[^>]*>/g, '');
    
    // 处理粗体和斜体
    cleanText = cleanText.replace(/(\*\*|__)(.*?)\1/g, '$2');
    cleanText = cleanText.replace(/(\*|_)(.*?)\1/g, '$2');
    
    // 移除水平线
    cleanText = cleanText.replace(/^\s*[-*_]{3,}\s*$/gm, '\n');
    
    // 处理标题
    cleanText = cleanText.replace(/^#+\s+(.*?)$/gm, '$1\n');
    
    return { cleanText, wikiLinks };
  }
  
  parseDocumentStructure(markdown: string): { level: number, title: string, position: number }[] {
    const structure: { level: number, title: string, position: number }[] = [];
    
    // 匹配标题
    const headingRegex = /^(#{1,6})\s+(.*?)$/gm;
    let match;
    
    while (match = headingRegex.exec(markdown)) {
      const level = match[1].length;
      const title = match[2].trim();
      const position = match.index;
      
      structure.push({ level, title, position });
    }
    
    return structure;
  }
}