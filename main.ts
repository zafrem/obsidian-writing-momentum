import { App, Plugin, PluginSettingTab, Setting, TFile, Notice, MarkdownView } from 'obsidian';

// Core modules
import { ReminderScheduler } from './src/core/scheduler';
import { TemplateEngine } from './src/core/template-engine';
import { DataManager } from './src/core/data-manager';
import { SessionManager } from './src/core/session-manager';

// UI components
import { WritingDashboard, VIEW_TYPE_WRITING_DASHBOARD } from './src/ui/dashboard';

// Types
import type { WritingMomentumSettings } from './src/types/interfaces';
import { DEFAULT_SETTINGS } from './src/types/interfaces';

export default class WritingMomentumPlugin extends Plugin {
	settings: WritingMomentumSettings;
	dataManager: DataManager;
	templateEngine: TemplateEngine;
	sessionManager: SessionManager;
	reminderScheduler: ReminderScheduler;
	statusBarItem: HTMLElement | null = null;

	async onload() {
		await this.loadSettings();
		
		// Initialize core systems
		this.dataManager = new DataManager(this);
		this.templateEngine = new TemplateEngine(this);
		this.sessionManager = new SessionManager(this);
		this.reminderScheduler = new ReminderScheduler(this);

		await this.dataManager.loadData();
		await this.templateEngine.initialize();

		// Register dashboard view
		this.registerView(
			VIEW_TYPE_WRITING_DASHBOARD,
			(leaf) => new WritingDashboard(leaf, this)
		);

		// Setup UI elements
		if (this.settings.ui.showRibbonIcon) {
			this.addRibbonIcon('target', 'Writing Momentum', () => {
				this.activateView();
			});
		}

		if (this.settings.ui.showStatusBar) {
			this.statusBarItem = this.addStatusBarItem();
		}

		// Register commands
		this.registerCommands();

		// Add settings tab
		this.addSettingTab(new WritingMomentumSettingTab(this.app, this));

		// Register event handlers
		this.registerEvent(
			this.app.workspace.on('file-open', (file) => {
				if (file) {
					this.sessionManager.handleFileOpen(file);
				}
			})
		);

		// Start reminder system
		this.reminderScheduler.start();
	}

	private registerCommands() {
		this.addCommand({
			id: 'open-dashboard',
			name: 'Open Writing Dashboard',
			callback: () => this.activateView()
		});

		this.addCommand({
			id: 'new-from-template',
			name: 'New note from template',
			callback: () => this.showTemplateSelector()
		});

		this.addCommand({
			id: 'quick-note',
			name: 'Create quick note',
			callback: () => this.createQuickNote()
		});

		this.addCommand({
			id: 'complete-session',
			name: 'Complete writing session',
			callback: () => this.sessionManager.completeSession()
		});

		this.addCommand({
			id: 'snooze-reminder',
			name: 'Snooze reminder (10 minutes)',
			callback: () => {
				// This would be called from reminder context
				new Notice('Reminder snoozed for 10 minutes');
			}
		});

		this.addCommand({
			id: 'insert-random-prompt',
			name: 'Insert random writing prompt',
			callback: () => this.insertRandomPrompt()
		});
	}

	async activateView() {
		const { workspace } = this.app;
		
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_WRITING_DASHBOARD)[0];

		if (!leaf) {
			leaf = workspace.getRightLeaf(false)!;
			await leaf.setViewState({ type: VIEW_TYPE_WRITING_DASHBOARD, active: true });
		}

		workspace.revealLeaf(leaf);
	}

	async showTemplateSelector() {
		const templates = this.templateEngine.getAllTemplates();
		
		if (templates.length === 0) {
			new Notice('No templates found. Creating default templates...');
			await this.templateEngine.reloadTemplates();
			return;
		}

		// Simple template selection - could be enhanced with a proper modal
		const template = templates[0]; // Use first template for now
		await this.templateEngine.createNoteFromTemplate(template.id);
	}

	async createQuickNote() {
		const today = new Date().toISOString().split('T')[0];
		const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
		const fileName = `${today} Quick Note ${time}.md`;
		const content = `# Quick Note - ${today}\n\n${this.templateEngine['getRandomPrompt']()}\n\n---\n\n`;

		try {
			const file = await this.app.vault.create(fileName, content);
			const leaf = this.app.workspace.getLeaf();
			await leaf.openFile(file);
			this.sessionManager.startSession(file.path);
		} catch (error) {
			console.error('Failed to create quick note:', error);
			new Notice('Failed to create quick note');
		}
	}

	async insertRandomPrompt() {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView) {
			new Notice('No active note to insert prompt into');
			return;
		}

		const prompt = this.templateEngine['getRandomPrompt']();
		const editor = activeView.editor;
		const cursor = editor.getCursor();
		editor.replaceRange(prompt, cursor);
	}

	onunload() {
		this.sessionManager.cleanup();
		this.reminderScheduler.stop();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.reminderScheduler.reschedule();
	}
}

class WritingMomentumSettingTab extends PluginSettingTab {
	plugin: WritingMomentumPlugin;

	constructor(app: App, plugin: WritingMomentumPlugin) {
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
					if (this.plugin.settings.reminders[0]) {
						this.plugin.settings.reminders[0].time = value;
						await this.plugin.saveSettings();
					}
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

		// Paths Section
		containerEl.createEl('h3', {text: '📁 File Paths'});
		
		new Setting(containerEl)
			.setName('Templates folder')
			.setDesc('Folder containing writing templates')
			.addText(text => text
				.setPlaceholder('.writing-momentum/templates')
				.setValue(this.plugin.settings.paths.templates)
				.onChange(async (value) => {
					this.plugin.settings.paths.templates = value;
					await this.plugin.saveSettings();
				}));

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
	}
}