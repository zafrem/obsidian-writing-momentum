import { TFile, Notice } from 'obsidian';
import type { WritingSession } from '../types/interfaces';
import type WritingMomentumPlugin from '../../main';

export class SessionManager {
  private plugin: WritingMomentumPlugin;
  private currentSession: WritingSession | null = null;
  private wordCountInterval: number | null = null;
  private sessionStartContent = '';

  constructor(plugin: WritingMomentumPlugin) {
    this.plugin = plugin;
  }

  startSession(filePath: string, templateId?: string, targetWordCount?: number) {
    if (this.currentSession) {
      this.endSession();
    }

    const sessionId = `session-${Date.now()}`;
    const today = new Date().toISOString().split('T')[0];

    this.currentSession = {
      id: sessionId,
      date: today,
      startTime: Date.now(),
      wordCount: 0,
      templateUsed: templateId,
      files: [filePath],
      completed: false,
      targetCount: targetWordCount
    };

    // Store initial content for word count calculation
    this.captureInitialContent(filePath);

    // Start monitoring word count
    this.startWordCountMonitoring();

    if (this.plugin.settings.ui.notifications) {
      new Notice(`Writing session started! Target: ${targetWordCount || 'No limit'} words`);
    }

    // Update status bar
    this.updateStatusBar();
  }

  private async captureInitialContent(filePath: string) {
    try {
      const file = this.plugin.app.vault.getAbstractFileByPath(filePath);
      if (file instanceof TFile) {
        this.sessionStartContent = await this.plugin.app.vault.read(file);
      }
    } catch (error) {
      console.error('Failed to capture initial content:', error);
      this.sessionStartContent = '';
    }
  }

  private startWordCountMonitoring() {
    if (this.wordCountInterval) {
      window.clearInterval(this.wordCountInterval);
    }

    this.wordCountInterval = window.setInterval(() => {
      this.updateSessionWordCount();
    }, 5000); // Update every 5 seconds

    // Register cleanup
    this.plugin.registerInterval(this.wordCountInterval);
  }

  private async updateSessionWordCount() {
    if (!this.currentSession) return;

    let totalNewWords = 0;

    for (const filePath of this.currentSession.files) {
      const file = this.plugin.app.vault.getAbstractFileByPath(filePath);
      if (file instanceof TFile) {
        try {
          const currentContent = await this.plugin.app.vault.read(file);
          const newWords = this.calculateNewWords(this.sessionStartContent, currentContent);
          totalNewWords += newWords;
        } catch (error) {
          console.error(`Failed to read file ${filePath}:`, error);
        }
      }
    }

    this.currentSession.wordCount = Math.max(0, totalNewWords);
    this.updateStatusBar();

    // Check if target is reached
    if (this.currentSession.targetCount && 
        this.currentSession.wordCount >= this.currentSession.targetCount && 
        !this.currentSession.completed) {
      this.completeSession();
    }
  }

  private calculateNewWords(initialContent: string, currentContent: string): number {
    const initialWords = this.countWords(initialContent);
    const currentWords = this.countWords(currentContent);
    return Math.max(0, currentWords - initialWords);
  }

  private countWords(text: string): number {
    // Remove frontmatter
    const withoutFrontmatter = text.replace(/^---[\s\S]*?---\n?/, '');
    // Count words
    return withoutFrontmatter.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  completeSession() {
    if (!this.currentSession) return;

    this.currentSession.completed = true;
    this.currentSession.endTime = Date.now();

    // Save session
    this.plugin.dataManager.addSession(this.currentSession);

    // Show completion message
    if (this.plugin.settings.ui.notifications) {
      const duration = Math.round((Date.now() - this.currentSession.startTime) / 60000);
      const message = `Great job! You wrote ${this.currentSession.wordCount} words in ${duration} minutes.`;
      new Notice(message, 5000);
    }

    this.endSession();
  }

  endSession() {
    if (this.currentSession && !this.currentSession.completed) {
      this.currentSession.endTime = Date.now();
      this.plugin.dataManager.addSession(this.currentSession);
    }

    this.currentSession = null;
    this.sessionStartContent = '';

    if (this.wordCountInterval) {
      window.clearInterval(this.wordCountInterval);
      this.wordCountInterval = null;
    }

    this.updateStatusBar();
  }

  pauseSession() {
    if (this.currentSession) {
      if (this.wordCountInterval) {
        window.clearInterval(this.wordCountInterval);
        this.wordCountInterval = null;
      }
      new Notice('Writing session paused');
    }
  }

  resumeSession() {
    if (this.currentSession && !this.wordCountInterval) {
      this.startWordCountMonitoring();
      new Notice('Writing session resumed');
    }
  }

  getCurrentSession(): WritingSession | null {
    return this.currentSession;
  }

  addFileToCurrentSession(filePath: string) {
    if (this.currentSession && !this.currentSession.files.includes(filePath)) {
      this.currentSession.files.push(filePath);
    }
  }

  setSessionTarget(wordCount: number) {
    if (this.currentSession) {
      this.currentSession.targetCount = wordCount;
      this.updateStatusBar();
    }
  }

  private updateStatusBar() {
    if (!this.plugin.statusBarItem) return;

    if (this.currentSession) {
      const progress = this.currentSession.targetCount 
        ? ` (${Math.min(100, Math.round((this.currentSession.wordCount / this.currentSession.targetCount) * 100))}%)`
        : '';
      
      this.plugin.statusBarItem.setText(
        `✍️ ${this.currentSession.wordCount}${this.currentSession.targetCount ? `/${this.currentSession.targetCount}` : ''} words${progress}`
      );
    } else {
      const todaysCount = this.plugin.dataManager.getTodaysWordCount();
      this.plugin.statusBarItem.setText(`📊 ${todaysCount} words today`);
    }
  }

  getSessionStats() {
    if (!this.currentSession) return null;

    const duration = Date.now() - this.currentSession.startTime;
    const minutes = Math.round(duration / 60000);
    const wpm = minutes > 0 ? Math.round(this.currentSession.wordCount / minutes) : 0;

    return {
      duration: minutes,
      wordCount: this.currentSession.wordCount,
      wpm,
      targetProgress: this.currentSession.targetCount 
        ? (this.currentSession.wordCount / this.currentSession.targetCount) * 100 
        : null
    };
  }

  // Auto-session management for file tracking
  handleFileOpen(file: TFile) {
    if (this.shouldAutoStartSession(file)) {
      this.startSession(file.path);
    } else if (this.currentSession && !this.currentSession.files.includes(file.path)) {
      this.addFileToCurrentSession(file.path);
    }
  }

  private shouldAutoStartSession(file: TFile): boolean {
    // Auto-start if no current session and file is in trackable location
    if (this.currentSession) return false;
    
    // Check if file matches writing patterns
    const writingExtensions = ['md', 'txt'];
    if (!writingExtensions.includes(file.extension)) return false;

    // Check if it's in a writing folder (Journal, Blog, Writing, etc.)
    const writingFolders = ['Journal', 'Blog', 'Writing', 'Draft'];
    return writingFolders.some(folder => file.path.toLowerCase().includes(folder.toLowerCase()));
  }

  cleanup() {
    this.endSession();
    if (this.wordCountInterval) {
      window.clearInterval(this.wordCountInterval);
      this.wordCountInterval = null;
    }
  }
}