import { ItemView, WorkspaceLeaf } from 'obsidian';
import type { DashboardStats } from '../types/interfaces';
import type { IWritingMomentumPlugin } from '../types/plugin-interface';

export const VIEW_TYPE_WRITING_DASHBOARD = 'writing-momentum-dashboard';

export class WritingDashboard extends ItemView {
  private plugin: IWritingMomentumPlugin;

  constructor(leaf: WorkspaceLeaf, plugin: IWritingMomentumPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_WRITING_DASHBOARD;
  }

  getDisplayText(): string {
    return 'Writing Dashboard';
  }

  getIcon(): string {
    return 'target';
  }

  async onOpen() {
    this.render();
  }

  async onClose() {
    // Nothing to clean up
  }

  private render() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass('writing-momentum-dashboard');

    this.renderHeader(container);
    this.renderWritingMode(container);
    this.renderTopCompleteButton(container);
    this.renderCurrentSession(container);
    this.renderContinuousWriting(container);
    this.renderTodayStats(container);
    this.renderStreak(container);
    this.renderWeeklyProgress(container);
    this.renderQuickActions(container);
    this.renderRecentSessions(container);
  }

  private renderHeader(container: Element) {
    const header = container.createEl('div', { cls: 'dashboard-header' });
    header.createEl('h2', { text: 'Writing Dashboard', cls: 'dashboard-title' });

    const refreshBtn = header.createEl('button', {
      text: 'Refresh',
      cls: 'dashboard-refresh-btn'
    });
    refreshBtn.onclick = () => this.render();
  }

  private renderWritingMode(container: Element) {
    const currentSession = this.plugin.sessionManager.getCurrentSession();

    if (currentSession) {
      return; // Don't show Writing Mode section when session is active
    }

    const modeSection = container.createEl('div', { cls: 'dashboard-section writing-mode' });
    modeSection.createEl('h3', { text: '✍️ Writing Mode' });

    const modeGrid = modeSection.createEl('div', { cls: 'writing-mode-grid' });

    // Quick Start option
    const quickStartCard = modeGrid.createEl('div', { cls: 'mode-card quick-start-card' });
    quickStartCard.createEl('div', { text: '⚡', cls: 'mode-icon' });
    quickStartCard.createEl('div', { text: 'Quick Start', cls: 'mode-title' });
    quickStartCard.createEl('div', { text: 'Start writing immediately', cls: 'mode-description' });

    const quickStartBtn = quickStartCard.createEl('button', { cls: 'mode-start-btn' });
    quickStartBtn.createEl('span', { text: 'Ready', cls: 'btn-left-text' });
    quickStartBtn.createEl('span', { text: 'Start Session', cls: 'btn-center-text' });
    quickStartBtn.createEl('span', { text: 'Write', cls: 'btn-right-text' });

    quickStartBtn.onclick = async () => {
      await this.plugin.templateEngine.createNoteFromTemplate();
    };

    // Template option
    const templateCard = modeGrid.createEl('div', { cls: 'mode-card template-card' });
    templateCard.createEl('div', { text: '📝', cls: 'mode-icon' });
    templateCard.createEl('div', { text: 'Template', cls: 'mode-title' });
    templateCard.createEl('div', { text: 'Use structured template', cls: 'mode-description' });

    const templateBtn = templateCard.createEl('button', { cls: 'mode-start-btn' });
    templateBtn.createEl('span', { text: 'Focus', cls: 'btn-left-text' });
    templateBtn.createEl('span', { text: 'Start Session', cls: 'btn-center-text' });
    templateBtn.createEl('span', { text: 'Create', cls: 'btn-right-text' });

    templateBtn.onclick = async () => {
      await this.plugin.templateEngine.createNoteFromTemplate();
    };
  }

  private renderTopCompleteButton(container: Element) {
    const currentSession = this.plugin.sessionManager.getCurrentSession();
    const buttonContainer = container.createEl('div', { cls: 'top-button-container' });

    if (currentSession) {
      const completeBtn = buttonContainer.createEl('button', {
        text: 'Complete Session',
        cls: 'top-complete-btn'
      });
      completeBtn.onclick = () => {
        this.plugin.sessionManager.completeSession();
        this.render();
      };
    } else {
      const startBtn = buttonContainer.createEl('button', {
        text: 'Start Session',
        cls: 'top-start-btn'
      });
      startBtn.onclick = async () => {
        await this.plugin.templateEngine.createNoteFromTemplate();
      };
    }
  }

  private renderCurrentSession(container: Element) {
    const currentSession = this.plugin.sessionManager.getCurrentSession();
    const sessionEl = container.createEl('div', { cls: 'dashboard-section current-session' });
    
    if (currentSession) {
      sessionEl.createEl('h3', { text: '🎯 Active Session' });
      
      const stats = this.plugin.sessionManager.getSessionStats();
      if (stats) {
        const statsGrid = sessionEl.createEl('div', { cls: 'session-stats-grid' });
        
        this.createStatCard(statsGrid, 'Words Written', stats.wordCount.toString(), '📝');
        this.createStatCard(statsGrid, 'Duration', `${stats.duration}m`, '⏱️');
        this.createStatCard(statsGrid, 'WPM', stats.wpm.toString(), '⚡');
        
        if (stats.targetProgress !== null) {
          this.createStatCard(statsGrid, 'Progress', `${Math.round(stats.targetProgress)}%`, '📊');
        }
      }

      const actions = sessionEl.createEl('div', { cls: 'session-actions' });

      const endBtn = actions.createEl('button', {
        text: 'End Session',
        cls: 'session-btn end-btn'
      });
      endBtn.onclick = () => {
        this.plugin.sessionManager.endSession();
        this.render();
      };
    } else {
      sessionEl.createEl('h3', { text: 'No Active Session' });
      sessionEl.createEl('p', { 
        text: 'Start writing from a reminder or use a template to begin tracking.',
        cls: 'no-session-message'
      });
    }
  }

  private renderTodayStats(container: Element) {
    const stats = this.plugin.dataManager.getDashboardStats();
    const todayEl = container.createEl('div', { cls: 'dashboard-section today-stats' });
    
    todayEl.createEl('h3', { text: 'Today\'s Progress' });
    
    const statsGrid = todayEl.createEl('div', { cls: 'stats-grid' });
    this.createStatCard(statsGrid, 'Words Today', stats.todayWordCount.toString(), '📝');
    this.createStatCard(statsGrid, 'This Week', stats.weekWordCount.toString(), '📊');
    this.createStatCard(statsGrid, 'This Month', stats.monthWordCount.toString(), '📈');
    this.createStatCard(statsGrid, 'Sessions This Week', stats.sessionsThisWeek.toString(), '✍️');
  }

  private renderStreak(container: Element) {
    const stats = this.plugin.dataManager.getDashboardStats();
    const streakEl = container.createEl('div', { cls: 'dashboard-section streak-section' });
    
    streakEl.createEl('h3', { text: '🔥 Writing Streak' });
    
    const streakGrid = streakEl.createEl('div', { cls: 'streak-grid' });
    
    const currentStreak = streakGrid.createEl('div', { cls: 'streak-card current-streak' });
    currentStreak.createEl('div', { text: stats.streak.current.toString(), cls: 'streak-number' });
    currentStreak.createEl('div', { text: 'Current Streak', cls: 'streak-label' });
    
    const longestStreak = streakGrid.createEl('div', { cls: 'streak-card longest-streak' });
    longestStreak.createEl('div', { text: stats.streak.longest.toString(), cls: 'streak-number' });
    longestStreak.createEl('div', { text: 'Longest Streak', cls: 'streak-label' });

    if (this.plugin.settings.streakRule.mode === 'weekly') {
      this.renderWeeklyStreak(streakEl, stats.streak);
    }
  }

  private renderWeeklyStreak(container: Element, streak: any) {
    const weeklyEl = container.createEl('div', { cls: 'weekly-streak' });
    weeklyEl.createEl('h4', { text: 'This Week' });
    
    const daysEl = weeklyEl.createEl('div', { cls: 'week-days' });
    const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    
    for (let i = 0; i < 7; i++) {
      const dayEl = daysEl.createEl('div', { cls: 'week-day' });
      dayEl.createEl('div', { text: dayNames[i], cls: 'day-name' });
      
      const dotEl = dayEl.createEl('div', { cls: 'day-dot' });
      if (streak.weeklyProgress && streak.weeklyProgress[i]) {
        dotEl.addClass('completed');
      }
    }
    
    const progress = streak.weeklyProgress ? streak.weeklyProgress.reduce((a: number, b: number) => a + b, 0) : 0;
    const target = this.plugin.settings.streakRule.target;
    weeklyEl.createEl('p', { 
      text: `${progress}/${target} days completed`,
      cls: 'weekly-progress'
    });
  }

  private renderWeeklyProgress(container: Element) {
    const progressEl = container.createEl('div', { cls: 'dashboard-section weekly-progress' });
    progressEl.createEl('h3', { text: 'Weekly Overview' });
    
    // This could be expanded to show a more detailed weekly breakdown
    const stats = this.plugin.dataManager.getDashboardStats();
    const completionEl = progressEl.createEl('div', { cls: 'completion-rate' });
    
    completionEl.createEl('div', { 
      text: `${Math.round(stats.completionRate)}%`,
      cls: 'completion-percentage'
    });
    completionEl.createEl('div', { 
      text: 'Target Achievement Rate',
      cls: 'completion-label'
    });
  }

  private renderQuickActions(container: Element) {
    const actionsEl = container.createEl('div', { cls: 'dashboard-section quick-actions' });
    actionsEl.createEl('h3', { text: '⚡ Actions' });

    const buttonsEl = actionsEl.createEl('div', { cls: 'action-buttons' });

    const settingsBtn = buttonsEl.createEl('button', {
      text: '⚙️ Settings',
      cls: 'action-btn'
    });
    settingsBtn.onclick = () => {
      // @ts-ignore - This is the correct way to open Obsidian settings
      this.plugin.app.setting.open();
      // @ts-ignore
      setTimeout(() => {
        // @ts-ignore
        this.plugin.app.setting.openTabById(this.plugin.manifest.id);
      }, 100);
    };
  }

  private renderRecentSessions(container: Element) {
    const stats = this.plugin.dataManager.getDashboardStats();
    const recentEl = container.createEl('div', { cls: 'dashboard-section recent-sessions' });
    
    recentEl.createEl('h3', { text: 'Recent Sessions' });
    
    if (stats.recentSessions.length === 0) {
      recentEl.createEl('p', { 
        text: 'No recent sessions. Start writing to see your progress here!',
        cls: 'no-sessions-message'
      });
      return;
    }

    const sessionsList = recentEl.createEl('div', { cls: 'sessions-list' });
    
    for (const session of stats.recentSessions.slice(0, 5)) {
      const sessionEl = sessionsList.createEl('div', { cls: 'session-item' });
      
      const dateEl = sessionEl.createEl('div', { cls: 'session-date' });
      dateEl.createEl('span', { text: session.date });
      
      const statsEl = sessionEl.createEl('div', { cls: 'session-stats' });
      statsEl.createEl('span', { text: `${session.wordCount} words` });
      
      if (session.templateUsed) {
        statsEl.createEl('span', { 
          text: session.templateUsed,
          cls: 'session-template'
        });
      }
      
      if (session.targetCount) {
        const progress = Math.round((session.wordCount / session.targetCount) * 100);
        statsEl.createEl('span', { 
          text: `${progress}%`,
          cls: `session-progress ${progress >= 100 ? 'completed' : ''}`
        });
      }
    }
  }

  private renderContinuousWriting(container: Element) {
    if (!this.plugin.settings.continuousWriting.enabled) {
      return;
    }

    const section = container.createEl('div', { cls: 'dashboard-section continuous-writing' });
    section.createEl('h3', { text: '🔥 Continuous Writing Mode' });

    const currentCount = this.plugin.settings.continuousWriting.currentCount;
    const targetCount = this.plugin.settings.continuousWriting.targetSessions;
    const sessionDuration = this.plugin.settings.continuousWriting.sessionDuration;

    // Progress overview
    const progressOverview = section.createEl('div', { cls: 'continuous-progress-overview' });

    const progressText = progressOverview.createEl('div', { cls: 'continuous-progress-text' });
    progressText.createEl('span', {
      text: `${currentCount} / ${targetCount}`,
      cls: 'continuous-count'
    });
    progressText.createEl('span', {
      text: ` sessions completed`,
      cls: 'continuous-label'
    });

    const percentage = Math.round((currentCount / targetCount) * 100);
    progressText.createEl('span', {
      text: ` (${percentage}%)`,
      cls: 'continuous-percentage'
    });

    // Progress bar
    const progressBarContainer = progressOverview.createEl('div', { cls: 'continuous-progress-bar' });
    const progressBar = progressBarContainer.createEl('div', {
      cls: 'continuous-progress-fill',
      attr: { style: `width: ${Math.min(percentage, 100)}%` }
    });

    // Session info
    const sessionInfo = section.createEl('div', { cls: 'continuous-session-info' });
    sessionInfo.createEl('p', {
      text: `Target: ${sessionDuration} minutes per session`,
      cls: 'session-duration-info'
    });

    // Action buttons
    const actions = section.createEl('div', { cls: 'continuous-actions' });

    const startBtn = actions.createEl('button', {
      text: '🚀 Start Continuous Session',
      cls: 'action-btn continuous-start-btn'
    });
    startBtn.onclick = async () => {
      await this.plugin.templateEngine.createNoteFromTemplate();
    };

    if (currentCount > 0) {
      const resetBtn = actions.createEl('button', {
        text: '🔄 Reset Progress',
        cls: 'action-btn continuous-reset-btn'
      });
      resetBtn.onclick = async () => {
        this.plugin.settings.continuousWriting.currentCount = 0;
        await this.plugin.saveSettings();
        this.render();
      };
    }

    // Achievement check
    if (currentCount >= targetCount) {
      const achievementEl = section.createEl('div', { cls: 'continuous-achievement' });
      achievementEl.createEl('div', { text: '🎉', cls: 'achievement-icon' });
      achievementEl.createEl('div', {
        text: `Congratulations! You've completed ${targetCount} continuous sessions!`,
        cls: 'achievement-text'
      });
    }
  }

  private createStatCard(container: Element, label: string, value: string, icon: string) {
    const card = container.createEl('div', { cls: 'stat-card' });
    card.createEl('div', { text: icon, cls: 'stat-icon' });
    card.createEl('div', { text: value, cls: 'stat-value' });
    card.createEl('div', { text: label, cls: 'stat-label' });
  }

  refresh() {
    this.render();
  }
}