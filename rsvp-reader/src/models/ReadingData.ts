export interface ReadingSession {
  fileId: string;
  fileName: string;
  startTimestamp: number;
  endTimestamp: number;
  duration: number;
  startPosition: number;
  endPosition: number;
  wordsRead: number;
  averageSpeed: number;
}

export interface ReadingStat {
  totalSessions: number;
  totalTimeSpent: number;
  totalWordsRead: number;
  averageSpeed: number;
  lastReadDate: number;
}

export class ReadingData {
  private sessions: ReadingSession[] = [];
  private stats: Map<string, ReadingStat> = new Map();
  
  constructor() {
    // 初始化
  }
  
  addSession(session: ReadingSession) {
    this.sessions.push(session);
    this.updateStats(session);
  }
  
  private updateStats(session: ReadingSession) {
    // 获取现有的统计数据或创建新的
    const existingStat = this.stats.get(session.fileId) || {
      totalSessions: 0,
      totalTimeSpent: 0,
      totalWordsRead: 0,
      averageSpeed: 0,
      lastReadDate: 0
    };
    
    // 更新统计
    existingStat.totalSessions += 1;
    existingStat.totalTimeSpent += session.duration;
    existingStat.totalWordsRead += session.wordsRead;
    existingStat.averageSpeed = existingStat.totalWordsRead / (existingStat.totalTimeSpent / 60000);
    existingStat.lastReadDate = Math.max(existingStat.lastReadDate, session.endTimestamp);
    
    // 保存回映射
    this.stats.set(session.fileId, existingStat);
  }
  
  getFileStat(fileId: string): ReadingStat | undefined {
    return this.stats.get(fileId);
  }
  
  getAllStats(): Map<string, ReadingStat> {
    return this.stats;
  }
  
  getRecentSessions(count: number = 10): ReadingSession[] {
    // 返回最近的阅读会话，按时间降序排序
    return [...this.sessions]
      .sort((a, b) => b.endTimestamp - a.endTimestamp)
      .slice(0, count);
  }
  
  // 生成统计报告
  generateReport(): string {
    const now = new Date();
    let report = `# 阅读统计报告\n\n`;
    report += `生成时间: ${now.toLocaleString()}\n\n`;
    
    // 总体统计
    const totalWordsRead = Array.from(this.stats.values())
      .reduce((sum, stat) => sum + stat.totalWordsRead, 0);
    
    const totalTimeSpent = Array.from(this.stats.values())
      .reduce((sum, stat) => sum + stat.totalTimeSpent, 0);
    
    const overallAvgSpeed = totalWordsRead / (totalTimeSpent / 60000);
    
    report += `## 总体统计\n\n`;
    report += `- 总阅读量: ${totalWordsRead} 词\n`;
    report += `- 总阅读时间: ${(totalTimeSpent / 60000).toFixed(1)} 分钟\n`;
    report += `- 平均阅读速度: ${Math.round(overallAvgSpeed)} 词/分钟\n\n`;
    
    // 最近阅读的文档
    report += `## 最近阅读\n\n`;
    const recentSessions = this.getRecentSessions(5);
    
    recentSessions.forEach(session => {
      const date = new Date(session.endTimestamp).toLocaleDateString();
      report += `- ${session.fileName} (${date}): ${session.wordsRead}词，${Math.round(session.averageSpeed)}wpm\n`;
    });
    
    return report;
  }
}