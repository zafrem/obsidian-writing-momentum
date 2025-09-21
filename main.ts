import { App, Plugin, PluginSettingTab, Setting, Notice, TFile, MarkdownView, ItemView, WorkspaceLeaf } from 'obsidian';
import { NetworkPromptsService } from './src/core/network-prompts';

interface WritingMomentumSettings {
	reminderTime: string;
	showStatusBar: boolean;
	showRibbonIcon: boolean;
	enableNotifications: boolean;
	defaultTitlePattern: string;
	defaultTemplate: string;
	continuousWriting: {
		enabled: boolean;
		targetSessions: number;
		currentCount: number;
		sessionDuration: number;
	};
	promptsFile: string;
	randomPrompts: {
		enabled: boolean;
		mixWithLocal: boolean;
		autoRefresh: boolean;
	};
}

const DEFAULT_SETTINGS: WritingMomentumSettings = {
	reminderTime: '21:00',
	showStatusBar: true,
	showRibbonIcon: true,
	enableNotifications: true,
	defaultTitlePattern: '{{date}} - Writing Session',
	defaultTemplate: '# {{title}}\n\n## Prompt\n{{random_prompt}}\n\n## Writing\n\n\n---\n*Written on {{weekday}} at {{time}}*',
	continuousWriting: {
		enabled: false,
		targetSessions: 30,
		currentCount: 0,
		sessionDuration: 25
	},
	promptsFile: '.writing-momentum/prompts.md',
	randomPrompts: {
		enabled: false,
		mixWithLocal: true,
		autoRefresh: true
	}
};

interface WritingSession {
	id: string;
	startTime: number;
	endTime?: number;
	wordCount: number;
	targetCount?: number;
	active: boolean;
	paused: boolean;
	pausedTime?: number;
	totalPausedDuration: number; // Total time paused in milliseconds
	filePath: string;
	date: string; // YYYY-MM-DD format
}

interface SessionHistory {
	sessions: WritingSession[];
}

const WRITING_PROMPTS = [
	// Creative Questions
	"What if gravity worked backwards for one day?",
	"Describe a world where colors have sounds",
	"What would you tell your younger self?",
	"If you could have dinner with any historical figure, who would it be and why?",
	"Describe your perfect day in vivid detail",
	
	// Reflection Questions
	"What's the most important lesson you learned recently?",
	"What are you most grateful for right now?",
	"What challenge are you currently facing and how might you overcome it?",
	"What small thing brought you joy today?",
	"What would you do if you weren't afraid?",
	
	// Story Starters
	"The old book opened itself to a page that wasn't there yesterday...",
	"She found a letter addressed to her, dated 50 years in the future...",
	"The last person on Earth sat alone in a room. There was a knock at the door...",
	"Every morning, the same stranger waves at you from their window...",
	"You wake up with the ability to hear everyone's thoughts, except one person...",
	
	// Keywords/Themes
	"Write about: Transformation",
	"Explore the theme: Hidden connections",
	"Focus on: Unexpected kindness",
	"Consider: The space between words",
	"Reflect on: Moments of change",
	
	// Observation Prompts  
	"Describe what you can see from where you're sitting",
	"What sounds do you notice right now?",
	"Write about a memory triggered by a smell",
	"Describe a person you saw today without using their appearance",
	"What's the story behind an object near you?",
	
	// Emotional Prompts
	"Write about a time you felt completely understood",
	"Describe the feeling of coming home",
	"What does hope look like to you?",
	"Write about a moment of unexpected courage",
	"Describe the weight of a secret",
	
	// Abstract Concepts
	"If time had a texture, what would it feel like?",
	"What color is Monday?",
	"Describe the personality of your favorite room",
	"What would loneliness say if it could speak?",
	"Write about the space between heartbeats"
];

const QUICK_KEYWORDS = [
	"Mystery", "Journey", "Discovery", "Connection", "Solitude", 
	"Courage", "Change", "Memory", "Hope", "Wonder",
	"Silence", "Movement", "Light", "Shadow", "Time",
	"Growth", "Healing", "Adventure", "Home", "Freedom",
	"Dreams", "Truth", "Beauty", "Strength", "Peace"
];

export default class WritingMomentumPlugin extends Plugin {
	settings: WritingMomentumSettings;
	statusBarItem: HTMLElement | null = null;
	currentSession: WritingSession | null = null;
	sessionHistory: WritingSession[] = []; // Made public for dashboard access
	private wordCountInterval: number | null = null;
	randomPrompts: NetworkPromptsService;

	async onload() {
		console.log('Writing Momentum Plugin: Loading...');

		// Load settings and session history
		await this.loadSettings();
		await this.loadSessionHistory();

		// Initialize random prompts service
		this.randomPrompts = new NetworkPromptsService(this as any);

		// Auto-refresh random prompts if enabled
		if (this.settings.randomPrompts.enabled && this.settings.randomPrompts.autoRefresh) {
			// Fetch prompts in background (don't await to avoid blocking startup)
			this.randomPrompts.fetchNetworkPrompts().catch(error => {
				console.log('Background random prompt fetch failed:', error);
			});
		}

		// Register dashboard view
		this.registerView(
			VIEW_TYPE_WRITING_DASHBOARD,
			(leaf) => new WritingDashboard(leaf, this)
		);

		// Add ribbon icon
		if (this.settings.showRibbonIcon) {
			this.addRibbonIcon('target', 'Writing Momentum', () => {
				this.openDashboard();
			});
		}

		// Add status bar
		if (this.settings.showStatusBar) {
			this.statusBarItem = this.addStatusBarItem();
			this.updateStatusBar();
		}

		// Add commands
		this.addCommand({
			id: 'open-dashboard',
			name: 'Open Writing Dashboard',
			callback: () => this.openDashboard()
		});

		this.addCommand({
			id: 'start-writing-session',
			name: 'Start Writing Session',
			callback: () => this.startQuickSession()
		});

		this.addCommand({
			id: 'complete-session',
			name: 'Complete Writing Session',
			callback: () => this.completeSession()
		});

		this.addCommand({
			id: 'quick-note',
			name: 'Create Quick Note',
			callback: () => this.createQuickNote()
		});

		this.addCommand({
			id: 'insert-writing-prompt',
			name: 'Insert Writing Prompt',
			callback: () => this.insertWritingPrompt()
		});

		this.addCommand({
			id: 'stop-all-timers',
			name: 'Stop All Timers and Alarms',
			callback: () => this.stopAllTimers()
		});

		// Add settings tab
		this.addSettingTab(new WritingMomentumSettingTab(this.app, this));

		// Listen for file changes
		this.registerEvent(
			this.app.workspace.on('file-open', (file) => {
				if (file && file.extension === 'md') {
					this.checkAutoStartSession(file);
				}
			})
		);

		console.log('Writing Momentum Plugin: Loaded successfully!');
	}

	onunload() {
		this.stopAllTimers();
		console.log('Writing Momentum Plugin: Unloaded');
	}

	stopAllTimers() {
		// Stop word count tracking interval
		if (this.wordCountInterval) {
			window.clearInterval(this.wordCountInterval);
			this.wordCountInterval = null;
		}

		// Stop dashboard real-time updates
		const dashboardViews = this.app.workspace.getLeavesOfType(VIEW_TYPE_WRITING_DASHBOARD);
		dashboardViews.forEach(leaf => {
			const view = leaf.view as WritingDashboard;
			if (view && view.stopRealTimeUpdates) {
				view.stopRealTimeUpdates();
			}
		});

		// Complete any active sessions to stop their timers
		if (this.currentSession && this.currentSession.active) {
			console.log('Stopping active session due to timer shutdown');
			this.completeSession();
		}

		console.log('All timers and alarms stopped');
		// new Notice('All writing timers and alarms stopped');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	refreshDashboard() {
		// Find and refresh the dashboard if it's open
		const {workspace} = this.app;
		const dashboardLeaves = workspace.getLeavesOfType(VIEW_TYPE_WRITING_DASHBOARD);

		if (dashboardLeaves.length > 0) {
			// Get the dashboard view and refresh it
			const dashboardLeaf = dashboardLeaves[0];
			const dashboardView = dashboardLeaf.view as WritingDashboard;
			if (dashboardView && dashboardView.render) {
				dashboardView.render();
			}
		}
	}

	async loadSessionHistory() {
		const data = await this.loadData();
		if (data?.sessionHistory) {
			this.sessionHistory = data.sessionHistory;
		}
	}

	async saveSessionHistory() {
		const currentData = await this.loadData() || {};
		currentData.sessionHistory = this.sessionHistory;
		await this.saveData(currentData);
	}

	getRandomPrompt(): string {
		// Use random prompts if enabled
		if (this.settings.randomPrompts.enabled && this.randomPrompts) {
			const randomPrompt = this.randomPrompts.getRandomNetworkPrompt();

			if (randomPrompt) {
				// If mixing with local prompts, randomly choose between random and local
				if (this.settings.randomPrompts.mixWithLocal && Math.random() < 0.5) {
					return WRITING_PROMPTS[Math.floor(Math.random() * WRITING_PROMPTS.length)];
				}
				return randomPrompt;
			}
		}

		// Fallback to local prompts
		return WRITING_PROMPTS[Math.floor(Math.random() * WRITING_PROMPTS.length)];
	}

	getRandomKeyword(): string {
		return QUICK_KEYWORDS[Math.floor(Math.random() * QUICK_KEYWORDS.length)];
	}

	// Dashboard Management
	async openDashboard() {
		const { workspace } = this.app;
		
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_WRITING_DASHBOARD)[0];

		if (!leaf) {
			const rightLeaf = workspace.getRightLeaf(false);
			if (rightLeaf) {
				leaf = rightLeaf;
				await leaf.setViewState({ type: VIEW_TYPE_WRITING_DASHBOARD, active: true });
			}
		}

		if (leaf) {
			workspace.revealLeaf(leaf);
		}
	}

	// Session Management
	startQuickSession() {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			// new Notice('No active file to start session with');
			return;
		}

		if (this.currentSession) {
			// new Notice('Session already active');
			return;
		}

		this.currentSession = {
			id: `session-${Date.now()}`,
			startTime: Date.now(),
			wordCount: 0,
			active: true,
			paused: false,
			totalPausedDuration: 0,
			filePath: activeFile.path,
			date: new Date().toISOString().split('T')[0]
		};

		// Start monitoring word count
		this.startWordCountTracking();
		
		if (this.settings.enableNotifications) {
			// new Notice('Writing session started! 📝');
		}

		this.updateStatusBar();
		this.refreshDashboard();
		console.log('Session started:', this.currentSession.id);
	}

	completeSession() {
		if (!this.currentSession) {
			// new Notice('No active session to complete');
			return;
		}

		this.currentSession.active = false;
		this.currentSession.endTime = Date.now();
		const duration = Math.round((Date.now() - this.currentSession.startTime) / 60000);

		// Save to history
		this.sessionHistory.push({...this.currentSession});
		this.saveSessionHistory();

		// Update continuous writing counter if enabled
		if (this.settings.continuousWriting.enabled) {
			const targetDuration = this.settings.continuousWriting.sessionDuration;

			// Only count if session met minimum duration requirement
			if (duration >= targetDuration) {
				this.settings.continuousWriting.currentCount++;
				this.saveSettings();

				// Check for achievement
				if (this.settings.continuousWriting.currentCount >= this.settings.continuousWriting.targetSessions) {
					if (this.settings.enableNotifications) {
						// new Notice(`🎉 Amazing! You've completed ${this.settings.continuousWriting.targetSessions} continuous sessions!`, 10000);
					}
				}
			}
		}

		if (this.settings.enableNotifications) {
			let message = `Session completed! ${this.currentSession.wordCount} words in ${duration} minutes 🎉`;

			if (this.settings.continuousWriting.enabled) {
				const currentCount = this.settings.continuousWriting.currentCount;
				const targetDuration = this.settings.continuousWriting.sessionDuration;

				if (duration >= targetDuration) {
					message += ` Continuous session ${currentCount} completed! 🔥`;
				} else {
					message += ` (Need ${targetDuration}+ minutes for continuous progress)`;
				}
			}

			// new Notice(message);
		}

		// Stop tracking
		if (this.wordCountInterval) {
			window.clearInterval(this.wordCountInterval);
			this.wordCountInterval = null;
		}

		this.currentSession = null;
		this.updateStatusBar();

		// Refresh dashboard to show updated continuous writing progress
		this.refreshDashboard();

		console.log('Session completed');
	}

	pauseSession() {
		if (!this.currentSession || !this.currentSession.active || this.currentSession.paused) {
			// new Notice('No active session to pause');
			return;
		}

		this.currentSession.paused = true;
		this.currentSession.pausedTime = Date.now();

		// Stop word count tracking
		if (this.wordCountInterval) {
			window.clearInterval(this.wordCountInterval);
			this.wordCountInterval = null;
		}

		if (this.settings.enableNotifications) {
			// new Notice('Session paused ⏸️');
		}

		this.updateStatusBar();
		console.log('Session paused:', this.currentSession.id);
	}

	resumeSession() {
		if (!this.currentSession || !this.currentSession.active || !this.currentSession.paused) {
			// new Notice('No paused session to resume');
			return;
		}

		// Add the paused duration to total
		if (this.currentSession.pausedTime) {
			this.currentSession.totalPausedDuration += Date.now() - this.currentSession.pausedTime;
		}

		this.currentSession.paused = false;
		this.currentSession.pausedTime = undefined;

		// Restart word count tracking
		this.startWordCountTracking();

		if (this.settings.enableNotifications) {
			// new Notice('Session resumed ▶️');
		}

		this.updateStatusBar();
		console.log('Session resumed:', this.currentSession.id);
	}

	private startWordCountTracking() {
		if (this.wordCountInterval) {
			window.clearInterval(this.wordCountInterval);
		}

		this.wordCountInterval = window.setInterval(() => {
			this.updateWordCount();
		}, 5000);

		this.registerInterval(this.wordCountInterval);
	}

	private async updateWordCount() {
		if (!this.currentSession) return;

		const file = this.app.vault.getAbstractFileByPath(this.currentSession.filePath);
		if (file instanceof TFile) {
			try {
				const content = await this.app.vault.read(file);
				const wordCount = this.countWords(content);
				this.currentSession.wordCount = wordCount;
				this.updateStatusBar();
			} catch (error) {
				console.error('Failed to read file:', error);
			}
		}
	}

	private countWords(text: string): number {
		// Remove frontmatter
		const withoutFrontmatter = text.replace(/^---[\s\S]*?---\n?/, '');
		// Count words
		return withoutFrontmatter.trim().split(/\s+/).filter(word => word.length > 0).length;
	}

	private updateStatusBar() {
		if (!this.statusBarItem) return;

		if (this.currentSession && this.currentSession.active) {
			let effectiveDuration = Date.now() - this.currentSession.startTime - this.currentSession.totalPausedDuration;
			
			// If currently paused, don't include the current pause time
			if (this.currentSession.paused && this.currentSession.pausedTime) {
				effectiveDuration -= (Date.now() - this.currentSession.pausedTime);
			}
			
			const duration = Math.round(effectiveDuration / 60000);
			const pauseIndicator = this.currentSession.paused ? ' ⏸️' : '';
			this.statusBarItem.setText(`✍️ ${this.currentSession.wordCount} words (${duration}m)${pauseIndicator}`);
		} else {
			this.statusBarItem.setText('📝 Ready to write');
		}
	}

	private checkAutoStartSession(file: TFile) {
		// Auto-start session logic disabled to prevent intrusive notices
		return;
	}

	async createQuickNote() {
		const now = new Date();
		const dateStr = now.toISOString().split('T')[0];
		// Use safe time format without colons for file names
		const timeStr = now.toLocaleTimeString('en-US', { 
			hour: '2-digit', 
			minute: '2-digit', 
			hour12: false 
		}).replace(/:/g, '-'); // Replace colons with dashes
		
		const fileName = `${dateStr} Quick Note ${timeStr}.md`;
		const displayTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
		const content = `# Quick Note - ${dateStr}\n\nWhat's on your mind?\n\n---\n\nWritten at ${displayTime}`;

		try {
			// Check if file already exists, if so append a number
			let uniqueFileName = fileName;
			let counter = 1;
			while (this.app.vault.getAbstractFileByPath(uniqueFileName)) {
				const baseName = fileName.replace('.md', '');
				uniqueFileName = `${baseName} (${counter}).md`;
				counter++;
			}

			const file = await this.app.vault.create(uniqueFileName, content);
			const leaf = this.app.workspace.getLeaf();
			await leaf.openFile(file);
			
			if (this.settings.enableNotifications) {
				// new Notice(`Quick note created: ${file.name}`);
			}
			
			// Auto-start session after a brief delay
			setTimeout(() => this.startQuickSession(), 100);
		} catch (error) {
			console.error('Failed to create quick note:', error);
			new Notice(`Failed to create quick note: ${error.message}`);
		}
	}

	async createTemplateNoteAndStartSession() {
		// Show template selection dialog
		const selectedTemplate = await this.showTemplateSelectionDialog();
		if (!selectedTemplate) {
			return; // User cancelled
		}

		try {
			// Process the title pattern
			const title = this.processTemplate(selectedTemplate.title);
			console.log('Debug - Title pattern:', selectedTemplate.title);
			console.log('Debug - Processed title:', title);

			// Process the template content
			const content = this.processTemplate(selectedTemplate.template, title);
			console.log('Debug - Template pattern:', selectedTemplate.template);
			console.log('Debug - Final content:', content);

			// Create safe file name (remove invalid characters)
			const safeFileName = this.sanitizeFileName(title) + '.md';

			// Check if file already exists, if so append a number
			let uniqueFileName = safeFileName;
			let counter = 1;
			while (this.app.vault.getAbstractFileByPath(uniqueFileName)) {
				const baseName = safeFileName.replace('.md', '');
				uniqueFileName = `${baseName} (${counter}).md`;
				counter++;
			}

			// Create the file
			const file = await this.app.vault.create(uniqueFileName, content);

			// Open the file
			const leaf = this.app.workspace.getLeaf();
			await leaf.openFile(file);

			// Start the session after a brief delay to ensure file is active
			setTimeout(() => {
				this.startQuickSession();
			}, 100);

			if (this.settings.enableNotifications) {
				// new Notice(`Session started with: ${file.name}`);
			}
		} catch (error) {
			console.error('Failed to create template note and start session:', error);
			new Notice(`Failed to create note: ${error.message}`);
		}
	}

	private processTemplate(template: string, customTitle?: string): string {
		const now = new Date();
		const dateStr = now.toISOString().split('T')[0];
		const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
		const weekdayStr = now.toLocaleDateString('en-US', { weekday: 'long' });
		const randomPrompt = this.getRandomPrompt();

		let processed = template
			.replace(/\{\{date\}\}/g, dateStr)
			.replace(/\{\{time\}\}/g, timeStr)
			.replace(/\{\{weekday\}\}/g, weekdayStr)
			.replace(/\{\{vault\}\}/g, this.app.vault.getName())
			.replace(/\{\{random_prompt\}\}/g, randomPrompt);

		// Handle title - use custom title if provided, otherwise use processed title pattern
		if (customTitle) {
			processed = processed.replace(/\{\{title\}\}/g, customTitle);
		} else {
			// If no custom title and we're processing the title pattern itself, use a default
			processed = processed.replace(/\{\{title\}\}/g, 'Writing Session');
		}

		return processed;
	}

	private sanitizeFileName(fileName: string): string {
		// Remove or replace invalid file name characters
		return fileName.replace(/[<>:"/\\|?*]/g, '-').replace(/\s+/g, ' ').trim();
	}

	private async showTemplateSelectionDialog(): Promise<{name: string, title: string, template: string} | null> {
		return new Promise((resolve) => {
			const templates = this.getAvailableTemplates();

			// Create modal
			const modal = document.createElement('div');
			modal.className = 'modal-container';
			modal.style.cssText = `
				position: fixed;
				top: 0;
				left: 0;
				width: 100%;
				height: 100%;
				background: rgba(0, 0, 0, 0.5);
				display: flex;
				align-items: center;
				justify-content: center;
				z-index: 1000;
			`;

			const dialog = document.createElement('div');
			dialog.className = 'template-selection-dialog';
			dialog.style.cssText = `
				background: var(--background-primary);
				border: 1px solid var(--background-modifier-border);
				border-radius: 12px;
				padding: 24px;
				max-width: 500px;
				width: 90%;
				max-height: 70vh;
				overflow-y: auto;
			`;

			dialog.innerHTML = `
				<h2 style="margin-top: 0; color: var(--text-accent);">Choose Writing Template</h2>
				<p style="color: var(--text-muted); margin-bottom: 20px;">Select a template to start your writing session:</p>
				<div class="template-options"></div>
				<div style="display: flex; gap: 12px; margin-top: 20px; justify-content: flex-end;">
					<button class="cancel-btn" style="padding: 8px 16px; border: 1px solid var(--background-modifier-border); background: var(--background-secondary); border-radius: 6px; cursor: pointer;">Cancel</button>
				</div>
			`;

			const optionsContainer = dialog.querySelector('.template-options');

			templates.forEach((template, index) => {
				const option = document.createElement('div');
				option.className = 'template-option';
				option.style.cssText = `
					border: 1px solid var(--background-modifier-border);
					border-radius: 8px;
					padding: 16px;
					margin-bottom: 12px;
					cursor: pointer;
					transition: all 0.2s;
					background: var(--background-secondary);
				`;

				option.innerHTML = `
					<h3 style="margin: 0 0 8px 0; color: var(--text-accent);">${template.name}</h3>
					<p style="margin: 0; color: var(--text-muted); font-size: 0.9em;">${template.description}</p>
				`;

				option.addEventListener('mouseenter', () => {
					option.style.borderColor = 'var(--interactive-accent)';
					option.style.backgroundColor = 'var(--background-primary)';
				});

				option.addEventListener('mouseleave', () => {
					option.style.borderColor = 'var(--background-modifier-border)';
					option.style.backgroundColor = 'var(--background-secondary)';
				});

				option.addEventListener('click', () => {
					document.body.removeChild(modal);
					resolve(template);
				});

				optionsContainer?.appendChild(option);
			});

			dialog.querySelector('.cancel-btn')?.addEventListener('click', () => {
				document.body.removeChild(modal);
				resolve(null);
			});

			modal.addEventListener('click', (e) => {
				if (e.target === modal) {
					document.body.removeChild(modal);
					resolve(null);
				}
			});

			modal.appendChild(dialog);
			document.body.appendChild(modal);
		});
	}

	private getAvailableTemplates() {
		return [
			{
				name: 'Daily Journal',
				description: 'Structured daily reflection with prompts for events, feelings, and gratitude',
				title: '{{date}} - Daily Journal',
				template: `**📝 Today's Writing Session**
*Take a moment to reflect on your day and capture your thoughts.*

## Morning Reflection
{{random_prompt}}

## Today's Events
-
-
-

## Thoughts & Feelings


## Gratitude
1.
2.
3.

---
*Journal entry for {{weekday}}, {{date}} at {{time}}*`
			},
			{
				name: 'Creative Writing',
				description: 'Free-form creative writing with inspiration prompt',
				title: '{{date}} - Creative Writing',
				template: `**✨ Creative Writing Session**
*Let your imagination flow and create something beautiful.*

## Writing Prompt
{{random_prompt}}

## Your Story


---
*Creative session on {{weekday}} at {{time}}*`
			},
			{
				name: 'Quick Notes',
				description: 'Fast idea capture and organization',
				title: '{{time}} - Quick Note',
				template: `**💡 Quick Idea Capture**
*Capture your thoughts quickly and organize them for later.*

## Main Idea
{{random_prompt}}

## Details


## Next Steps
- [ ]
- [ ]

---
*Note taken {{weekday}} at {{time}}*`
			},
			{
				name: 'Project Planning',
				description: 'Structured project planning and task organization',
				title: '{{date}} - Project Planning',
				template: `**🎯 Project Planning Session**
*Plan your project systematically and set clear goals.*

## Project Goal
{{random_prompt}}

## Overview
**Start Date:** {{date}}
**Status:** Planning

## Tasks
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

## Timeline


## Resources


---
*Project planned on {{weekday}}, {{date}} at {{time}}*`
			},
			{
				name: 'Free Writing',
				description: 'Unstructured writing for stream of consciousness',
				title: '{{date}} - Free Writing',
				template: `**🌊 Free Writing Session**
*Write without stopping, let your thoughts flow naturally.*

## Starting Thought
{{random_prompt}}

## Stream of Consciousness
Write continuously for your target time. Don't worry about grammar, structure, or making sense. Just let your thoughts flow onto the page.




---
*Free writing session {{weekday}} at {{time}}*`
			}
		];
	}

	async insertWritingPrompt() {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView) {
			new Notice('No active note to insert prompt into');
			return;
		}

		const prompt = this.getRandomPrompt();
		const keywords = [this.getRandomKeyword(), this.getRandomKeyword(), this.getRandomKeyword()];
		const textToInsert = `**Writing Prompt:** ${prompt}\n\n**Keywords:** ${keywords.join(', ')}\n\n---\n\n`;

		const editor = activeView.editor;
		const cursor = editor.getCursor();
		editor.replaceRange(textToInsert, cursor);
		
		// Position cursor after the inserted text
		const lines = textToInsert.split('\n').length;
		editor.setCursor(cursor.line + lines - 1, 0);

		if (this.settings.enableNotifications) {
			// new Notice('Writing prompt inserted! ✨');
		}
	}
}

// Settings Tab
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

		// Continuous Writing Section - moved to top
		containerEl.createEl('h3', {text: 'Continuous Writing'});

		const enableSetting = new Setting(containerEl)
			.setName('Enable continuous writing mode')
			.setDesc('Track consecutive writing sessions for extended focus periods')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.continuousWriting.enabled)
				.onChange(async (value) => {
					this.plugin.settings.continuousWriting.enabled = value;
					await this.plugin.saveSettings();
					this.display(); // Refresh to show/hide controls

					// Also refresh the dashboard if it's open
					this.refreshDashboard();
				}));

		// Only show additional controls if continuous writing is enabled
		if (this.plugin.settings.continuousWriting.enabled) {
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
						this.refreshDashboard(); // Also refresh dashboard
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
			progressFill.style.width = `${Math.min((currentCount / targetCount) * 100, 100)}%`;
		}

		// General Settings
		containerEl.createEl('h3', {text: 'General Settings'});

		// Reminder time
		new Setting(containerEl)
			.setName('Reminder time')
			.setDesc('Daily writing reminder (HH:MM format)')
			.addText(text => text
				.setPlaceholder('21:00')
				.setValue(this.plugin.settings.reminderTime)
				.onChange(async (value) => {
					this.plugin.settings.reminderTime = value;
					await this.plugin.saveSettings();
				}));

		// Show status bar
		new Setting(containerEl)
			.setName('Show status bar')
			.setDesc('Display writing progress in status bar')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showStatusBar)
				.onChange(async (value) => {
					this.plugin.settings.showStatusBar = value;
					await this.plugin.saveSettings();
					
					// Update status bar visibility
					if (value && !this.plugin.statusBarItem) {
						this.plugin.statusBarItem = this.plugin.addStatusBarItem();
						this.plugin['updateStatusBar']();
					} else if (!value && this.plugin.statusBarItem) {
						this.plugin.statusBarItem.remove();
						this.plugin.statusBarItem = null;
					}
				}));

		// Show ribbon icon
		new Setting(containerEl)
			.setName('Show ribbon icon')
			.setDesc('Display plugin icon in left ribbon')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showRibbonIcon)
				.onChange(async (value) => {
					this.plugin.settings.showRibbonIcon = value;
					await this.plugin.saveSettings();
				}));

		// Enable notifications
		new Setting(containerEl)
			.setName('Enable notifications')
			.setDesc('Show notifications for session events')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableNotifications)
				.onChange(async (value) => {
					this.plugin.settings.enableNotifications = value;
					await this.plugin.saveSettings();
				}));

		// Random Prompts Section
		containerEl.createEl('h3', {text: 'Random Prompts'});

		const randomToggle = new Setting(containerEl)
			.setName('Enable random prompts')
			.setDesc('Fetch writing prompts from online sources (requires internet connection)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.randomPrompts.enabled)
				.onChange(async (value) => {
					this.plugin.settings.randomPrompts.enabled = value;
					await this.plugin.saveSettings();
					this.display(); // Refresh to show/hide additional options

					// Fetch prompts when enabled
					if (value && this.plugin.randomPrompts) {
						await this.plugin.randomPrompts.fetchNetworkPrompts();
					}
				}));

		// Only show additional random prompt options if enabled
		if (this.plugin.settings.randomPrompts.enabled) {
			new Setting(containerEl)
				.setName('Mix with local prompts')
				.setDesc('Randomly mix random prompts with built-in prompts for variety')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.randomPrompts.mixWithLocal)
					.onChange(async (value) => {
						this.plugin.settings.randomPrompts.mixWithLocal = value;
						await this.plugin.saveSettings();
					}));

			new Setting(containerEl)
				.setName('Auto-refresh prompts')
				.setDesc('Automatically fetch new prompts daily (cached for offline use)')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.randomPrompts.autoRefresh)
					.onChange(async (value) => {
						this.plugin.settings.randomPrompts.autoRefresh = value;
						await this.plugin.saveSettings();
					}));

			// Show prompt status and manual refresh
			const statusSetting = new Setting(containerEl)
				.setName('Prompt cache status')
				.setDesc('View and manage cached random prompts');

			const refreshBtn = statusSetting.controlEl.createEl('button', {
				text: 'Refresh Now',
				cls: 'mod-cta'
			});

			refreshBtn.onclick = async () => {
				refreshBtn.disabled = true;
				refreshBtn.textContent = 'Refreshing...';

				try {
					const success = await this.plugin.randomPrompts.refreshPrompts();
					if (success) {
						new Notice('Random prompts refreshed successfully!');
					} else {
						new Notice('Failed to refresh prompts. Check your internet connection.');
					}
				} catch (error) {
					new Notice('Error refreshing prompts: ' + error.message);
				}

				refreshBtn.disabled = false;
				refreshBtn.textContent = 'Refresh Now';
				this.updatePromptStatus(statusSetting);
			};

			this.updatePromptStatus(statusSetting);
		}

		// Template Presets Section
		containerEl.createEl('h3', {text: 'Template Presets'});

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


		// Page Title Pattern Editor (Full Width) - moved to bottom
		containerEl.createEl('br');
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

		// Template Content Editor (Full Width) - moved to bottom
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

	private refreshDashboard() {
		// Find and refresh the dashboard if it's open
		const {workspace} = this.app;
		const dashboardLeaves = workspace.getLeavesOfType(VIEW_TYPE_WRITING_DASHBOARD);

		if (dashboardLeaves.length > 0) {
			// Get the dashboard view and refresh it
			const dashboardLeaf = dashboardLeaves[0];
			const dashboardView = dashboardLeaf.view as WritingDashboard;
			if (dashboardView && dashboardView.render) {
				dashboardView.render();
			}
		}
	}

	private updatePromptStatus(statusSetting: Setting) {
		if (!this.plugin.randomPrompts) return;

		const count = this.plugin.randomPrompts.getCachedPromptsCount();
		const lastFetch = this.plugin.randomPrompts.getLastFetchTime();

		let statusText = `${count} prompts cached`;
		if (lastFetch) {
			const timeAgo = this.getTimeAgo(lastFetch);
			statusText += ` (last updated ${timeAgo})`;
		} else {
			statusText += ' (never fetched)';
		}

		statusSetting.setDesc(statusText);
	}

	private getTimeAgo(date: Date): string {
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / (1000 * 60));
		const diffHours = Math.floor(diffMins / 60);
		const diffDays = Math.floor(diffHours / 24);

		if (diffMins < 1) return 'just now';
		if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
		if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
		return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
	}
}

// Dashboard View
const VIEW_TYPE_WRITING_DASHBOARD = 'writing-momentum-dashboard';

class WritingDashboard extends ItemView {
	private plugin: WritingMomentumPlugin;
	private updateInterval: number | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: WritingMomentumPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_WRITING_DASHBOARD;
	}

	getDisplayText(): string {
		return 'Writing Dashboard';
	}

	getIcon(): string {
		return 'target';
	}

	async onOpen() {
		this.render();
		this.startRealTimeUpdates();
	}

	async onClose() {
		this.stopRealTimeUpdates();
	}

	private startRealTimeUpdates() {
		// Update every second for real-time timer
		this.updateInterval = window.setInterval(() => {
			this.updateRealTimeElements();
		}, 1000);

		// Register cleanup with Obsidian
		this.plugin.registerInterval(this.updateInterval);
	}

	stopRealTimeUpdates() {
		if (this.updateInterval) {
			window.clearInterval(this.updateInterval);
			this.updateInterval = null;
		}
	}

	private updateRealTimeElements() {
		// Update current session timer if active
		const timerElement = this.containerEl.querySelector('.session-timer');
		if (timerElement && this.plugin.currentSession && this.plugin.currentSession.active) {
			const session = this.plugin.currentSession;

			// Calculate effective duration (excluding paused time)
			let effectiveDuration = Date.now() - session.startTime - session.totalPausedDuration;
			if (session.paused && session.pausedTime) {
				effectiveDuration -= (Date.now() - session.pausedTime);
			}

			const hours = Math.floor(effectiveDuration / 3600000);
			const minutes = Math.floor((effectiveDuration % 3600000) / 60000);
			const seconds = Math.floor((effectiveDuration % 60000) / 1000);

			const timeString = hours > 0
				? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
				: `${minutes}:${seconds.toString().padStart(2, '0')}`;

			timerElement.textContent = timeString;
		}

		// Update word count if needed
		const wordCountElement = this.containerEl.querySelector('.session-words');
		if (wordCountElement && this.plugin.currentSession && this.plugin.currentSession.active) {
			wordCountElement.textContent = this.plugin.currentSession.wordCount.toString();
		}
	}

	render() {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass('writing-momentum-dashboard');

		// Header
		const header = container.createEl('div', { cls: 'dashboard-header' });
		header.createEl('h2', { text: 'Writing Dashboard', cls: 'dashboard-title' });

		// Current Session
		this.renderCurrentSession(container);

		// Only show Continuous Writing Mode and Writing Mode when no session is active
		const hasActiveSession = this.plugin.currentSession && this.plugin.currentSession.active;

		if (!hasActiveSession) {
			// Continuous Writing
			this.renderContinuousWriting(container);

			// Writing Mode - only show if Continuous Writing Mode is not visible
			if (!this.plugin.settings.continuousWriting.enabled) {
				this.renderWritingMode(container);
			}
		}

		// Writing Volume Charts
		this.renderWritingVolumeChart(container);
	}

	private renderCurrentSession(container: Element) {
		const sessionEl = container.createEl('div', { cls: 'dashboard-section' });
		
		if (this.plugin.currentSession && this.plugin.currentSession.active) {
			const session = this.plugin.currentSession;
			
			// Calculate effective duration (excluding paused time)
			let effectiveDuration = Date.now() - session.startTime - session.totalPausedDuration;
			if (session.paused && session.pausedTime) {
				effectiveDuration -= (Date.now() - session.pausedTime);
			}
			const duration = Math.round(effectiveDuration / 60000);
			
			// Add pause indicator to header
			const sessionHeader = sessionEl.createEl('h3', { 
				text: session.paused ? '🎯 Current Session (Paused)' : '🎯 Current Session'
			});
			if (session.paused) {
				sessionHeader.addClass('paused-session');
			}
			
			const statsEl = sessionEl.createEl('div', { cls: 'session-stats-grid' });
			
			const wordEl = statsEl.createEl('div', { cls: 'stat-card' });
			wordEl.createEl('span', { text: '📝', cls: 'stat-icon' });
			wordEl.createEl('span', { text: session.wordCount.toString(), cls: 'stat-value session-words' });
			wordEl.createEl('span', { text: 'Words', cls: 'stat-label' });

			const timeEl = statsEl.createEl('div', { cls: 'stat-card' });
			timeEl.createEl('span', { text: '⏱️', cls: 'stat-icon' });
			// Calculate initial timer display
			const hours = Math.floor(effectiveDuration / 3600000);
			const minutes = Math.floor((effectiveDuration % 3600000) / 60000);
			const seconds = Math.floor((effectiveDuration % 60000) / 1000);
			const timeString = hours > 0
				? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
				: `${minutes}:${seconds.toString().padStart(2, '0')}`;
			timeEl.createEl('span', { text: timeString, cls: 'stat-value session-timer' });
			timeEl.createEl('span', { text: 'Time', cls: 'stat-label' });
			
			const fileEl = statsEl.createEl('div', { cls: 'current-file' });
			fileEl.createEl('span', { text: '📄 ' + session.filePath.split('/').pop() });
			
			// Writing inspiration section
			const inspirationEl = sessionEl.createEl('div', { cls: 'writing-inspiration' });
			this.renderWritingInspiration(inspirationEl);
			
			const actionsEl = sessionEl.createEl('div', { cls: 'session-actions' });
			
			const completeBtn = actionsEl.createEl('button', { 
				text: '✅ Complete Session',
				cls: 'session-btn complete-btn'
			});
			completeBtn.onclick = () => {
				this.plugin.completeSession();
				this.render();
			};
		} else {
			sessionEl.createEl('p', { 
				text: '💤 No active session. Open a markdown file and click the ribbon icon to start!',
				cls: 'no-session-message'
			});
		}
	}

	private renderWritingInspiration(container: Element) {
		const promptCard = container.createEl('div', { cls: 'prompt-card' });
		
		// Header with refresh button
		const promptHeader = promptCard.createEl('div', { cls: 'prompt-header' });
		promptHeader.createEl('span', { text: '✨ Writing Inspiration', cls: 'prompt-title' });
		
		const refreshPromptBtn = promptHeader.createEl('button', { 
			text: '🎲',
			cls: 'prompt-refresh-btn',
			attr: { title: 'Get new inspiration' }
		});
		
		// Main prompt
		const promptText = promptCard.createEl('div', { cls: 'prompt-text' });
		promptText.setText(this.plugin.getRandomPrompt());
		
		// Keywords section
		const keywordSection = promptCard.createEl('div', { cls: 'keyword-section' });
		keywordSection.createEl('span', { text: 'Keywords: ', cls: 'keyword-label' });
		
		const keywordContainer = keywordSection.createEl('span', { cls: 'keywords' });
		for (let i = 0; i < 3; i++) {
			const keyword = keywordContainer.createEl('span', { 
				text: this.plugin.getRandomKeyword(),
				cls: 'keyword-tag'
			});
			if (i < 2) {
				keywordContainer.createEl('span', { text: ' • ', cls: 'keyword-separator' });
			}
		}
		
		// Copy to clipboard button
		const copyBtn = promptCard.createEl('button', { 
			text: '📋 Copy to Clipboard',
			cls: 'copy-prompt-btn'
		});
		
		// Event handlers
		refreshPromptBtn.onclick = () => {
			promptText.setText(this.plugin.getRandomPrompt());
			
			// Refresh keywords
			keywordContainer.empty();
			for (let i = 0; i < 3; i++) {
				const keyword = keywordContainer.createEl('span', { 
					text: this.plugin.getRandomKeyword(),
					cls: 'keyword-tag'
				});
				if (i < 2) {
					keywordContainer.createEl('span', { text: ' • ', cls: 'keyword-separator' });
				}
			}
		};
		
		copyBtn.onclick = async () => {
			const prompt = promptText.textContent || '';
			const keywords = Array.from(keywordContainer.querySelectorAll('.keyword-tag'))
				.map(el => el.textContent).join(', ');
			const textToCopy = `${prompt}\n\nKeywords: ${keywords}`;
			
			try {
				await navigator.clipboard.writeText(textToCopy);
				copyBtn.setText('✅ Copied!');
				setTimeout(() => {
					copyBtn.setText('📋 Copy to Clipboard');
				}, 2000);
			} catch (error) {
				console.error('Failed to copy to clipboard:', error);
				// Fallback for older browsers
				const textArea = document.createElement('textarea');
				textArea.value = textToCopy;
				document.body.appendChild(textArea);
				textArea.select();
				document.execCommand('copy');
				document.body.removeChild(textArea);
				copyBtn.setText('✅ Copied!');
				setTimeout(() => {
					copyBtn.setText('📋 Copy to Clipboard');
				}, 2000);
			}
		};
	}

	private renderWritingMode(container: Element) {
		const actionsEl = container.createEl('div', { cls: 'dashboard-section' });
		actionsEl.createEl('h3', { text: 'Writing Mode' });

		const buttonsEl = actionsEl.createEl('div', { cls: 'action-buttons' });

		const startSessionBtn = buttonsEl.createEl('button', {
			text: '🚀 Start Session',
			cls: 'action-btn start-session-btn'
		});
		startSessionBtn.onclick = async () => {
			await this.plugin.createTemplateNoteAndStartSession();
			// Dashboard will refresh automatically when session starts
		};
	}

	private renderContinuousWriting(container: Element) {
		if (!this.plugin.settings.continuousWriting.enabled) {
			return;
		}

		const section = container.createEl('div', { cls: 'dashboard-section continuous-writing' });
		section.createEl('h3', { text: 'Continuous Writing Mode' });

		const currentCount = this.plugin.settings.continuousWriting.currentCount;
		const targetCount = this.plugin.settings.continuousWriting.targetSessions;
		const sessionDuration = this.plugin.settings.continuousWriting.sessionDuration;

		// Progress overview
		const progressOverview = section.createEl('div', { cls: 'continuous-progress-overview' });

		const progressText = progressOverview.createEl('div', { cls: 'continuous-progress-text' });
		progressText.createEl('span', {
			text: `${currentCount} / ${targetCount}`,
			cls: 'continuous-count'
		});
		progressText.createEl('span', {
			text: ` sessions completed`,
			cls: 'continuous-label'
		});

		const percentage = Math.round((currentCount / targetCount) * 100);
		progressText.createEl('span', {
			text: ` (${percentage}%)`,
			cls: 'continuous-percentage'
		});

		// Progress bar
		const progressBarContainer = progressOverview.createEl('div', { cls: 'continuous-progress-bar' });
		const progressBar = progressBarContainer.createEl('div', {
			cls: 'continuous-progress-fill',
			attr: { style: `width: ${Math.min(percentage, 100)}%` }
		});

		// Session info
		const sessionInfo = section.createEl('div', { cls: 'continuous-session-info' });
		sessionInfo.createEl('p', {
			text: `Target: ${sessionDuration} minutes per session`,
			cls: 'session-duration-info'
		});

		// Action buttons
		const actions = section.createEl('div', { cls: 'continuous-actions' });

		const startBtn = actions.createEl('button', {
			text: '🚀 Start Continuous Session',
			cls: 'action-btn continuous-start-btn'
		});
		startBtn.onclick = async () => {
			await this.plugin.createTemplateNoteAndStartSession();
		};

		if (currentCount > 0) {
			const resetBtn = actions.createEl('button', {
				text: '🔄 Reset Progress',
				cls: 'action-btn continuous-reset-btn'
			});
			resetBtn.onclick = async () => {
				this.plugin.settings.continuousWriting.currentCount = 0;
				await this.plugin.saveSettings();
				this.render();
			};
		}

		// Achievement check
		if (currentCount >= targetCount) {
			const achievementEl = section.createEl('div', { cls: 'continuous-achievement' });
			achievementEl.createEl('div', { text: '🎉', cls: 'achievement-icon' });
			achievementEl.createEl('div', {
				text: `Congratulations! You've completed ${targetCount} continuous sessions!`,
				cls: 'achievement-text'
			});
		}
	}

	private renderWritingVolumeChart(container: Element) {
		const chartEl = container.createEl('div', { cls: 'dashboard-section' });
		chartEl.createEl('h3', { text: 'Writing Volume' });
		
		// Create chart container
		const chartContainer = chartEl.createEl('div', { cls: 'chart-container' });
		
		// Render weekly chart
		this.renderWeeklyChart(chartContainer);
		
		// Render monthly chart
		this.renderMonthlyChart(chartContainer);
		
		// Show current totals
		this.renderVolumeTotals(chartContainer);
	}

	private renderWeeklyChart(container: Element) {
		const weeklyEl = container.createEl('div', { cls: 'weekly-chart' });
		weeklyEl.createEl('h4', { text: 'Last 7 Days' });
		
		const chartEl = weeklyEl.createEl('div', { cls: 'bar-chart' });
		
		// Get last 7 days of data
		const weeklyData = this.getWeeklyData();
		const maxWords = Math.max(...weeklyData.map(d => d.words), 100);
		
		weeklyData.forEach((day, index) => {
			const barContainer = chartEl.createEl('div', { cls: 'bar-container' });
			
			// Day label
			const dayLabel = barContainer.createEl('div', { cls: 'bar-label' });
			dayLabel.setText(day.label);
			
			// Bar
			const bar = barContainer.createEl('div', { cls: 'bar' });
			const height = Math.max((day.words / maxWords) * 100, 2); // Minimum 2% height
			bar.style.height = `${height}%`;
			bar.addClass(day.words > 0 ? 'has-data' : 'no-data');
			
			// Word count tooltip
			bar.title = `${day.words} words`;
			
			// Word count label
			if (day.words > 0) {
				const wordLabel = barContainer.createEl('div', { cls: 'word-count' });
				wordLabel.setText(day.words.toString());
			}
		});
	}

	private renderMonthlyChart(container: Element) {
		const monthlyEl = container.createEl('div', { cls: 'monthly-chart' });
		monthlyEl.createEl('h4', { text: 'Last 30 Days' });
		
		const chartEl = monthlyEl.createEl('div', { cls: 'line-chart' });
		
		// Get last 30 days of data
		const monthlyData = this.getMonthlyData();
		const maxWords = Math.max(...monthlyData.map(d => d.words), 100);
		
		// Create SVG element manually since Obsidian doesn't support createEl for SVG
		chartEl.innerHTML = `
			<svg class="chart-svg" width="100%" height="120" viewBox="0 0 400 120">
				${this.generateSVGPath(monthlyData, maxWords)}
				${this.generateSVGDots(monthlyData, maxWords)}
			</svg>
		`;
	}

	private renderVolumeTotals(container: Element) {
		const totalsEl = container.createEl('div', { cls: 'volume-totals' });
		
		const weekTotal = this.getWeeklyData().reduce((sum, day) => sum + day.words, 0);
		const monthTotal = this.getMonthlyData().reduce((sum, day) => sum + day.words, 0);
		
		const weekCard = totalsEl.createEl('div', { cls: 'volume-card' });
		weekCard.createEl('div', { text: weekTotal.toString(), cls: 'volume-number' });
		weekCard.createEl('div', { text: 'Words This Week', cls: 'volume-label' });
		
		const monthCard = totalsEl.createEl('div', { cls: 'volume-card' });
		monthCard.createEl('div', { text: monthTotal.toString(), cls: 'volume-number' });
		monthCard.createEl('div', { text: 'Words This Month', cls: 'volume-label' });
	}

	private generateSVGPath(monthlyData: any[], maxWords: number): string {
		let pathData = '';
		monthlyData.forEach((day, index) => {
			const x = (index / (monthlyData.length - 1)) * 380 + 10;
			const y = 100 - ((day.words / maxWords) * 80);
			pathData += (index === 0 ? 'M' : 'L') + ` ${x} ${y}`;
		});
		
		return `<path d="${pathData}" fill="none" stroke="var(--interactive-accent)" stroke-width="2" style="filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.1));" />`;
	}

	private generateSVGDots(monthlyData: any[], maxWords: number): string {
		let dots = '';
		monthlyData.forEach((day, index) => {
			if (day.words > 0) {
				const x = (index / (monthlyData.length - 1)) * 380 + 10;
				const y = 100 - ((day.words / maxWords) * 80);
				
				dots += `<circle cx="${x}" cy="${y}" r="3" fill="var(--interactive-accent)" style="cursor: pointer;">
					<title>${day.date}: ${day.words} words</title>
				</circle>`;
			}
		});
		return dots;
	}

	private getWeeklyData() {
		const data = [];
		const today = new Date();
		
		for (let i = 6; i >= 0; i--) {
			const date = new Date(today);
			date.setDate(today.getDate() - i);
			const dateStr = date.toISOString().split('T')[0];
			
			const dayWords = this.plugin.sessionHistory
				.filter(session => session.date === dateStr && session.endTime)
				.reduce((sum, session) => sum + session.wordCount, 0);
			
			data.push({
				date: dateStr,
				label: date.toLocaleDateString('en-US', { weekday: 'short' }),
				words: dayWords
			});
		}
		
		return data;
	}

	private getMonthlyData() {
		const data = [];
		const today = new Date();
		
		for (let i = 29; i >= 0; i--) {
			const date = new Date(today);
			date.setDate(today.getDate() - i);
			const dateStr = date.toISOString().split('T')[0];
			
			const dayWords = this.plugin.sessionHistory
				.filter(session => session.date === dateStr && session.endTime)
				.reduce((sum, session) => sum + session.wordCount, 0);
			
			data.push({
				date: dateStr,
				words: dayWords
			});
		}
		
		return data;
	}

	refresh() {
		this.render();
	}
}