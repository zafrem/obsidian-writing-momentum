import { Modal, App } from 'obsidian';
import type { WritingProfile } from '../types/interfaces';

export class WritingPurposeModal extends Modal {
  private profile: WritingProfile;

  constructor(app: App, profile: WritingProfile) {
    super(app);
    this.profile = profile;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('wm-purpose-modal');

    // Header
    const header = contentEl.createDiv('wm-modal-header');
    header.createEl('h2', { text: 'Your writing purpose' });
    header.createEl('p', {
      text: 'Overview of your writing goals and preferences',
      cls: 'wm-modal-subtitle'
    });

    // Purpose Section
    const purposeSection = contentEl.createDiv('wm-modal-section');
    purposeSection.createEl('h3', { text: '📝 writing purpose' });

    const purposeCard = purposeSection.createDiv('wm-purpose-card');
    const purposeLabel = this.getPurposeLabel(this.profile.answers.purpose);
    purposeCard.createEl('div', { text: purposeLabel, cls: 'wm-purpose-label' });

    if (this.profile.answers.customPurpose) {
      purposeCard.createEl('div', {
        text: this.profile.answers.customPurpose,
        cls: 'wm-purpose-custom'
      });
    }

    // Outcome Section
    const outcomeSection = contentEl.createDiv('wm-modal-section');
    outcomeSection.createEl('h3', { text: '🎯 your writing goals' });

    const outcomeCard = outcomeSection.createDiv('wm-outcome-card');
    outcomeCard.createEl('div', {
      text: this.profile.answers.outcome || 'Not specified',
      cls: 'wm-outcome-text'
    });

    // Final Goal Section
    if (this.profile.answers.finalGoal) {
      const finalGoalSection = contentEl.createDiv('wm-modal-section');
      finalGoalSection.createEl('h3', { text: '🏆 final writing goal' });

      const finalGoalCard = finalGoalSection.createDiv('wm-outcome-card');
      finalGoalCard.createEl('div', {
        text: this.profile.answers.finalGoal,
        cls: 'wm-outcome-text'
      });
    }

    // Tracking Method Section
    const trackingSection = contentEl.createDiv('wm-modal-section');
    trackingSection.createEl('h3', { text: '📊 progress tracking' });

    const trackingCard = trackingSection.createDiv('wm-tracking-card');
    const trackingIcon = this.profile.answers.unitPref === 'words' ? '📊' : '⏱️';
    const trackingLabel = this.profile.answers.unitPref === 'words' ? 'Word count' : 'Time-based';

    trackingCard.createEl('div', { text: trackingIcon, cls: 'wm-tracking-icon' });
    trackingCard.createEl('div', { text: trackingLabel, cls: 'wm-tracking-label' });

    if (this.profile.answers.targetHint) {
      const hintText = this.profile.answers.unitPref === 'words'
        ? `${this.profile.answers.targetHint} words (your hint)`
        : `${this.profile.answers.targetHint} minutes (your hint)`;
      trackingCard.createEl('div', { text: hintText, cls: 'wm-tracking-hint' });
    }

    // Close button
    const actions = contentEl.createDiv('wm-modal-actions');
    const closeBtn = actions.createEl('button', {
      text: 'Close',
      cls: 'wm-modal-btn wm-modal-btn-primary'
    });
    closeBtn.addEventListener('click', () => {
      this.close();
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }

  private getPurposeLabel(purpose: string): string {
    const labels: Record<string, string> = {
      express: '📝 Self-expression',
      monetize: '💰 Monetization',
      fun: '🎉 Fun & creativity',
      skill: '📚 Skill development',
      custom: '✏️ Custom'
    };
    return labels[purpose] || purpose;
  }
}
