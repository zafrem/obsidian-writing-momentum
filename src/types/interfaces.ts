export interface WritingMomentumSettings {
  reminders: ReminderConfig[];
  streakRule: StreakRule;
  locale: string;
  dateFormat: string;
  defaultTitlePattern: string;
  defaultTemplate: string;
  continuousWriting: {
    enabled: boolean;
    targetSessions: number;
    currentCount: number;
    sessionDuration: number; // minutes
  };
  randomPrompts: {
    enabled: boolean;
    mixWithLocal: boolean;
    autoRefresh: boolean;
  };
  paths: {
    prompts: string;
  };
  ui: {
    showStatusBar: boolean;
    showRibbonIcon: boolean;
    notifications: boolean;
  };
  // Legacy flat structure fields for backward compatibility
  reminderTime?: string;
  showStatusBar?: boolean;
  showRibbonIcon?: boolean;
  enableNotifications?: boolean;
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
  // Additional fields for active session management
  active?: boolean;
  paused?: boolean;
  pausedTime?: number;
  totalPausedDuration?: number;
  filePath?: string;
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
  defaultTitlePattern: '{{date}} - Writing Session',
  defaultTemplate: '# {{title}}\n\n## Prompt\n{{random_prompt}}\n\n## Writing\n\n\n---\n*Written on {{weekday}} at {{time}}*',
  continuousWriting: {
    enabled: false,
    targetSessions: 30,
    currentCount: 0,
    sessionDuration: 25
  },
  randomPrompts: {
    enabled: false,
    mixWithLocal: true,
    autoRefresh: true
  },
  paths: {
    prompts: '.writing-momentum/prompts.md'
  },
  ui: {
    showStatusBar: true,
    showRibbonIcon: true,
    notifications: true
  },
  // Legacy flat structure fields for backward compatibility
  reminderTime: '21:00',
  showStatusBar: true,
  showRibbonIcon: true,
  enableNotifications: true
};