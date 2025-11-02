export interface WritingMomentumSettings {
  reminders: ReminderConfig[];
  streakRule: StreakRule;
  locale: string;
  dateFormat: string;
  defaultTitlePattern: string;
  defaultTemplate: string;
  templates: Template[];  // Added: User-created template presets
  activeTemplateId?: string;  // Added: Currently selected template
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
  titlePattern: string;  // Pattern for file title (e.g., "{{date}} - Daily Journal")
  content: string;
  variables?: string[];  // Auto-extracted variables
  category?: 'daily' | 'blog' | 'fiction' | 'custom';
  description?: string;
  filePaths?: FilePathRule;
  isBuiltIn?: boolean;  // True for default templates, false for user-created
  createdAt?: number;
  updatedAt?: number;
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
  duration?: number;
  wordCount?: number;
  wpm?: number;
  targetProgress?: number | null;
}

export interface TemplateVariable {
  name: string;
  value: string | (() => string);
}

// Q&A-based estimation system
export type Purpose = "express" | "monetize" | "fun" | "skill" | "custom";
export type UnitType = "minutes" | "words";
export type Feasibility = "busy" | "normal" | "free";

export interface QaAnswers {
  purpose: Purpose;
  customPurpose?: string;
  outcome?: string;          // what user wants to achieve (Step 2)
  finalGoal?: string;        // quantified final goal (Step 3)
  unitPref: UnitType;        // preferred tracking method (Step 4)
  targetHint?: number;       // optional numeric hint for calculation
  feasibility?: Feasibility; // how busy they are (Step 5)
  preferredDays?: number[];  // 0=Sun..6=Sat (Step 5)
  preferredTime?: string;    // "20:30" (Step 5)
}

export interface Recommendation {
  sessionLengthMin: number;
  target: { type: UnitType; value: number };
  sessionsPerWeek: number;
  ruleVersion: string;
  calculatedAt: number;
}

export interface WritingProfile {
  id: string;
  answers: QaAnswers;
  recommendation: Recommendation;
  overrides?: Partial<Recommendation>;
  notifyLevel?: "low" | "mid" | "high";
  breakMin?: number;
  createdAt: number;
  updatedAt: number;
}

export interface SessionLog {
  id: string;
  profileId: string;
  notePath?: string;
  startedAt: number;
  endedAt?: number;
  chars?: number;
  words?: number;
  status: "ongoing" | "completed" | "skipped";
}

export interface WeeklyPlan {
  weekStart: string; // YYYY-MM-DD
  targetSessions: number;
  completedSessions: number;
  preferredDays: number[];
}

export const DEFAULT_TEMPLATES: Template[] = [
  {
    id: 'daily-journal',
    name: 'Daily Journal',
    titlePattern: '{{date}} - Daily Journal',
    content: '# Daily Journal - {{date}}\n\n## Morning Reflection\n{{random_prompt}}\n\n## Today\'s Events\n- \n- \n- \n\n## Thoughts & Feelings\n\n\n## Gratitude\n1. \n2. \n3. \n\n---\n*Written on {{weekday}} at {{time}}*',
    category: 'daily',
    description: 'Structured daily journaling template',
    isBuiltIn: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: 'quick-note',
    name: 'Quick Note',
    titlePattern: '{{date}} {{time}} - Quick Note',
    content: '# Quick Note\n\n## Idea\n{{random_prompt}}\n\n## Details\n\n\n## Next Steps\n- [ ] \n- [ ] \n\n---\n*{{weekday}} {{time}}*',
    category: 'custom',
    description: 'Fast capture for ideas and thoughts',
    isBuiltIn: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: 'project-planning',
    name: 'Project Planning',
    titlePattern: '{{date}} - Project {{title}}',
    content: '# Project: {{title}}\n\n## Goal\n{{random_prompt}}\n\n## Overview\n**Start Date:** {{date}}\n**Status:** Planning\n\n## Tasks\n- [ ] Task 1\n- [ ] Task 2\n- [ ] Task 3\n\n## Timeline\n\n\n## Resources\n\n\n---\n*Created {{weekday}}, {{date}} at {{time}}*',
    category: 'custom',
    description: 'Template for project planning and tracking',
    isBuiltIn: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: 'simple-writing',
    name: 'Simple Writing',
    titlePattern: '{{date}} - Writing Session',
    content: '# {{title}}\n\n## Prompt\n{{random_prompt}}\n\n## Writing\n\n\n---\n*Written on {{weekday}} at {{time}}*',
    category: 'custom',
    description: 'Minimal template for freeform writing',
    isBuiltIn: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
];

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
  templates: [...DEFAULT_TEMPLATES],
  activeTemplateId: 'simple-writing',
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