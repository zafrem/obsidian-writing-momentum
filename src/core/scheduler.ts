import { Notice } from 'obsidian';
import type { ReminderConfig } from '../types/interfaces';
import type { IWritingMomentumPlugin } from '../types/plugin-interface';

export class ReminderScheduler {
  private plugin: IWritingMomentumPlugin;
  private scheduledReminders: Map<string, number> = new Map();
  private snoozeQueue: Map<string, number> = new Map();

  constructor(plugin: IWritingMomentumPlugin) {
    this.plugin = plugin;
  }

  start() {
    this.scheduleAllReminders();
    // Check every minute for due reminders
    this.plugin.registerInterval(
      window.setInterval(() => this.checkReminders(), 60000)
    );
  }

  stop() {
    this.scheduledReminders.clear();
    this.snoozeQueue.clear();
  }

  private scheduleAllReminders() {
    const reminders = this.plugin.settings.reminders.filter((r: ReminderConfig) => r.enabled);
    
    for (const reminder of reminders) {
      this.scheduleReminder(reminder);
    }
  }

  private scheduleReminder(reminder: ReminderConfig) {
    const now = new Date();
    const today = now.getDay();
    
    if (!reminder.days.includes(today)) {
      return;
    }

    const [hour, minute] = reminder.time.split(':').map(Number);
    const reminderTime = new Date();
    reminderTime.setHours(hour, minute, 0, 0);

    // If time has passed today, schedule for tomorrow
    if (reminderTime <= now) {
      reminderTime.setDate(reminderTime.getDate() + 1);
    }

    // Check do-not-disturb
    if (this.isInDoNotDisturbPeriod(reminder)) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      this.triggerReminder(reminder);
    }, reminderTime.getTime() - now.getTime());

    this.scheduledReminders.set(reminder.id, timeoutId);
  }

  private isInDoNotDisturbPeriod(reminder: ReminderConfig): boolean {
    if (!reminder.dnd) return false;

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const [startHour, startMin] = reminder.dnd.start.split(':').map(Number);
    const [endHour, endMin] = reminder.dnd.end.split(':').map(Number);
    
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    if (startTime <= endTime) {
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      // Overnight period (e.g., 23:30 to 07:30)
      return currentTime >= startTime || currentTime <= endTime;
    }
  }

  private async triggerReminder(reminder: ReminderConfig) {
    const message = "Time to write! Click to start your writing session.";
    
    const notice = new Notice(message, 0); // Persistent notice
    
    // Add click handler to notice
    const noticeEl = notice.noticeEl;
    noticeEl.addClass('clickable-notice');
    noticeEl.onclick = () => {
      notice.hide();
      this.handleReminderClick(reminder);
    };

    // Add snooze button
    const snoozeBtn = noticeEl.createEl('button', { 
      text: 'Snooze 10m',
      cls: 'snooze-btn'
    });
    snoozeBtn.onclick = (e) => {
      e.stopPropagation();
      this.snoozeReminder(reminder.id, 10);
      notice.hide();
    };

    // Schedule second reminder if configured
    if (reminder.secondShotMins) {
      setTimeout(() => {
        if (!this.hasWrittenToday()) {
          this.triggerReminder(reminder);
        }
      }, reminder.secondShotMins * 60 * 1000);
    }
  }

  private async handleReminderClick(reminder: ReminderConfig) {
    try {
      await this.plugin.templateEngine.createNoteFromTemplate();
    } catch (error) {
      console.error('Failed to create note from reminder:', error);
      new Notice('Failed to create writing note. Please try again.');
    }
  }

  snoozeReminder(reminderId: string, minutes: number) {
    const snoozeTime = Date.now() + (minutes * 60 * 1000);
    this.snoozeQueue.set(reminderId, snoozeTime);
    
    setTimeout(() => {
      const reminder = this.plugin.settings.reminders.find((r: ReminderConfig) => r.id === reminderId);
      if (reminder) {
        this.triggerReminder(reminder);
      }
      this.snoozeQueue.delete(reminderId);
    }, minutes * 60 * 1000);
  }

  private checkReminders() {
    // This runs every minute to catch any missed reminders
    // Implementation would check for any reminders that should have fired
  }

  private hasWrittenToday(): boolean {
    const sessions = this.plugin.dataManager.getTodaysSessions();
    return sessions.some(session => session.completed && session.wordCount > 0);
  }

  reschedule() {
    this.stop();
    this.start();
  }
}