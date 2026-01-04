import { App, PluginSettingTab, Setting, Modal } from 'obsidian';
import type { IWritingMomentumPlugin } from '../types/plugin-interface';
import { WritingPurposeModal } from './writing-purpose-modal';
import { QaOnboardingWizard } from './qa-onboarding-wizard';

class ConfirmModal extends Modal {
	private message: string;
	private onConfirm: () => void;

	constructor(app: App, message: string, onConfirm: () => void) {
		super(app);
		this.message = message;
		this.onConfirm = onConfirm;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('p', { text: this.message });

		const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });

		const confirmBtn = buttonContainer.createEl('button', { text: 'Confirm', cls: 'mod-warning' });
		confirmBtn.addEventListener('click', () => {
			this.close();
			this.onConfirm();
		});

		const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelBtn.addEventListener('click', () => {
			this.close();
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

export class WritingMomentumSettingTab extends PluginSettingTab {
	plugin: IWritingMomentumPlugin;

	constructor(app: App, plugin: IWritingMomentumPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		try {
			const {containerEl} = this;
			containerEl.empty();

			;

		// Reminders Section
		new Setting(containerEl).setName("⏰ reminders and notifications").setHeading();
		
		new Setting(containerEl)
			.setName('Default reminder time')
			.setDesc('Time for daily writing reminders (24-hour format)')
			.addText(text => text
				.setPlaceholder('21:00')
				.setValue(this.plugin.settings.reminders[0]?.time || '21:00')
				.onChange(async (value) => {
					if (this.plugin.settings.reminders.length === 0) {
						// Create default reminder if none exist
						this.plugin.settings.reminders.push({
							id: 'default-reminder',
							days: [1, 2, 3, 4, 5, 6, 0],
							time: value,
							enabled: true
						});
					} else {
						this.plugin.settings.reminders[0].time = value;
					}
					await this.plugin.saveSettings();
				}));

		// Streak Section
		new Setting(containerEl).setName("🔥 streak tracking").setHeading();
		
		new Setting(containerEl)
			.setName('Streak mode')
			.setDesc('How to calculate writing streaks')
			.addDropdown(dropdown => dropdown
				.addOption('daily', 'Daily')
				.addOption('weekly', 'Weekly')
				.setValue(this.plugin.settings.streakRule.mode)
				.onChange(async (value: 'daily' | 'weekly') => {
					this.plugin.settings.streakRule.mode = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Weekly target')
			.setDesc('Number of writing days needed per week')
			.addSlider(slider => slider
				.setLimits(1, 7, 1)
				.setValue(this.plugin.settings.streakRule.target)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.streakRule.target = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Grace days')
			.setDesc('Number of days you can miss without breaking streak')
			.addSlider(slider => slider
				.setLimits(0, 3, 1)
				.setValue(this.plugin.settings.streakRule.grace)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.streakRule.grace = value;
					await this.plugin.saveSettings();
				}));

		// UI Section
		new Setting(containerEl).setName("🎨 interface").setHeading();

		new Setting(containerEl)
			.setName('Show status bar')
			.setDesc('Display writing progress in the status bar')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.ui.showStatusBar)
				.onChange(async (value) => {
					this.plugin.settings.ui.showStatusBar = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Show ribbon icon')
			.setDesc('Display plugin icon in the left ribbon')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.ui.showRibbonIcon)
				.onChange(async (value) => {
					this.plugin.settings.ui.showRibbonIcon = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Enable notifications')
			.setDesc('Show notifications for achievements and reminders')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.ui.notifications)
				.onChange(async (value) => {
					this.plugin.settings.ui.notifications = value;
					await this.plugin.saveSettings();
				}));

		// Continuous Writing Section
		new Setting(containerEl).setName("🔥 continuous writing").setHeading();

		new Setting(containerEl)
			.setName('Enable continuous writing mode')
			.setDesc('Track consecutive writing sessions for extended focus periods')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.continuousWriting.enabled)
				.onChange(async (value) => {
					this.plugin.settings.continuousWriting.enabled = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Target sessions')
			.setDesc('Number of consecutive sessions to complete (e.g., 30 sessions)')
			.addSlider(slider => slider
				.setLimits(5, 100, 5)
				.setValue(this.plugin.settings.continuousWriting.targetSessions)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.continuousWriting.targetSessions = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Session duration')
			.setDesc('Minutes per continuous writing session')
			.addSlider(slider => slider
				.setLimits(10, 60, 5)
				.setValue(this.plugin.settings.continuousWriting.sessionDuration)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.continuousWriting.sessionDuration = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Reset continuous writing counter')
			.setDesc('Reset your current progress and start over')
			.addButton(button => button
				.setButtonText('Reset counter')
				.setClass('mod-warning')
				.onClick(async () => {
					this.plugin.settings.continuousWriting.currentCount = 0;
					await this.plugin.saveSettings();
					this.display(); // Refresh to show updated count
				}));

		// Show current progress
		const progressEl = containerEl.createDiv('continuous-writing-progress');
		new Setting(progressEl).setName("Current progress").setHeading();
		const currentCount = this.plugin.settings.continuousWriting.currentCount;
		const targetCount = this.plugin.settings.continuousWriting.targetSessions;
		progressEl.createEl('p', {
			text: `${currentCount} / ${targetCount} sessions completed (${Math.round((currentCount / targetCount) * 100)}%)`,
			cls: 'progress-text'
		});

		const progressBar = progressEl.createEl('div', {cls: 'progress-bar-container'});
		const progressFill = progressBar.createEl('div', {cls: 'progress-bar-fill'});
		// Use CSS class for width instead of inline style
		const percentage = Math.min(Math.round(((currentCount / targetCount) * 100) / 5) * 5, 100); // Round to nearest 5
		progressFill.addClass(`width-${percentage}`);

		// Pre-QnA Section
		new Setting(containerEl).setName("📋 writing profile (steps 1-3)").setHeading();

		if (this.plugin.activeProfile) {
			// Display profile summary
			const preQnaSummary = containerEl.createDiv('wm-pre-qna-summary');

			// Step 1: Purpose
			const purposeRow = preQnaSummary.createDiv('wm-qna-row');
			purposeRow.createEl('span', {text: '1. Purpose:', cls: 'wm-qna-label'});
			purposeRow.createEl('span', {
				text: this.getPurposeLabel(this.plugin.activeProfile.answers.purpose),
				cls: 'wm-qna-value'
			});

			// Step 2: Outcome
			const outcomeRow = preQnaSummary.createDiv('wm-qna-row');
			outcomeRow.createEl('span', {text: '2. What you want:', cls: 'wm-qna-label'});
			outcomeRow.createEl('span', {
				text: this.plugin.activeProfile.answers.outcome || 'Not specified',
				cls: 'wm-qna-value'
			});

			// Step 3: Final Goal
			if (this.plugin.activeProfile.answers.finalGoal) {
				const goalRow = preQnaSummary.createDiv('wm-qna-row');
				goalRow.createEl('span', {text: '3. Final goal:', cls: 'wm-qna-label'});
				goalRow.createEl('span', {
					text: this.plugin.activeProfile.answers.finalGoal,
					cls: 'wm-qna-value'
				});
			}

			// Action buttons
			const preQnaActions = containerEl.createDiv('wm-pre-qna-actions');

			new Setting(preQnaActions)
				.setName('View detailed profile')
				.setDesc('See full writing purpose modal')
				.addButton(button => button
					.setButtonText('View details')
					.onClick(() => {
						if (this.plugin.activeProfile) {
							new WritingPurposeModal(this.app, this.plugin.activeProfile).open();
						}
					}));

			new Setting(preQnaActions)
				.setName('Reset profile')
				.setDesc('Clear all answers and start over')
				.addButton(button => button
					.setButtonText('Reset')
					.setClass('mod-warning')
					.onClick(() => {
						new ConfirmModal(
							this.app,
							'Are you sure you want to reset your writing profile? This will clear all your answers.',
							() => {
								void (async () => {
									this.plugin.activeProfile = null;
									this.plugin.sessionLogs = [];
									await this.plugin.savePurposeData();

									if (this.plugin.purposeSessionManager) {
										this.plugin.purposeSessionManager.destroy();
										this.plugin.purposeSessionManager = null;
									}

									this.display();
								})();
							}
						).open();
					}));
		} else {
			// No profile - show onboarding button
			new Setting(containerEl)
				.setName('Create writing profile')
				.setDesc('Answer questions to set up your writing goals')
				.addButton(button => button
					.setButtonText('Start onboarding')
					.setClass('mod-cta')
					.onClick(() => {
						new QaOnboardingWizard(this.app, (profile) => {
							void (async () => {
								this.plugin.activeProfile = profile;
								await this.plugin.savePurposeData();
								this.display();
							})();
						}).open();
					}));
		}

		// Template Configuration Section
		new Setting(containerEl).setName("📝 template configuration").setHeading();

		// Reference information
		const referenceEl = containerEl.createDiv('template-reference');
		new Setting(referenceEl).setName("Available variables").setHeading();
		const variablesList = referenceEl.createEl('ul');
		const variables = [
			'{{date}} - Current date (format configurable)',
			'{{time}} - Current time (HH:MM)',
			'{{weekday}} - Day of the week',
			'{{vault}} - Your vault name',
			'{{random_prompt}} - Random writing prompt',
			'{{title}} - Custom title (if provided)'
		];
		variables.forEach(variable => {
			const li = variablesList.createEl('li');
			li.textContent = variable;
		});

		// Template presets
		const templates = [
			{
				name: 'Daily Journal',
				title: '{{date}} - Daily Journal',
				template: '# Daily Journal - {{date}}\n\n## Morning Reflection\n{{random_prompt}}\n\n## Today\'s Events\n- \n- \n- \n\n## Thoughts & Feelings\n\n\n## Gratitude\n1. \n2. \n3. \n\n---\n*Written on {{weekday}} at {{time}}*'
			},
			{
				name: 'Quick Notes',
				title: '{{time}} - Quick Note',
				template: '# Quick Note\n\n## Idea\n{{random_prompt}}\n\n## Details\n\n\n## Next Steps\n- [ ] \n- [ ] \n\n---\n*{{weekday}} {{time}}*'
			},
			{
				name: 'Project Planning',
				title: 'Project - {{title}}',
				template: '# Project: {{title}}\n\n## Goal\n{{random_prompt}}\n\n## Overview\n**Start Date:** {{date}}\n**Status:** Planning\n\n## Tasks\n- [ ] Task 1\n- [ ] Task 2\n- [ ] Task 3\n\n## Timeline\n\n\n## Resources\n\n\n---\n*Created {{weekday}}, {{date}} at {{time}}*'
			}
		];

		// Template selector
		new Setting(containerEl)
			.setName('Template preset')
			.setDesc('Choose a template to customize')
			.addDropdown(dropdown => {
				dropdown.addOption('custom', 'Custom template');
				templates.forEach((template, index) => {
					dropdown.addOption(index.toString(), template.name);
				});

				// Set current value based on settings
				const currentTemplate = templates.find(t =>
					t.title === this.plugin.settings.defaultTitlePattern &&
					t.template === this.plugin.settings.defaultTemplate
				);
				dropdown.setValue(currentTemplate ? templates.indexOf(currentTemplate).toString() : 'custom');

				dropdown.onChange((value) => {
					if (value === 'custom') return;

					const selectedTemplate = templates[parseInt(value)];
					this.plugin.settings.defaultTitlePattern = selectedTemplate.title;
					this.plugin.settings.defaultTemplate = selectedTemplate.template;
					void this.plugin.saveSettings();

					// Refresh the display to update all fields
					this.display();
				});
			});


		// Paths Section
		new Setting(containerEl).setName("📁 file paths").setHeading();

		new Setting(containerEl)
			.setName('Prompts file')
			.setDesc('File containing writing prompts')
			.addText(text => text
				.setPlaceholder('.writing-momentum/prompts.md')
				.setValue(this.plugin.settings.paths.prompts)
				.onChange(async (value) => {
					this.plugin.settings.paths.prompts = value;
					await this.plugin.saveSettings();
				}));

		// Data Management
		new Setting(containerEl).setName("💾 data management").setHeading();
		
		new Setting(containerEl)
			.setName('Export data')
			.setDesc('Export all writing sessions and streak data')
			.addButton(button => button
				.setButtonText('Export')
				.onClick(() => {
					const data = this.plugin.dataManager.exportData();
					const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
					const url = URL.createObjectURL(blob);
					const a = document.createElement('a');
					a.href = url;
					a.download = `writing-momentum-export-${new Date().toISOString().split('T')[0]}.json`;
					a.click();
				}));

		// Page Title Pattern Editor (Full Width)
		new Setting(containerEl).setName("Page title pattern").setHeading();

		const titlePatternContainer = containerEl.createDiv('title-pattern-container');
		titlePatternContainer.createEl('p', {
			text: 'Pattern for new page titles. Use variables like {{date}}, {{time}}, {{title}}, etc.',
			cls: 'title-pattern-description'
		});

		const titleInput = titlePatternContainer.createEl('input', {
			cls: 'title-pattern-editor',
			attr: {
				type: 'text',
				placeholder: '{{date}} - Writing Session'
			}
		});

		titleInput.value = this.plugin.settings.defaultTitlePattern || '{{date}} - Writing Session';

		titleInput.addEventListener('input', () => {
			void (async () => {
				this.plugin.settings.defaultTitlePattern = titleInput.value;
				await this.plugin.saveSettings();
			})();
		});

		// Template Content Editor (Full Width)
		new Setting(containerEl).setName("Template content editor").setHeading();

		const templateContentContainer = containerEl.createDiv('template-content-container');
		templateContentContainer.createEl('p', {
			text: 'Edit your template content below. Use variables like {{date}}, {{time}}, {{random_prompt}}, etc.',
			cls: 'template-content-description'
		});

		const templateTextarea = templateContentContainer.createEl('textarea', {
			cls: 'template-content-editor',
			attr: {
				placeholder: '# {{title}}\n\n## Prompt\n{{random_prompt}}\n\n## Writing\n\n\n---\n*Written on {{weekday}} at {{time}}*'
			}
		});

		templateTextarea.value = this.plugin.settings.defaultTemplate || '# {{title}}\n\n## Prompt\n{{random_prompt}}\n\n## Writing\n\n\n---\n*Written on {{weekday}} at {{time}}*';

		templateTextarea.addEventListener('input', () => {
			void (async () => {
				this.plugin.settings.defaultTemplate = templateTextarea.value;
				await this.plugin.saveSettings();
			})();
		});
		} catch (error) {
			console.error('Error in WritingMomentumSettingTab.display():', error);
			const {containerEl} = this;
			containerEl.empty();
			;
			containerEl.createEl('p', {
				text: 'An error occurred while loading settings. Please check the console for details.',
				cls: 'mod-warning'
			});
		}
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