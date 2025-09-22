import { App, PluginSettingTab, Setting, TFile, TFolder } from 'obsidian';
import type { IWritingMomentumPlugin } from '../types/plugin-interface';

export class WritingMomentumSettingTab extends PluginSettingTab {
	plugin: IWritingMomentumPlugin;

	constructor(app: App, plugin: IWritingMomentumPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();

		containerEl.createEl('h2', {text: 'Writing Momentum Settings'});

		// Reminders Section
		containerEl.createEl('h3', {text: '⏰ Reminders'});
		
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
		containerEl.createEl('h3', {text: '🔥 Streak Settings'});
		
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
		containerEl.createEl('h3', {text: '🎨 Interface'});

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
		containerEl.createEl('h3', {text: '🔥 Continuous Writing'});

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
				.setButtonText('Reset Counter')
				.setClass('mod-warning')
				.onClick(async () => {
					this.plugin.settings.continuousWriting.currentCount = 0;
					await this.plugin.saveSettings();
					this.display(); // Refresh to show updated count
				}));

		// Show current progress
		const progressEl = containerEl.createDiv('continuous-writing-progress');
		progressEl.createEl('h4', {text: 'Current Progress'});
		const currentCount = this.plugin.settings.continuousWriting.currentCount;
		const targetCount = this.plugin.settings.continuousWriting.targetSessions;
		const progressText = progressEl.createEl('p', {
			text: `${currentCount} / ${targetCount} sessions completed (${Math.round((currentCount / targetCount) * 100)}%)`,
			cls: 'progress-text'
		});

		const progressBar = progressEl.createEl('div', {cls: 'progress-bar-container'});
		const progressFill = progressBar.createEl('div', {cls: 'progress-bar-fill'});
		// Use CSS class for width instead of inline style
		const percentage = Math.min(Math.round(((currentCount / targetCount) * 100) / 5) * 5, 100); // Round to nearest 5
		progressFill.addClass(`width-${percentage}`);

		// Template Configuration Section
		containerEl.createEl('h3', {text: '📝 Template Configuration'});

		// Reference information
		const referenceEl = containerEl.createDiv('template-reference');
		referenceEl.createEl('h4', {text: 'Available Variables'});
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
		let titleInput: HTMLInputElement;
		let templateTextarea: HTMLTextAreaElement;

		new Setting(containerEl)
			.setName('Template preset')
			.setDesc('Choose a template to customize')
			.addDropdown(dropdown => {
				dropdown.addOption('custom', 'Custom Template');
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
					this.plugin.saveSettings();

					// Refresh the display to update all fields
					this.display();
				});
			});


		// Paths Section
		containerEl.createEl('h3', {text: '📁 File Paths'});

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
		containerEl.createEl('h3', {text: '💾 Data Management'});
		
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
		containerEl.createEl('h3', {text: 'Page Title Pattern'});

		const titlePatternContainer = containerEl.createDiv('title-pattern-container');
		titlePatternContainer.createEl('p', {
			text: 'Pattern for new page titles. Use variables like {{date}}, {{time}}, {{title}}, etc.',
			cls: 'title-pattern-description'
		});

		titleInput = titlePatternContainer.createEl('input', {
			cls: 'title-pattern-editor',
			attr: {
				type: 'text',
				placeholder: '{{date}} - Writing Session'
			}
		});

		titleInput.value = this.plugin.settings.defaultTitlePattern || '{{date}} - Writing Session';

		titleInput.addEventListener('input', async () => {
			this.plugin.settings.defaultTitlePattern = titleInput.value;
			await this.plugin.saveSettings();
		});

		// Template Content Editor (Full Width)
		containerEl.createEl('h3', {text: 'Template Content Editor'});

		const templateContentContainer = containerEl.createDiv('template-content-container');
		templateContentContainer.createEl('p', {
			text: 'Edit your template content below. Use variables like {{date}}, {{time}}, {{random_prompt}}, etc.',
			cls: 'template-content-description'
		});

		templateTextarea = templateContentContainer.createEl('textarea', {
			cls: 'template-content-editor',
			attr: {
				placeholder: '# {{title}}\n\n## Prompt\n{{random_prompt}}\n\n## Writing\n\n\n---\n*Written on {{weekday}} at {{time}}*'
			}
		});

		templateTextarea.value = this.plugin.settings.defaultTemplate || '# {{title}}\n\n## Prompt\n{{random_prompt}}\n\n## Writing\n\n\n---\n*Written on {{weekday}} at {{time}}*';

		templateTextarea.addEventListener('input', async () => {
			this.plugin.settings.defaultTemplate = templateTextarea.value;
			await this.plugin.saveSettings();
		});
	}

}