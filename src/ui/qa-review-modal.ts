import { Modal, App } from 'obsidian';
import type { WritingProfile, Recommendation } from '../types/interfaces';
import { EstimationEngine } from '../core/estimation-engine';

export class QaReviewModal extends Modal {
  private profile: WritingProfile;
  private onEdit: () => void;
  private onRecalculate: (newRec: Recommendation) => void;

  constructor(
    app: App,
    profile: WritingProfile,
    onEdit: () => void,
    onRecalculate: (newRec: Recommendation) => void
  ) {
    super(app);
    this.profile = profile;
    this.onEdit = onEdit;
    this.onRecalculate = onRecalculate;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('wm-qa-review-modal');

    // Header
    const header = contentEl.createDiv('wm-modal-header');
    header.createEl('h2', { text: 'Your writing profile' });
    header.createEl('p', {
      text: 'Review your answers and recommendations',
      cls: 'wm-modal-subtitle'
    });

    // Q&A Answers Section
    const answersSection = contentEl.createDiv('wm-modal-section');
    answersSection.createEl('h3', { text: '📋 your answers' });

    const answersGrid = answersSection.createDiv('wm-answers-grid');

    // Purpose
    this.addAnswerRow(answersGrid, 'Purpose', this.getPurposeLabel(this.profile.answers.purpose));

    // Custom purpose (if applicable)
    if (this.profile.answers.customPurpose) {
      this.addAnswerRow(answersGrid, 'Custom purpose', this.profile.answers.customPurpose);
    }

    // Outcome
    this.addAnswerRow(answersGrid, 'Goal', this.profile.answers.outcome || 'Not specified');

    // Unit preference
    this.addAnswerRow(
      answersGrid,
      'Tracking method',
      this.profile.answers.unitPref === 'words' ? '📊 Word count' : '⏱️ Time'
    );

    // Target hint (if provided)
    if (this.profile.answers.targetHint) {
      const hintLabel = this.profile.answers.unitPref === 'words'
        ? `${this.profile.answers.targetHint} words`
        : `${this.profile.answers.targetHint} minutes`;
      this.addAnswerRow(answersGrid, 'Target hint', hintLabel);
    }

    // Feasibility
    if (this.profile.answers.feasibility) {
      const feasLabel = this.profile.answers.feasibility.charAt(0).toUpperCase() +
                       this.profile.answers.feasibility.slice(1);
      this.addAnswerRow(answersGrid, 'Schedule', feasLabel);
    }

    // Preferred days
    if (this.profile.answers.preferredDays && this.profile.answers.preferredDays.length > 0) {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayLabels = this.profile.answers.preferredDays.map(d => days[d]).join(', ');
      this.addAnswerRow(answersGrid, 'Preferred days', dayLabels);
    }

    // Preferred time
    if (this.profile.answers.preferredTime) {
      this.addAnswerRow(answersGrid, 'Preferred time', this.profile.answers.preferredTime);
    }

    // Recommendation Section
    const recSection = contentEl.createDiv('wm-modal-section wm-recommendation-section');
    recSection.createEl('h3', { text: '🎯 recommended settings' });

    const recGrid = recSection.createDiv('wm-recommendation-grid');

    // Session length
    this.addRecCard(
      recGrid,
      'Session length',
      `${this.profile.recommendation.sessionLengthMin} minutes`,
      '⏱️'
    );

    // Target
    const targetLabel = this.profile.recommendation.target.type === 'words'
      ? `${this.profile.recommendation.target.value} words`
      : `${this.profile.recommendation.target.value} minutes`;
    this.addRecCard(recGrid, 'Per-session target', targetLabel, '🎯');

    // Weekly frequency
    const freqLabel = this.profile.recommendation.sessionsPerWeek === 7
      ? 'Daily'
      : `${this.profile.recommendation.sessionsPerWeek}× per week`;
    this.addRecCard(recGrid, 'Frequency', freqLabel, '📅');

    // Show if overrides exist
    if (this.profile.overrides) {
      const overrideNotice = recSection.createDiv('wm-override-notice');
      overrideNotice.createEl('p', {
        text: '⚠️ manual overrides are active. Click "recalculate" to apply new recommendations.',
        cls: 'wm-override-text'
      });
    }

    // Calculation info
    const calcInfo = recSection.createDiv('wm-calc-info');
    const calcDate = new Date(this.profile.recommendation.calculatedAt);
    calcInfo.createEl('p', {
      text: `Calculated: ${calcDate.toLocaleDateString()} at ${calcDate.toLocaleTimeString()}`,
      cls: 'wm-calc-date'
    });
    calcInfo.createEl('p', {
      text: `Rule version: ${this.profile.recommendation.ruleVersion}`,
      cls: 'wm-rule-version'
    });

    // Check if needs recalculation
    if (EstimationEngine.needsRecalculation(this.profile.recommendation)) {
      const updateNotice = contentEl.createDiv('wm-update-notice');
      updateNotice.createEl('p', {
        text: '🔄 new calculation rules available. Click "recalculate" to update.',
        cls: 'wm-update-text'
      });
    }

    // Action buttons
    const actions = contentEl.createDiv('wm-modal-actions');

    const editBtn = actions.createEl('button', {
      text: 'Edit answers',
      cls: 'wm-modal-btn wm-modal-btn-secondary'
    });
    editBtn.addEventListener('click', () => {
      this.close();
      this.onEdit();
    });

    const recalcBtn = actions.createEl('button', {
      text: 'Recalculate',
      cls: 'wm-modal-btn wm-modal-btn-primary'
    });
    recalcBtn.addEventListener('click', () => {
      const newRec = EstimationEngine.estimate(this.profile.answers);
      this.close();
      this.onRecalculate(newRec);
    });

    const closeBtn = actions.createEl('button', {
      text: 'Close',
      cls: 'wm-modal-btn wm-modal-btn-close'
    });
    closeBtn.addEventListener('click', () => {
      this.close();
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }

  private addAnswerRow(container: HTMLElement, label: string, value: string) {
    const row = container.createDiv('wm-answer-row');
    row.createEl('div', { text: label, cls: 'wm-answer-label' });
    row.createEl('div', { text: value, cls: 'wm-answer-value' });
  }

  private addRecCard(container: HTMLElement, label: string, value: string, icon: string) {
    const card = container.createDiv('wm-rec-card');
    card.createEl('div', { text: icon, cls: 'wm-rec-icon' });
    card.createEl('div', { text: value, cls: 'wm-rec-value' });
    card.createEl('div', { text: label, cls: 'wm-rec-label' });
  }

  private getPurposeLabel(purpose: string): string {
    const labels: Record<string, string> = {
      express: '📝 Self-Expression',
      monetize: '💰 Monetization',
      fun: '🎉 Fun & Creativity',
      skill: '📚 Skill Development',
      custom: '✏️ Custom'
    };
    return labels[purpose] || purpose;
  }
}
