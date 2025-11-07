import { Modal, App, Setting } from 'obsidian';
import type { Purpose, QaAnswers, UnitType, Feasibility, WritingProfile } from '../types/interfaces';
import { EstimationEngine } from '../core/estimation-engine';

export class QaOnboardingWizard extends Modal {
  private step = 1;
  private totalSteps = 5;
  private answers: Partial<QaAnswers> = {};
  private onComplete: (profile: WritingProfile) => void;
  private nextButton: HTMLButtonElement | null = null;

  constructor(app: App, onComplete: (profile: WritingProfile) => void) {
    super(app);
    this.onComplete = onComplete;
  }

  onOpen() {
    this.renderStep();
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }

  private renderStep() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('wm-onboarding-wizard');

    // Header
    const header = contentEl.createDiv('wm-wizard-header');
    header.createEl('h2', { text: 'Writing goals setup' });
    header.createEl('p', {
      text: `Help us understand your writing needs (Step ${this.step} of ${this.totalSteps})`
    });

    // Progress bar
    const progressContainer = contentEl.createDiv('wm-wizard-progress');
    const progressBar = progressContainer.createDiv('wm-wizard-progress-bar');
    progressBar.style.width = `${(this.step / this.totalSteps) * 100}%`;

    // Step content
    const stepContent = contentEl.createDiv('wm-wizard-content');

    switch (this.step) {
      case 1:
        this.renderPurposeStep(stepContent);
        break;
      case 2:
        this.renderOutcomeStep(stepContent);
        break;
      case 3:
        this.renderFinalGoalStep(stepContent);
        break;
      case 4:
        this.renderUnitStep(stepContent);
        break;
      case 5:
        this.renderRoutineStep(stepContent);
        break;
    }

    // Navigation buttons
    this.renderNavigation(contentEl);
  }

  private renderPurposeStep(container: HTMLElement) {
    container.createEl('h3', { text: 'Why do you want to write?' });
    container.createEl('p', {
      text: 'This helps us suggest the right amount of time and effort.',
      cls: 'wm-wizard-description'
    });

    const purposes: { value: Purpose; label: string; description: string }[] = [
      {
        value: 'express',
        label: '📝 Self-Expression',
        description: 'Explore thoughts, journal, personal reflection'
      },
      {
        value: 'monetize',
        label: '💰 Monetization',
        description: 'Professional writing, publication, income'
      },
      {
        value: 'fun',
        label: '🎉 Fun & Creativity',
        description: 'Enjoyment, creative exploration, hobby'
      },
      {
        value: 'skill',
        label: '📚 Skill Development',
        description: 'Practice, improve writing craft, learn'
      },
      {
        value: 'custom',
        label: '✏️ Other',
        description: 'Something else (please describe)'
      }
    ];

    const optionsContainer = container.createDiv('wm-wizard-options');

    purposes.forEach(purpose => {
      const option = optionsContainer.createDiv('wm-wizard-option');
      if (this.answers.purpose === purpose.value) {
        option.addClass('selected');
      }

      const titleEl = option.createDiv('wm-wizard-option-title');
      titleEl.textContent = purpose.label;

      const descEl = option.createDiv('wm-wizard-option-desc');
      descEl.textContent = purpose.description;

      option.addEventListener('click', () => {
        this.answers.purpose = purpose.value;
        this.renderStep();
      });
    });

    // Custom purpose input
    if (this.answers.purpose === 'custom') {
      const customContainer = container.createDiv('wm-wizard-custom');
      new Setting(customContainer)
        .setName('Describe your purpose')
        .addText(text => text
          .setPlaceholder('E.g., academic research, technical documentation...')
          .setValue(this.answers.customPurpose || '')
          .onChange(value => {
            this.answers.customPurpose = value;
            this.updateNavigationState();
          }));
    }
  }

  private renderOutcomeStep(container: HTMLElement) {
    const outcomeData = this.getOutcomeData();

    container.createEl('h3', { text: outcomeData.question });
    container.createEl('p', {
      text: 'This helps us understand what you want from your writing.',
      cls: 'wm-wizard-description'
    });

    // For custom purpose, show free text input
    if (this.answers.purpose === 'custom') {
      const inputContainer = container.createDiv('wm-wizard-input-large');
      const textarea = inputContainer.createEl('textarea', {
        cls: 'wm-wizard-textarea',
        attr: { placeholder: 'Describe your goal in one line...' }
      });
      textarea.value = this.answers.outcome || '';
      textarea.addEventListener('input', () => {
        this.answers.outcome = textarea.value;
        this.updateNavigationState();
      });
    } else {
      // For predefined purposes, show multiple choice options
      const optionsContainer = container.createDiv('wm-wizard-options');

      outcomeData.choices.forEach(choice => {
        const option = optionsContainer.createDiv('wm-wizard-option');
        if (this.answers.outcome === choice) {
          option.addClass('selected');
        }

        const titleEl = option.createDiv('wm-wizard-option-title');
        titleEl.textContent = choice;

        option.addEventListener('click', () => {
          this.answers.outcome = choice;
          this.renderStep();
        });
      });
    }
  }

  private renderFinalGoalStep(container: HTMLElement) {
    container.createEl('h3', { text: 'What is your final writing goal?' });
    container.createEl('p', {
      text: 'Tell us the total amount you want to complete. This helps us recommend realistic daily targets.',
      cls: 'wm-wizard-description'
    });

    const goalExamples = container.createDiv('wm-wizard-examples');
    goalExamples.createEl('p', { text: 'Examples:', cls: 'wm-wizard-examples-label' });
    const examplesList = goalExamples.createEl('ul', { cls: 'wm-wizard-examples-list' });

    const examples = [
      'Write a 50,000 word novel',
      'Complete 20 hours of writing practice',
      'Publish 30 blog posts',
      'Write 100 pages of content'
    ];

    examples.forEach(example => {
      examplesList.createEl('li', { text: example });
    });

    const inputContainer = container.createDiv('wm-wizard-input-large');
    const textarea = inputContainer.createEl('textarea', {
      cls: 'wm-wizard-textarea',
      attr: { placeholder: 'Describe your total goal (e.g., "write a 50,000 word novel")...' }
    });
    textarea.value = this.answers.finalGoal || '';
    textarea.addEventListener('input', () => {
      this.answers.finalGoal = textarea.value;
      this.updateNavigationState();
    });
  }

  private renderUnitStep(container: HTMLElement) {
    container.createEl('h3', { text: 'How would you like to track progress?' });
    container.createEl('p', {
      text: 'Choose what feels most motivating to you.',
      cls: 'wm-wizard-description'
    });

    const units: { value: UnitType; label: string; description: string }[] = [
      {
        value: 'words',
        label: '📊 Word Count',
        description: 'Track by number of words written (e.g., 500 words per session)'
      },
      {
        value: 'minutes',
        label: '⏱️ Time',
        description: 'Track by time spent writing (e.g., 25 minutes per session)'
      }
    ];

    const optionsContainer = container.createDiv('wm-wizard-unit-options');

    units.forEach(unit => {
      const option = optionsContainer.createDiv('wm-wizard-unit-option');
      if (this.answers.unitPref === unit.value) {
        option.addClass('selected');
      }

      const iconEl = option.createDiv('wm-wizard-unit-icon');
      iconEl.textContent = unit.label.split(' ')[0];

      const contentDiv = option.createDiv('wm-wizard-unit-content');
      contentDiv.createEl('div', { text: unit.label, cls: 'wm-wizard-unit-label' });
      contentDiv.createEl('div', { text: unit.description, cls: 'wm-wizard-unit-desc' });

      option.addEventListener('click', () => {
        this.answers.unitPref = unit.value;
        this.renderStep();
      });
    });
  }

  private renderRoutineStep(container: HTMLElement) {
    container.createEl('h3', { text: 'About your schedule' });
    container.createEl('p', {
      text: 'Help us suggest a realistic writing frequency.',
      cls: 'wm-wizard-description'
    });

    // Feasibility
    const feasibilityContainer = container.createDiv('wm-wizard-section');
    feasibilityContainer.createEl('h4', { text: 'How is your schedule?' });

    const feasibilities: { value: Feasibility; label: string; description: string }[] = [
      {
        value: 'busy',
        label: 'Busy',
        description: this.answers.unitPref === 'words' ? '~400 words' : '~15 min per session'
      },
      {
        value: 'normal',
        label: 'Normal',
        description: this.answers.unitPref === 'words' ? '~800 words' : '~30 min per session'
      },
      {
        value: 'free',
        label: 'Flexible',
        description: this.answers.unitPref === 'words' ? '~1600 words' : '~1 hour per session'
      }
    ];

    const feasibilityGrid = feasibilityContainer.createDiv('wm-wizard-feasibility-grid');
    feasibilities.forEach(f => {
      const btn = feasibilityGrid.createEl('button', {
        text: f.label,
        cls: 'wm-wizard-feasibility-btn'
      });
      btn.createDiv({ text: f.description, cls: 'wm-wizard-feasibility-desc' });

      if (this.answers.feasibility === f.value) {
        btn.addClass('selected');
      }

      btn.addEventListener('click', () => {
        this.answers.feasibility = f.value;
        this.renderStep();
      });
    });

    // Preferred days (optional)
    const daysContainer = container.createDiv('wm-wizard-section');
    daysContainer.createEl('h4', { text: 'Preferred days (optional)' });
    daysContainer.createEl('p', {
      text: 'Select days when you typically have time to write.',
      cls: 'wm-wizard-description'
    });

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const daysGrid = daysContainer.createDiv('wm-wizard-days-grid');

    if (!this.answers.preferredDays) {
      this.answers.preferredDays = [];
    }

    days.forEach((day, index) => {
      const dayBtn = daysGrid.createEl('button', {
        text: day,
        cls: 'wm-wizard-day-btn'
      });

      if (this.answers.preferredDays?.includes(index)) {
        dayBtn.addClass('selected');
      }

      dayBtn.addEventListener('click', () => {
        if (!this.answers.preferredDays) {
          this.answers.preferredDays = [];
        }

        const idx = this.answers.preferredDays.indexOf(index);
        if (idx > -1) {
          this.answers.preferredDays.splice(idx, 1);
        } else {
          this.answers.preferredDays.push(index);
        }
        this.renderStep();
      });
    });

    // Preferred time (optional)
    const timeContainer = container.createDiv('wm-wizard-section');
    new Setting(timeContainer)
      .setName('Preferred time (optional)')
      .setDesc('When do you typically like to write?')
      .addText(text => text
        .setPlaceholder('20:30')
        .setValue(this.answers.preferredTime || '')
        .onChange(value => {
          this.answers.preferredTime = value;
        }));
  }

  private renderNavigation(container: HTMLElement) {
    const nav = container.createDiv('wm-wizard-nav');

    if (this.step > 1) {
      const backBtn = nav.createEl('button', {
        text: 'Back',
        cls: 'wm-wizard-btn wm-wizard-btn-back'
      });
      backBtn.addEventListener('click', () => {
        this.step--;
        this.renderStep();
      });
    }

    const nextBtn = nav.createEl('button', {
      text: this.step === this.totalSteps ? 'Calculate & finish' : 'Next',
      cls: 'wm-wizard-btn wm-wizard-btn-next'
    });

    this.nextButton = nextBtn;
    nextBtn.disabled = !this.canProceed();

    nextBtn.addEventListener('click', () => {
      if (this.step === this.totalSteps) {
        this.complete();
      } else {
        this.step++;
        this.renderStep();
      }
    });
  }

  private updateNavigationState() {
    if (this.nextButton) {
      this.nextButton.disabled = !this.canProceed();
    }
  }

  private canProceed(): boolean {
    switch (this.step) {
      case 1:
        return !!this.answers.purpose &&
               (this.answers.purpose !== 'custom' || !!this.answers.customPurpose);
      case 2:
        return !!this.answers.outcome && this.answers.outcome.trim().length > 0;
      case 3:
        return !!this.answers.finalGoal && this.answers.finalGoal.trim().length > 0;
      case 4:
        return !!this.answers.unitPref;
      case 5:
        return !!this.answers.feasibility;
      default:
        return false;
    }
  }

  private getOutcomeData(): { question: string; choices: string[] } {
    const outcomeMap: Record<string, { question: string; choices: string[] }> = {
      express: {
        question: 'What do you hope your writing gives you?',
        choices: [
          'Clearer thoughts',
          'Emotional release',
          'Daily reflection',
          'Document your growth'
        ]
      },
      monetize: {
        question: 'What result do you want from writing?',
        choices: [
          'Build audience',
          'Earn income',
          'Publish consistently',
          'Build portfolio'
        ]
      },
      fun: {
        question: 'What kind of writing feels most fun to you?',
        choices: [
          'Stories',
          'Free writing',
          'Poems',
          'Random prompts'
        ]
      },
      skill: {
        question: 'Which skill do you want to strengthen?',
        choices: [
          'Structure',
          'Clarity',
          'Style variety',
          'Speed'
        ]
      },
      custom: {
        question: 'Describe your goal in one line.',
        choices: []
      }
    };

    return outcomeMap[this.answers.purpose || 'custom'] || outcomeMap.custom;
  }

  private complete() {
    // Build complete QA answers
    const qaAnswers: QaAnswers = {
      purpose: this.answers.purpose!,
      customPurpose: this.answers.customPurpose,
      outcome: this.answers.outcome!,
      finalGoal: this.answers.finalGoal,
      unitPref: this.answers.unitPref!,
      targetHint: this.answers.targetHint,
      feasibility: this.answers.feasibility!,
      preferredDays: this.answers.preferredDays,
      preferredTime: this.answers.preferredTime
    };

    // Calculate recommendation using estimation engine
    const recommendation = EstimationEngine.estimate(qaAnswers);

    // Build profile
    const profile: WritingProfile = {
      id: `profile-${Date.now()}`,
      answers: qaAnswers,
      recommendation,
      notifyLevel: 'mid',
      breakMin: 5,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.onComplete(profile);
    this.close();
  }
}
