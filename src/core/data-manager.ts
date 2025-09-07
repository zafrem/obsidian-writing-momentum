import type { WritingSession, StreakData, DashboardStats } from '../types/interfaces';
import type WritingMomentumPlugin from '../../main';

export class DataManager {
  private plugin: WritingMomentumPlugin;
  private sessions: WritingSession[] = [];
  private streak: StreakData = {
    current: 0,
    longest: 0,
    lastWritingDay: '',
    graceUsed: 0,
    weeklyProgress: []
  };

  constructor(plugin: WritingMomentumPlugin) {
    this.plugin = plugin;
  }

  async loadData() {
    const data = await this.plugin.loadData();
    if (data?.writingData) {
      this.sessions = data.writingData.sessions || [];
      this.streak = data.writingData.streak || this.getDefaultStreak();
    }
  }

  async saveData() {
    const currentData = await this.plugin.loadData() || {};
    currentData.writingData = {
      sessions: this.sessions,
      streak: this.streak,
      lastUpdated: new Date().toISOString()
    };
    await this.plugin.saveData(currentData);
  }

  private getDefaultStreak(): StreakData {
    return {
      current: 0,
      longest: 0,
      lastWritingDay: '',
      graceUsed: 0,
      weeklyProgress: new Array(7).fill(0)
    };
  }

  async addSession(session: WritingSession) {
    this.sessions.push(session);
    if (session.completed && session.wordCount > 0) {
      this.updateStreak(session.date);
    }
    await this.saveData();
  }

  async updateSession(sessionId: string, updates: Partial<WritingSession>) {
    const sessionIndex = this.sessions.findIndex(s => s.id === sessionId);
    if (sessionIndex !== -1) {
      this.sessions[sessionIndex] = { ...this.sessions[sessionIndex], ...updates };
      
      if (updates.completed && this.sessions[sessionIndex].wordCount > 0) {
        this.updateStreak(this.sessions[sessionIndex].date);
      }
      
      await this.saveData();
    }
  }

  getTodaysSessions(): WritingSession[] {
    const today = new Date().toISOString().split('T')[0];
    return this.sessions.filter(session => session.date === today);
  }

  getSessionsForDate(date: string): WritingSession[] {
    return this.sessions.filter(session => session.date === date);
  }

  getSessionsForWeek(startDate: string): WritingSession[] {
    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    
    return this.sessions.filter(session => {
      const sessionDate = new Date(session.date);
      return sessionDate >= start && sessionDate < end;
    });
  }

  getSessionsForMonth(year: number, month: number): WritingSession[] {
    return this.sessions.filter(session => {
      const sessionDate = new Date(session.date);
      return sessionDate.getFullYear() === year && sessionDate.getMonth() === month;
    });
  }

  getTodaysWordCount(): number {
    return this.getTodaysSessions()
      .filter(session => session.completed)
      .reduce((total, session) => total + session.wordCount, 0);
  }

  getWeekWordCount(): number {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
    weekStart.setHours(0, 0, 0, 0);
    
    return this.sessions
      .filter(session => {
        const sessionDate = new Date(session.date);
        return sessionDate >= weekStart && session.completed;
      })
      .reduce((total, session) => total + session.wordCount, 0);
  }

  getMonthWordCount(): number {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    return this.sessions
      .filter(session => {
        const sessionDate = new Date(session.date);
        return sessionDate >= monthStart && session.completed;
      })
      .reduce((total, session) => total + session.wordCount, 0);
  }

  private updateStreak(date: string) {
    const streakRule = this.plugin.settings.streakRule;
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    if (streakRule.mode === 'daily') {
      this.updateDailyStreak(date, today, yesterday);
    } else {
      this.updateWeeklyStreak();
    }
  }

  private updateDailyStreak(sessionDate: string, today: string, yesterday: string) {
    if (this.streak.lastWritingDay === sessionDate) {
      return; // Already counted this day
    }

    if (this.streak.lastWritingDay === yesterday || this.streak.lastWritingDay === '') {
      // Continue streak or start new one
      this.streak.current++;
    } else if (this.canUseGraceDay()) {
      // Use grace day to continue streak
      this.streak.graceUsed++;
      this.streak.current++;
    } else {
      // Break streak, start new one
      this.streak.current = 1;
      this.streak.graceUsed = 0;
    }

    this.streak.lastWritingDay = sessionDate;
    
    if (this.streak.current > this.streak.longest) {
      this.streak.longest = this.streak.current;
    }
  }

  private updateWeeklyStreak() {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    
    const thisWeekSessions = this.getSessionsForWeek(weekStart.toISOString().split('T')[0]);
    const completedDays = new Set(
      thisWeekSessions
        .filter(session => session.completed && session.wordCount > 0)
        .map(session => session.date)
    ).size;

    const target = this.plugin.settings.streakRule.target;
    
    if (completedDays >= target) {
      // Week goal achieved
      if (this.streak.lastWritingDay !== weekStart.toISOString().split('T')[0]) {
        this.streak.current++;
        this.streak.lastWritingDay = weekStart.toISOString().split('T')[0];
      }
    }
    
    // Update weekly progress
    this.streak.weeklyProgress = new Array(7).fill(0);
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      const dayStr = day.toISOString().split('T')[0];
      const dayHasSessions = thisWeekSessions.some(session => 
        session.date === dayStr && session.completed && session.wordCount > 0
      );
      this.streak.weeklyProgress[i] = dayHasSessions ? 1 : 0;
    }
  }

  private canUseGraceDay(): boolean {
    const maxGrace = this.plugin.settings.streakRule.grace;
    return this.streak.graceUsed < maxGrace;
  }

  getStreak(): StreakData {
    return this.streak;
  }

  getDashboardStats(): DashboardStats {
    const recentSessions = this.sessions
      .filter(session => session.completed)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 7);

    const totalSessions = this.sessions.filter(session => session.completed).length;
    const targetMet = this.sessions.filter(session => 
      session.completed && session.targetCount && session.wordCount >= session.targetCount
    ).length;
    
    const completionRate = totalSessions > 0 ? (targetMet / totalSessions) * 100 : 0;
    const weekSessions = this.getSessionsForWeek(
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    ).filter(session => session.completed).length;

    return {
      todayWordCount: this.getTodaysWordCount(),
      weekWordCount: this.getWeekWordCount(),
      monthWordCount: this.getMonthWordCount(),
      streak: this.streak,
      sessionsThisWeek: weekSessions,
      completionRate,
      recentSessions
    };
  }

  async deleteSession(sessionId: string) {
    this.sessions = this.sessions.filter(session => session.id !== sessionId);
    await this.saveData();
  }

  async clearAllData() {
    this.sessions = [];
    this.streak = this.getDefaultStreak();
    await this.saveData();
  }

  exportData() {
    return {
      sessions: this.sessions,
      streak: this.streak,
      exportDate: new Date().toISOString(),
      version: '1.0'
    };
  }

  async importData(data: any) {
    if (data.sessions) {
      this.sessions = [...this.sessions, ...data.sessions];
    }
    if (data.streak) {
      // Merge streak data carefully
      if (data.streak.longest > this.streak.longest) {
        this.streak.longest = data.streak.longest;
      }
    }
    await this.saveData();
  }
}