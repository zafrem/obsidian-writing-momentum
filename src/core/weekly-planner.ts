import type { WritingProfile, SessionLog, WeeklyPlan } from '../types/interfaces';
import { ToastManager } from '../ui/toast';

export class WeeklyPlanner {
  private profile: WritingProfile;
  private sessions: SessionLog[];
  private toastManager: ToastManager;

  constructor(profile: WritingProfile, sessions: SessionLog[], toastManager: ToastManager) {
    this.profile = profile;
    this.sessions = sessions;
    this.toastManager = toastManager;
  }

  getCurrentWeekPlan(): WeeklyPlan {
    const weekStart = this.getWeekStart();
    const weekSessions = this.getWeekSessions();
    const completed = weekSessions.filter(s => s.status === 'completed').length;

    return {
      weekStart,
      targetSessions: this.profile.recommendation.sessionsPerWeek,
      completedSessions: completed,
      preferredDays: this.profile.answers.preferredDays || []
    };
  }

  shouldNudge(): boolean {
    const today = new Date().getDay();
    const plan = this.getCurrentWeekPlan();

    // Check if today is a preferred day
    if (this.profile.answers.preferredDays && this.profile.answers.preferredDays.length > 0) {
      if (!this.profile.answers.preferredDays.includes(today)) {
        return false;
      }
    }

    // Check if we've already written today
    if (this.hasWrittenToday()) {
      return false;
    }

    // Check if we still need more sessions this week
    if (plan.completedSessions >= plan.targetSessions) {
      return false;
    }

    // Check if we're in preferred time window
    if (this.profile.answers.preferredTime) {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      // Allow nudge within 30 minutes of preferred time
      const preferredMinutes = this.timeToMinutes(this.profile.answers.preferredTime);
      const currentMinutes = this.timeToMinutes(currentTime);
      const diff = Math.abs(currentMinutes - preferredMinutes);

      if (diff > 30) {
        return false;
      }
    }

    return true;
  }

  showNudge() {
    const plan = this.getCurrentWeekPlan();
    const remaining = plan.targetSessions - plan.completedSessions;

    let message = `📝 Time to write! `;

    if (remaining === 1) {
      message += `One more session to complete your weekly goal!`;
    } else {
      message += `${remaining} sessions left this week.`;
    }

    if (this.profile.recommendation.target.type === 'words') {
      message += ` Target: ${this.profile.recommendation.target.value} words.`;
    } else {
      message += ` Target: ${this.profile.recommendation.target.value} minutes.`;
    }

    this.toastManager.info(message, 5000);
  }

  showWeeklySummary() {
    const plan = this.getCurrentWeekPlan();
    const weekSessions = this.getWeekSessions();
    const totalChars = weekSessions.reduce((sum, s) => sum + (s.chars || 0), 0);
    const avgChars = weekSessions.length > 0 ? Math.round(totalChars / weekSessions.length) : 0;

    let message = `📊 Weekly Summary:\n`;
    message += `✅ ${plan.completedSessions}/${plan.targetSessions} sessions\n`;
    message += `📝 ${totalChars} total characters\n`;

    if (weekSessions.length > 0) {
      message += `📈 ${avgChars} avg per session`;
    }

    if (plan.completedSessions >= plan.targetSessions) {
      this.toastManager.milestone(message + '\n🎉 Goal achieved!', 7000);
    } else {
      this.toastManager.info(message, 5000);
    }
  }

  getRemainingSessionsThisWeek(): number {
    const plan = this.getCurrentWeekPlan();
    return Math.max(0, plan.targetSessions - plan.completedSessions);
  }

  getNextPreferredDay(): string | null {
    if (!this.profile.answers.preferredDays || this.profile.answers.preferredDays.length === 0) {
      return null;
    }

    const today = new Date().getDay();
    const sortedDays = [...this.profile.answers.preferredDays].sort((a, b) => a - b);

    // Find next day in the same week
    const nextDay = sortedDays.find(day => day > today);
    if (nextDay !== undefined) {
      return this.dayName(nextDay);
    }

    // Otherwise, return first day of next week
    return this.dayName(sortedDays[0]) + ' (next week)';
  }

  getWeekProgress(): number {
    const plan = this.getCurrentWeekPlan();
    return plan.targetSessions > 0
      ? (plan.completedSessions / plan.targetSessions) * 100
      : 0;
  }

  private getWeekStart(): string {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day; // Go back to Sunday
    const weekStart = new Date(now.setDate(diff));
    return weekStart.toISOString().split('T')[0];
  }

  private getWeekSessions(): SessionLog[] {
    const weekStart = new Date(this.getWeekStart());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    return this.sessions.filter(session => {
      const sessionDate = new Date(session.startedAt);
      return sessionDate >= weekStart && sessionDate < weekEnd &&
             session.profileId === this.profile.id;
    });
  }

  private hasWrittenToday(): boolean {
    const today = new Date().toISOString().split('T')[0];
    const todaySessions = this.sessions.filter(session => {
      const sessionDate = new Date(session.startedAt).toISOString().split('T')[0];
      return sessionDate === today &&
             session.status === 'completed' &&
             session.profileId === this.profile.id;
    });

    return todaySessions.length > 0;
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private dayName(day: number): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[day];
  }
}
