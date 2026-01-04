import { TFile, Notice } from 'obsidian';
import type { SessionLog, WritingProfile } from '../types/interfaces';
import type { IWritingMomentumPlugin } from '../types/plugin-interface';
import { ToastManager } from '../ui/toast';

export class PurposeSessionManager {
  private plugin: IWritingMomentumPlugin;
  private currentSession: SessionLog | null = null;
  private charCountInterval: number | null = null;
  private timeInterval: number | null = null;
  private toastManager: ToastManager;
  private sessionStartContent: string = '';
  private activeProfile: WritingProfile | null = null;

  // Pomodoro state
  private pomodoroPhase: 'focus' | 'break' | null = null;
  private pomodoroStartTime: number = 0;

  constructor(plugin: IWritingMomentumPlugin) {
    this.plugin = plugin;
    this.toastManager = new ToastManager();
  }

  setActiveProfile(profile: WritingProfile) {
    this.activeProfile = profile;
  }

  getActiveProfile(): WritingProfile | null {
    return this.activeProfile;
  }

  startSession(filePath: string, profile?: WritingProfile) {
    if (this.currentSession) {
      this.endSession();
    }

    const useProfile = profile || this.activeProfile;
    if (!useProfile) {
      new Notice('No active profile. Please run onboarding first.');
      return;
    }

    this.activeProfile = useProfile;
    const sessionId = `session-${Date.now()}`;

    this.currentSession = {
      id: sessionId,
      profileId: useProfile.id,
      notePath: filePath,
      startedAt: Date.now(),
      chars: 0,
      status: 'ongoing'
    };

    // Capture initial content
    void this.captureInitialContent(filePath);

    // Start appropriate tracking
    if (useProfile.recommendation.target.type === 'words') {
      this.startCharTracking();
    } else {
      this.startTimeTracking();
    }

    // Start Pomodoro if configured
    if (useProfile.recommendation.sessionLengthMin && useProfile.recommendation.sessionLengthMin > 0) {
      this.startPomodoro();
    }

    // Show start toast
    this.showStartToast();
  }

  private async captureInitialContent(filePath: string) {
    try {
      const file = this.plugin.app.vault.getAbstractFileByPath(filePath);
      if (file instanceof TFile) {
        const content = await this.plugin.app.vault.read(file);
        this.sessionStartContent = content;
      }
    } catch (error) {
      console.error('Failed to capture initial content:', error);
      this.sessionStartContent = '';
    }
  }

  private startCharTracking() {
    if (this.charCountInterval) {
      window.clearInterval(this.charCountInterval);
    }

    this.charCountInterval = window.setInterval(() => {
      void this.updateCharCount();
    }, 1000); // Update every second for responsive feedback

    this.plugin.registerInterval(this.charCountInterval);
  }

  private startTimeTracking() {
    if (this.timeInterval) {
      window.clearInterval(this.timeInterval);
    }

    this.timeInterval = window.setInterval(() => {
      this.checkTimeProgress();
    }, 1000);

    this.plugin.registerInterval(this.timeInterval);
  }

  private async updateCharCount() {
    if (!this.currentSession || !this.currentSession.notePath) return;

    const file = this.plugin.app.vault.getAbstractFileByPath(this.currentSession.notePath);
    if (file instanceof TFile) {
      try {
        const currentContent = await this.plugin.app.vault.read(file);
        const initialChars = this.sessionStartContent.length;
        const currentChars = currentContent.length;
        const newChars = Math.max(0, currentChars - initialChars);

        this.currentSession.chars = newChars;

        // Check for milestones
        if (this.activeProfile?.recommendation.target.type === 'words') {
          this.checkCharMilestones(newChars, this.activeProfile.recommendation.target.value);
        }

        // Auto-complete if target reached
        if (this.activeProfile?.recommendation.target.type === 'words' &&
            newChars >= this.activeProfile.recommendation.target.value) {
          this.completeSession();
        }
      } catch (error) {
        console.error('Failed to read file:', error);
      }
    }
  }

  private checkTimeProgress() {
    if (!this.currentSession || !this.activeProfile) return;

    if (this.activeProfile.recommendation.target.type === 'minutes') {
      const elapsed = (Date.now() - this.currentSession.startedAt) / 60000;
      const target = this.activeProfile.recommendation.target.value;

      this.checkTimeMilestones(elapsed, target);

      if (elapsed >= target) {
        this.completeSession();
      }
    }
  }

  private checkCharMilestones(current: number, target: number) {
    if (!this.activeProfile) return;

    const progress = (current / target) * 100;
    const notifyLevel = this.activeProfile.notifyLevel || 'mid';

    // 50% milestone
    if (progress >= 50 && progress < 51 && notifyLevel !== 'low') {
      this.toastManager.progress('Halfway there! Keep going! 🚀', 50, 'info');
    }

    // 75% milestone
    if (progress >= 75 && progress < 76 && notifyLevel === 'high') {
      this.toastManager.progress('Almost done! 75% complete! 💪', 75, 'success');
    }

    // 90% milestone
    if (progress >= 90 && progress < 91) {
      this.toastManager.progress('Final push! 90% there! 🎯', 90, 'milestone');
    }
  }

  private checkTimeMilestones(elapsed: number, target: number) {
    if (!this.activeProfile) return;

    const progress = (elapsed / target) * 100;
    const notifyLevel = this.activeProfile.notifyLevel || 'mid';

    if (progress >= 50 && progress < 50.3 && notifyLevel !== 'low') {
      this.toastManager.info('Halfway through your session! ⏱️');
    }

    if (progress >= 90 && progress < 90.3) {
      this.toastManager.warn('Last minute! Finish strong! 🏁');
    }
  }

  private startPomodoro() {
    if (!this.activeProfile?.recommendation.sessionLengthMin) return;

    this.pomodoroPhase = 'focus';
    this.pomodoroStartTime = Date.now();

    const focusMs = this.activeProfile.recommendation.sessionLengthMin * 60000;

    setTimeout(() => {
      this.onPomodoroPhaseEnd();
    }, focusMs);
  }

  private onPomodoroPhaseEnd() {
    if (!this.activeProfile) return;

    if (this.pomodoroPhase === 'focus') {
      // Focus ended - start break
      const breakMin = this.activeProfile.breakMin || 5;
      this.toastManager.break(
        `Time for a ${breakMin} minute break! 🌟`,
        5000
      );

      this.pomodoroPhase = 'break';
      this.pomodoroStartTime = Date.now();

      const breakMs = breakMin * 60000;

      setTimeout(() => {
        this.onPomodoroPhaseEnd();
      }, breakMs);
    } else {
      // Break ended - back to focus
      this.toastManager.info('Break over! Back to writing! ✍️');
      this.startPomodoro();
    }
  }

  pauseSession() {
    if (!this.currentSession) return;

    if (this.charCountInterval) {
      window.clearInterval(this.charCountInterval);
      this.charCountInterval = null;
    }

    if (this.timeInterval) {
      window.clearInterval(this.timeInterval);
      this.timeInterval = null;
    }

    this.toastManager.info('Session paused ⏸️');
  }

  resumeSession() {
    if (!this.currentSession || !this.activeProfile) return;

    if (this.activeProfile.recommendation.target.type === 'words') {
      this.startCharTracking();
    } else {
      this.startTimeTracking();
    }

    this.toastManager.success('Session resumed! ▶️');
  }

  completeSession() {
    if (!this.currentSession || !this.activeProfile) return;

    this.currentSession.status = 'completed';
    this.currentSession.endedAt = Date.now();

    const duration = Math.round((Date.now() - this.currentSession.startedAt) / 60000);

    // Save session
    void this.saveSession(this.currentSession);

    // Show completion toast
    this.showCompletionToast(duration);

    // Clean up
    this.cleanup();
  }

  endSession() {
    if (!this.currentSession) return;

    this.currentSession.status = 'skipped';
    this.currentSession.endedAt = Date.now();

    void this.saveSession(this.currentSession);
    this.toastManager.info('Session ended');
    this.cleanup();
  }

  skipSession() {
    if (!this.currentSession) return;

    this.currentSession.status = 'skipped';
    this.currentSession.endedAt = Date.now();

    void this.saveSession(this.currentSession);
    this.toastManager.info('Session skipped');
    this.cleanup();
  }

  getCurrentSession(): SessionLog | null {
    return this.currentSession;
  }

  getSessionProgress(): number {
    if (!this.currentSession || !this.activeProfile) return 0;

    if (this.activeProfile.recommendation.target.type === 'words') {
      const progress = (this.currentSession.chars || 0) / this.activeProfile.recommendation.target.value;
      return Math.min(100, progress * 100);
    } else {
      const elapsed = (Date.now() - this.currentSession.startedAt) / 60000;
      const progress = elapsed / this.activeProfile.recommendation.target.value;
      return Math.min(100, progress * 100);
    }
  }

  private showStartToast() {
    if (!this.activeProfile) return;

    let message = 'Session started! ';

    if (this.activeProfile.recommendation.target.type === 'words') {
      message += `Target: ${this.activeProfile.recommendation.target.value} words`;
    } else {
      message += `Target: ${this.activeProfile.recommendation.target.value} minutes`;
    }

    const notifyLevel = this.activeProfile.notifyLevel || 'mid';
    if (notifyLevel !== 'low') {
      this.toastManager.success(message, 3000);
    }
  }

  private showCompletionToast(duration: number) {
    if (!this.activeProfile || !this.currentSession) return;

    let message = `🎉 Session complete! `;

    if (this.activeProfile.recommendation.target.type === 'words') {
      message += `${this.currentSession.chars} characters in ${duration} minutes`;
    } else {
      message += `${duration} minutes of focused writing`;
    }

    this.toastManager.milestone(message, 5000);
  }

  private async saveSession(session: SessionLog) {
    // Add to plugin's session logs array
    this.plugin.sessionLogs.push(session);

    // Save to data file
    await this.plugin.savePurposeData();
  }

  private cleanup() {
    if (this.charCountInterval) {
      window.clearInterval(this.charCountInterval);
      this.charCountInterval = null;
    }

    if (this.timeInterval) {
      window.clearInterval(this.timeInterval);
      this.timeInterval = null;
    }

    this.currentSession = null;
    this.sessionStartContent = '';
    this.pomodoroPhase = null;
  }

  destroy() {
    this.cleanup();
    this.toastManager.cleanup();
  }
}
