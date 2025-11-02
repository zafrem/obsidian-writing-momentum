import { App, PluginSettingTab, Setting, Modal, Notice } from 'obsidian';
import type { IWritingMomentumPlugin } from '../types/plugin-interface';
import { WritingPurposeModal } from './writing-purpose-modal';
import { QaOnboardingWizard } from './qa-onboarding-wizard';
import type { Template } from '../types/interfaces';

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

		// Pre-QnA Section
		containerEl.createEl('h3', {text: '📋 Writing Profile (Steps 1-3)'});

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
					.setButtonText('View Details')
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
					.onClick(async () => {
						const confirmed = confirm('Are you sure you want to reset your writing profile? This will clear all your answers.');
						if (confirmed) {
							this.plugin.activeProfile = null;
							this.plugin.sessionLogs = [];
							await this.plugin.savePurposeData();

							if (this.plugin.purposeSessionManager) {
								this.plugin.purposeSessionManager.destroy();
								this.plugin.purposeSessionManager = null;
							}

							this.display();
						}
					}));
		} else {
			// No profile - show onboarding button
			new Setting(containerEl)
				.setName('Create writing profile')
				.setDesc('Answer questions to set up your writing goals')
				.addButton(button => button
					.setButtonText('Start Onboarding')
					.setClass('mod-cta')
					.onClick(() => {
						new QaOnboardingWizard(this.app, async (profile) => {
							this.plugin.activeProfile = profile;
							await this.plugin.savePurposeData();
							this.display();
						}).open();
					}));
		}

		// General Settings
		containerEl.createEl('h3', {text: '⚙️ General Settings'});

		// Ensure ui object exists
		if (!this.plugin.settings.ui) {
			this.plugin.settings.ui = { showStatusBar: false, showRibbonIcon: false, notifications: false };
		}

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

		// Template Configuration
		containerEl.createEl('h3', {text: '📝 Template Management'});

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

		// Active template selector
		const activeTemplate = this.plugin.templateManager.getActiveTemplate();
		new Setting(containerEl)
			.setName('Active template')
			.setDesc('Select which template to use for new notes')
			.addDropdown(dropdown => {
				const templates = this.plugin.templateManager.getAllTemplates();
				templates.forEach(template => {
					dropdown.addOption(template.id, template.name);
				});

				dropdown.setValue(activeTemplate?.id || '');
				dropdown.onChange(async (value) => {
					await this.plugin.templateManager.setActiveTemplate(value);
					this.display();
				});
			});

		// Template list header
		const templateListHeader = containerEl.createDiv('template-list-header');
		templateListHeader.createEl('h4', {text: 'Your Templates'});

		new Setting(templateListHeader)
			.addButton(button => button
				.setButtonText('+ New Template')
				.setClass('mod-cta')
				.onClick(() => {
					new TemplateEditorModal(this.app, this.plugin, null, () => {
						this.display();
					}).open();
				}))
			.addButton(button => button
				.setButtonText('Import')
				.onClick(() => {
					new TemplateImportModal(this.app, this.plugin, () => {
						this.display();
					}).open();
				}))
			.addButton(button => button
				.setButtonText('Export All')
				.onClick(() => {
					const json = this.plugin.templateManager.exportTemplates();
					const blob = new Blob([json], { type: 'application/json' });
					const url = URL.createObjectURL(blob);
					const a = document.createElement('a');
					a.href = url;
					a.download = `writing-momentum-templates-${new Date().toISOString().split('T')[0]}.json`;
					a.click();
					new Notice('Templates exported');
				}));

		// Template list
		const templateListContainer = containerEl.createDiv('template-list-container');
		this.renderTemplateList(templateListContainer);

		// File Paths
		containerEl.createEl('h3', {text: '📁 File Paths'});

		// Ensure paths object exists
		if (!this.plugin.settings.paths) {
			this.plugin.settings.paths = { prompts: '' };
		}

		new Setting(containerEl)
			.setName('Prompts file')
			.setDesc('File containing writing prompts')
			.addText(text => text
				.setPlaceholder('.writing-momentum/prompts.md')
				.setValue(this.plugin.settings.paths.prompts || '')
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

	private renderTemplateList(container: HTMLElement): void {
		container.empty();

		const templates = this.plugin.templateManager.getAllTemplates();

		// Separate built-in and custom templates
		const builtInTemplates = templates.filter(t => t.isBuiltIn);
		const customTemplates = templates.filter(t => !t.isBuiltIn);

		// Built-in templates section
		if (builtInTemplates.length > 0) {
			container.createEl('h5', { text: 'Built-in Templates', cls: 'template-section-header' });
			builtInTemplates.forEach(template => {
				this.renderTemplateItem(container, template, true);
			});
		}

		// Custom templates section
		if (customTemplates.length > 0) {
			container.createEl('h5', { text: 'Custom Templates', cls: 'template-section-header' });
			customTemplates.forEach(template => {
				this.renderTemplateItem(container, template, false);
			});
		}

		if (customTemplates.length === 0) {
			const emptyState = container.createDiv('template-empty-state');
			emptyState.createEl('p', { text: 'No custom templates yet. Click "New Template" to create one.' });
		}
	}

	private renderTemplateItem(container: HTMLElement, template: Template, isBuiltIn: boolean): void {
		const setting = new Setting(container)
			.setName(template.name)
			.setDesc(template.description || `Title: ${template.titlePattern}`);

		// Preview button
		setting.addButton(button => button
			.setButtonText('Preview')
			.setTooltip('View template content')
			.onClick(() => {
				new TemplatePreviewModal(this.app, template).open();
			}));

		if (!isBuiltIn) {
			// Edit button for custom templates
			setting.addButton(button => button
				.setIcon('pencil')
				.setTooltip('Edit template')
				.onClick(() => {
					new TemplateEditorModal(this.app, this.plugin, template, () => {
						this.display();
					}).open();
				}));

			// Duplicate button
			setting.addButton(button => button
				.setIcon('copy')
				.setTooltip('Duplicate template')
				.onClick(async () => {
					try {
						await this.plugin.templateManager.duplicateTemplate(template.id);
						this.display();
					} catch (error) {
						new Notice(`Error: ${error.message}`);
					}
				}));

			// Delete button for custom templates
			setting.addButton(button => button
				.setIcon('trash')
				.setTooltip('Delete template')
				.setClass('mod-warning')
				.onClick(async () => {
					const confirmed = confirm(`Delete template "${template.name}"?`);
					if (confirmed) {
						try {
							await this.plugin.templateManager.deleteTemplate(template.id);
							this.display();
						} catch (error) {
							new Notice(`Error: ${error.message}`);
						}
					}
				}));
		} else {
			// Duplicate button for built-in templates
			setting.addButton(button => button
				.setIcon('copy')
				.setTooltip('Duplicate to customize')
				.onClick(async () => {
					try {
						const duplicated = await this.plugin.templateManager.duplicateTemplate(template.id);
						new Notice(`Created "${duplicated.name}". Edit it to customize.`);
						this.display();
					} catch (error) {
						new Notice(`Error: ${error.message}`);
					}
				}));
		}
	}
}

// Template Editor Modal
class TemplateEditorModal extends Modal {
	plugin: IWritingMomentumPlugin;
	template: Template | null;
	onSave: () => void;

	nameInput: HTMLInputElement;
	titlePatternInput: HTMLInputElement;
	contentTextarea: HTMLTextAreaElement;
	descriptionInput: HTMLInputElement;
	categoryDropdown: HTMLSelectElement;

	constructor(app: App, plugin: IWritingMomentumPlugin, template: Template | null, onSave: () => void) {
		super(app);
		this.plugin = plugin;
		this.template = template;
		this.onSave = onSave;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: this.template ? 'Edit Template' : 'Create New Template' });

		// Template name
		new Setting(contentEl)
			.setName('Template name')
			.setDesc('A descriptive name for this template')
			.addText(text => {
				this.nameInput = text.inputEl;
				text.setValue(this.template?.name || '')
					.setPlaceholder('My Custom Template');
			});

		// Category
		new Setting(contentEl)
			.setName('Category')
			.setDesc('Organize your template')
			.addDropdown(dropdown => {
				this.categoryDropdown = dropdown.selectEl;
				dropdown
					.addOption('custom', 'Custom')
					.addOption('daily', 'Daily Journal')
					.addOption('blog', 'Blog Post')
					.addOption('fiction', 'Fiction Writing')
					.setValue(this.template?.category || 'custom');
			});

		// Description
		new Setting(contentEl)
			.setName('Description')
			.setDesc('Optional description')
			.addText(text => {
				this.descriptionInput = text.inputEl;
				text.setValue(this.template?.description || '')
					.setPlaceholder('What is this template for?');
			});

		// Title pattern
		const titleSetting = new Setting(contentEl)
			.setName('Title pattern')
			.setDesc('Pattern for the note title. Use {{date}}, {{time}}, etc.');

		this.titlePatternInput = titleSetting.controlEl.createEl('input', {
			type: 'text',
			placeholder: '{{date}} - Writing Session',
			cls: 'template-title-input'
		});
		this.titlePatternInput.value = this.template?.titlePattern || '';

		// Content
		const contentSetting = contentEl.createDiv('template-content-setting');
		contentSetting.createEl('label', { text: 'Template Content', cls: 'setting-item-name' });
		contentSetting.createEl('div', {
			text: 'Use variables like {{date}}, {{time}}, {{random_prompt}}, etc.',
			cls: 'setting-item-description'
		});

		this.contentTextarea = contentSetting.createEl('textarea', {
			placeholder: '# {{title}}\n\n## Prompt\n{{random_prompt}}\n\n## Writing\n\n\n---\n*Written on {{weekday}} at {{time}}*',
			cls: 'template-content-textarea'
		});
		this.contentTextarea.value = this.template?.content || '';
		this.contentTextarea.rows = 15;

		// Buttons
		const buttonContainer = contentEl.createDiv('template-modal-buttons');

		const saveButton = buttonContainer.createEl('button', {
			text: this.template ? 'Save Changes' : 'Create Template',
			cls: 'mod-cta'
		});
		saveButton.addEventListener('click', () => this.handleSave());

		const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelButton.addEventListener('click', () => this.close());
	}

	async handleSave() {
		const name = this.nameInput.value.trim();
		const titlePattern = this.titlePatternInput.value.trim();
		const content = this.contentTextarea.value.trim();
		const description = this.descriptionInput.value.trim();
		const category = this.categoryDropdown.value as 'daily' | 'blog' | 'fiction' | 'custom';

		// Validate
		const validation = this.plugin.templateManager.validateTemplate(titlePattern, content);
		if (!validation.valid) {
			new Notice(`Validation errors:\n${validation.errors.join('\n')}`);
			return;
		}

		if (!name) {
			new Notice('Please enter a template name');
			return;
		}

		try {
			if (this.template) {
				// Update existing template
				await this.plugin.templateManager.updateTemplate(this.template.id, {
					name,
					titlePattern,
					content,
					description: description || undefined,
					category
				});
			} else {
				// Create new template
				await this.plugin.templateManager.createTemplate(
					name,
					titlePattern,
					content,
					{
						description: description || undefined,
						category
					}
				);
			}

			this.onSave();
			this.close();
		} catch (error) {
			new Notice(`Error: ${error.message}`);
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

// Template Preview Modal
class TemplatePreviewModal extends Modal {
	template: Template;

	constructor(app: App, template: Template) {
		super(app);
		this.template = template;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: this.template.name });

		if (this.template.description) {
			contentEl.createEl('p', { text: this.template.description, cls: 'template-preview-description' });
		}

		contentEl.createEl('h3', { text: 'Title Pattern' });
		contentEl.createEl('code', { text: this.template.titlePattern, cls: 'template-preview-code' });

		contentEl.createEl('h3', { text: 'Content' });
		const contentPre = contentEl.createEl('pre', { cls: 'template-preview-content' });
		contentPre.createEl('code', { text: this.template.content });

		if (this.template.variables && this.template.variables.length > 0) {
			contentEl.createEl('h3', { text: 'Variables Used' });
			const variablesList = contentEl.createEl('ul');
			this.template.variables.forEach(variable => {
				variablesList.createEl('li', { text: `{{${variable}}}` });
			});
		}

		const closeButton = contentEl.createEl('button', { text: 'Close', cls: 'mod-cta' });
		closeButton.addEventListener('click', () => this.close());
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

// Template Import Modal
class TemplateImportModal extends Modal {
	plugin: IWritingMomentumPlugin;
	onImport: () => void;

	constructor(app: App, plugin: IWritingMomentumPlugin, onImport: () => void) {
		super(app);
		this.plugin = plugin;
		this.onImport = onImport;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Import Templates' });
		contentEl.createEl('p', { text: 'Paste the exported template JSON below:' });

		const textarea = contentEl.createEl('textarea', {
			placeholder: 'Paste template JSON here...',
			cls: 'template-import-textarea'
		});
		textarea.rows = 10;

		const buttonContainer = contentEl.createDiv('template-modal-buttons');

		const importButton = buttonContainer.createEl('button', { text: 'Import', cls: 'mod-cta' });
		importButton.addEventListener('click', async () => {
			try {
				const jsonString = textarea.value.trim();
				if (!jsonString) {
					new Notice('Please paste template JSON');
					return;
				}

				await this.plugin.templateManager.importTemplates(jsonString);
				this.onImport();
				this.close();
			} catch (error) {
				new Notice(`Import failed: ${error.message}`);
			}
		});

		const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelButton.addEventListener('click', () => this.close());
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
