import { App, Plugin, PluginSettingTab, Setting, TFile, Notice, MarkdownView } from 'obsidian';

// Core modules
import { ReminderScheduler } from './src/core/scheduler';
import { TemplateEngine } from './src/core/template-engine';
import { DataManager } from './src/core/data-manager';
import { SessionManager } from './src/core/session-manager';

// UI components
import { WritingDashboard, VIEW_TYPE_WRITING_DASHBOARD } from './src/ui/dashboard';
import { WritingMomentumSettingTab } from './src/ui/settings-tab';

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
		console.log('Writing Momentum Plugin: Starting onload...');
		
		try {
			await this.loadSettings();
			console.log('Writing Momentum Plugin: Settings loaded');
			
			// Initialize core systems
			this.dataManager = new DataManager(this);
			console.log('Writing Momentum Plugin: DataManager initialized');
			
			this.templateEngine = new TemplateEngine(this);
			console.log('Writing Momentum Plugin: TemplateEngine initialized');
			
			this.sessionManager = new SessionManager(this);
			console.log('Writing Momentum Plugin: SessionManager initialized');
			
			this.reminderScheduler = new ReminderScheduler(this);
			console.log('Writing Momentum Plugin: ReminderScheduler initialized');

			await this.dataManager.loadData();
			console.log('Writing Momentum Plugin: Data loaded');
			
			await this.templateEngine.initialize();
			console.log('Writing Momentum Plugin: Templates initialized');

			// Register dashboard view
			this.registerView(
				VIEW_TYPE_WRITING_DASHBOARD,
				(leaf) => new WritingDashboard(leaf, this)
			);
			console.log('Writing Momentum Plugin: Dashboard view registered');

			// Setup UI elements
			if (this.settings.ui.showRibbonIcon) {
				this.addRibbonIcon('target', 'Writing Momentum', () => {
					this.activateView();
				});
				console.log('Writing Momentum Plugin: Ribbon icon added');
			}

			if (this.settings.ui.showStatusBar) {
				this.statusBarItem = this.addStatusBarItem();
				console.log('Writing Momentum Plugin: Status bar item added');
			}

			// Register commands
			this.registerCommands();
			console.log('Writing Momentum Plugin: Commands registered');

			// Add settings tab
			this.addSettingTab(new WritingMomentumSettingTab(this.app, this));
			console.log('Writing Momentum Plugin: Settings tab added');

			// Register event handlers
			this.registerEvent(
				this.app.workspace.on('file-open', async (file) => {
					if (file) {
						await this.sessionManager.handleFileOpen(file);
					}
				})
			);
			console.log('Writing Momentum Plugin: Event handlers registered');

			// Start reminder system
			this.reminderScheduler.start();
			console.log('Writing Momentum Plugin: Reminder system started');
			
			console.log('Writing Momentum Plugin: Successfully loaded!');
		} catch (error) {
			console.error('Writing Momentum Plugin: Failed to load:', error);
			throw error;
		}
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
		const content = `# Quick Note - ${today}\n\n${this.templateEngine.getRandomPrompt()}\n\n---\n\n`;

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

		const prompt = this.templateEngine.getRandomPrompt();
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

