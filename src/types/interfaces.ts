export interface WritingMomentumSettings {
  reminders: ReminderConfig[];
  streakRule: StreakRule;
  locale: string;
  dateFormat: string;
  paths: {
    templates: string;
    prompts: string;
  };
  ui: {
    showStatusBar: boolean;
    showRibbonIcon: boolean;
    notifications: boolean;
  };
}

export interface ReminderConfig {
  id: string;
  days: number[]; // 0=Sunday, 1=Monday, etc.
  time: string; // "21:00" format
  secondShotMins?: number; // Double reminder after N minutes
  templateId?: string;
  dnd?: {
    start: string; // "23:30"
    end: string;   // "07:30"
  };
  enabled: boolean;
}

export interface StreakRule {
  mode: 'daily' | 'weekly';
  target: number; // words or days per period
  grace: number; // grace days allowed
}

export interface WritingSession {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: number;
  endTime?: number;
  wordCount: number;
  targetCount?: number;
  templateUsed?: string;
  files: string[];
  completed: boolean;
}

export interface StreakData {
  current: number;
  longest: number;
  lastWritingDay: string; // YYYY-MM-DD
  graceUsed: number;
  weeklyTarget?: number;
  weeklyProgress: number[];
}

export interface Template {
  id: string;
  name: string;
  content: string;
  variables: string[];
  category: 'daily' | 'blog' | 'fiction' | 'custom';
  description?: string;
  filePaths?: FilePathRule;
}

export interface FilePathRule {
  pattern: string; // e.g., "{{date}} Daily.md" or "Blog-{{date}}-{{slug}}.md"
  folder: string;  // target folder
}

export interface PromptSource {
  type: 'markdown' | 'csv' | 'json';
  path: string;
  prompts?: string[];
  tags?: string[];
}

export interface DashboardStats {
  todayWordCount: number;
  weekWordCount: number;
  monthWordCount: number;
  streak: StreakData;
  sessionsThisWeek: number;
  completionRate: number; // percentage
  recentSessions: WritingSession[];
}

export interface TemplateVariable {
  name: string;
  value: string | (() => string);
}

export const DEFAULT_SETTINGS: WritingMomentumSettings = {
  reminders: [
    {
      id: 'evening-default',
      days: [1, 2, 3, 4, 5, 6, 0],
      time: '21:00',
      secondShotMins: 30,
      templateId: 'daily-3lines',
      dnd: {
        start: '23:30',
        end: '07:30'
      },
      enabled: true
    }
  ],
  streakRule: {
    mode: 'weekly',
    target: 5,
    grace: 1
  },
  locale: 'en',
  dateFormat: 'YYYY-MM-DD',
  paths: {
    templates: '.writing-momentum/templates',
    prompts: '.writing-momentum/prompts.md'
  },
  ui: {
    showStatusBar: true,
    showRibbonIcon: true,
    notifications: true
  }
};