import { Plugin, Notice, TFile, MarkdownView, ItemView, WorkspaceLeaf } from 'obsidian';
import { NetworkPromptsService } from './src/core/network-prompts';

// Core modules
import { ReminderScheduler } from './src/core/scheduler';
import { TemplateEngine } from './src/core/template-engine';
import { DataManager } from './src/core/data-manager';
import { SessionManager } from './src/core/session-manager';
import { TemplateManager } from './src/core/template-manager';

// Purpose-based modules
import { QaOnboardingWizard } from './src/ui/qa-onboarding-wizard';
import { QaReviewModal } from './src/ui/qa-review-modal';
import { PurposeSessionManager } from './src/core/purpose-session-manager';
import { WeeklyPlanner } from './src/core/weekly-planner';
import { ToastManager } from './src/ui/toast';
import { EstimationEngine } from './src/core/estimation-engine';
import { WritingMomentumSettingTab } from './src/ui/settings-tab';

// Types
import type { WritingMomentumSettings, WritingSession, WritingProfile, SessionLog } from './src/types/interfaces';
import { DEFAULT_SETTINGS } from './src/types/interfaces';

// Remove duplicate interfaces - using imported ones from types/interfaces.ts

// Plugin data structure
interface PluginData {
	settings?: WritingMomentumSettings;
	sessions?: WritingSession[];
	writingProfile?: WritingProfile | null;
	sessionLogs?: SessionLog[];
	[key: string]: unknown;
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
	"Write about the space between heartbeats",

	// New Creative Scenarios
	"You discover a door in your house that wasn't there before. Where does it lead?",
	"Write a conversation between the sun and the moon",
	"What if plants could walk? Describe their migration patterns",
	"You find a map with your name on it. What does it show?",
	"Describe a museum dedicated to forgotten moments",

	// New Reflection Prompts
	"What truth have you been avoiding?",
	"Write about the person you're becoming",
	"What does rest mean to you?",
	"Describe a belief you've outgrown",
	"What would your future self thank you for?",

	// Character & Perspective
	"Tell a story from the perspective of a street lamp",
	"You can speak to animals for one hour. What do you learn?",
	"Write about someone's last day at a job they've had for 30 years",
	"A child explains death to an immortal being",
	"Describe a villain's morning routine",

	// Philosophical Questions
	"Is it possible to truly know another person?",
	"What makes a place feel like home versus just a house?",
	"Write about the difference between being alone and being lonely",
	"Can a lie ever be more true than the truth?",
	"What do we owe to strangers?",

	// Sensory & Atmosphere
	"Describe the taste of a memory",
	"Write about the sound of silence in different places",
	"What does anticipation smell like?",
	"Describe the texture of trust",
	"Write about the temperature of different emotions",

	// Unconventional Prompts
	"You are the author of your life story. Write the chapter you're avoiding",
	"Objects in your home conspire to tell you something. What is it?",
	"Write instructions for how to be you",
	"Describe the world through the eyes of someone seeing it for the last time",
	"What would your personal mythology be?",

	// Time & Memory
	"Write about a memory that never happened but feels real",
	"If you could pause time for one hour every day, what would you do?",
	"Describe the moment between sleeping and waking",
	"Write about something you wish you could remember",
	"What will today look like when it becomes a memory?",

	// Relationships & Connection
	"Write about a friendship that ended without explanation",
	"Describe the moment you realized someone truly understood you",
	"What do you inherit from people you've never met?",
	"Write about two people who speak different languages finding common ground",
	"Describe love in a way that's never been described before",

	// Nature & Elements
	"If seasons had personalities, what would they be like at a dinner party?",
	"Write about the secret life of clouds",
	"Describe the ocean's dreams",
	"What stories do old trees tell each other?",
	"Write about the journey of a single raindrop",

	// Identity & Self
	"What parts of yourself do you hide, and why?",
	"Write about the different versions of you that exist in other people's minds",
	"Describe the moment you became who you are",
	"What mask do you wear most often?",
	"Write a letter to yourself from yourself, ten years from now"
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
	dataManager: DataManager;
	templateEngine: TemplateEngine;
	templateManager: TemplateManager;
	sessionManager: SessionManager;
	reminderScheduler: ReminderScheduler;
	statusBarItem: HTMLElement | null = null;
	currentSession: WritingSession | null = null;
	private wordCountInterval: number | null = null;
	randomPrompts: NetworkPromptsService;
	isMobile: boolean = false;

	// Purpose-based system
	purposeSessionManager: PurposeSessionManager | null = null;
	toastManager: ToastManager;
	activeProfile: WritingProfile | null = null;
	sessionLogs: SessionLog[] = [];
	private nudgeInterval: number | null = null;

	async onload() {
		// Detect mobile platform
		this.isMobile = ('isMobile' in this.app ? (this.app as { isMobile: boolean }).isMobile : false);

		// Load settings and session history
		await this.loadSettings();

		// Initialize core systems
		this.dataManager = new DataManager(this);
		this.templateEngine = new TemplateEngine(this);
		this.templateManager = new TemplateManager(this);
		this.sessionManager = new SessionManager(this);
		this.reminderScheduler = new ReminderScheduler(this);

		await this.dataManager.loadData();
		await this.templateEngine.initialize();

		// Migrate old sessionHistory to new dataManager.sessions system
		await this.migrateSessionHistory();

		// Initialize random prompts service
		this.randomPrompts = new NetworkPromptsService(this);

		// Auto-refresh random prompts if enabled
		if (this.settings.randomPrompts.enabled && this.settings.randomPrompts.autoRefresh) {
			// Fetch prompts in background (don't await to avoid blocking startup)
			this.randomPrompts.fetchNetworkPrompts().catch(() => {
				// Background fetch failed - continue silently
			});
		}

		// Initialize purpose-based system
		this.toastManager = new ToastManager();
		await this.loadPurposeData();

		// Check if user needs onboarding
		if (!this.activeProfile) {
			// Show Q&A onboarding wizard for new users
			new QaOnboardingWizard(this.app, async (profile) => {
				this.activeProfile = profile;
				await this.savePurposeData();

				// Initialize purpose session manager with profile
				this.purposeSessionManager = new PurposeSessionManager(this);
				this.purposeSessionManager.setActiveProfile(profile);

				// Start weekly nudge scheduler
				this.startNudgeScheduler();

				// Show confirmation with recommendation
				const rec = EstimationEngine.describe(profile.recommendation);
				this.toastManager.success(`Profile created! Defaults set: ${rec}`, 5000);
			}).open();
		} else {
			// Existing user - initialize purpose session manager
			this.purposeSessionManager = new PurposeSessionManager(this);
			this.purposeSessionManager.setActiveProfile(this.activeProfile);

			// Start weekly nudge scheduler
			this.startNudgeScheduler();
		}

		// Register dashboard view
		this.registerView(
			VIEW_TYPE_WRITING_DASHBOARD,
			(leaf) => new WritingDashboard(leaf, this)
		);

		// Add ribbon icon (always show on mobile for easy access)
		if (this.settings.ui.showRibbonIcon || this.isMobile) {
			this.addRibbonIcon('target', 'Writing momentum', () => {
				this.openDashboard();
			});
		}

		// Add status bar
		if (this.settings.ui.showStatusBar) {
			this.statusBarItem = this.addStatusBarItem();
			this.updateStatusBar();
		}

		// Add commands
		this.addCommand({
			id: 'open-dashboard',
			name: 'Open dashboard',
			callback: () => this.openDashboard()
		});

		this.addCommand({
			id: 'start-writing-session',
			name: 'Start session',
			callback: () => this.startQuickSession()
		});

		this.addCommand({
			id: 'complete-session',
			name: 'Complete session',
			callback: () => this.completeSession()
		});

		this.addCommand({
			id: 'quick-note',
			name: 'Create quick note',
			callback: () => this.createQuickNote()
		});

		this.addCommand({
			id: 'insert-writing-prompt',
			name: 'Insert prompt',
			callback: () => this.insertWritingPrompt()
		});

		this.addCommand({
			id: 'start-session-current-file',
			name: 'Start session on current file',
			callback: () => this.startSessionOnCurrentFile()
		});

		this.addCommand({
			id: 'stop-all-timers',
			name: 'Stop all timers and alarms',
			callback: () => this.stopAllTimers()
		});

		// Purpose-based commands
		this.addCommand({
			id: 'wm-start-purpose-session',
			name: 'Start writing session',
			callback: () => {
				const file = this.app.workspace.getActiveFile();
				if (file && this.purposeSessionManager) {
					this.purposeSessionManager.startSession(file.path);
				} else if (!file) {
					this.toastManager.warn('Please open a file to start a session');
				}
			}
		});

		this.addCommand({
			id: 'wm-pause-session',
			name: 'Pause session',
			callback: () => {
				if (this.purposeSessionManager) {
					this.purposeSessionManager.pauseSession();
				}
			}
		});

		this.addCommand({
			id: 'wm-resume-session',
			name: 'Resume session',
			callback: () => {
				if (this.purposeSessionManager) {
					this.purposeSessionManager.resumeSession();
				}
			}
		});

		this.addCommand({
			id: 'wm-complete-session',
			name: 'Complete session',
			callback: () => {
				if (this.purposeSessionManager) {
					this.purposeSessionManager.completeSession();
				}
			}
		});

		this.addCommand({
			id: 'wm-skip-session',
			name: 'Skip session',
			callback: () => {
				if (this.purposeSessionManager) {
					this.purposeSessionManager.skipSession();
				}
			}
		});

		this.addCommand({
			id: 'wm-weekly-summary',
			name: 'Show weekly summary',
			callback: () => {
				if (this.activeProfile) {
					const planner = new WeeklyPlanner(
						this.activeProfile,
						this.sessionLogs,
						this.toastManager
					);
					planner.showWeeklySummary();
				}
			}
		});

		this.addCommand({
			id: 'wm-run-onboarding',
			name: 'Re-run onboarding',
			callback: () => {
				new QaOnboardingWizard(this.app, async (profile) => {
					this.activeProfile = profile;
					await this.savePurposeData();

					if (this.purposeSessionManager) {
						this.purposeSessionManager.setActiveProfile(profile);
					}

					const rec = EstimationEngine.describe(profile.recommendation);
					this.toastManager.success(`Profile updated! ${rec}`, 4000);
				}).open();
			}
		});

		this.addCommand({
			id: 'wm-view-qa-answers',
			name: 'View answers',
			callback: () => {
				if (!this.activeProfile) {
					this.toastManager.warn('No profile found. Please run onboarding first.');
					return;
				}

				new QaReviewModal(
					this.app,
					this.activeProfile,
					() => {
						// Edit callback - reopen onboarding
						new QaOnboardingWizard(this.app, async (profile) => {
							this.activeProfile = profile;
							await this.savePurposeData();

							if (this.purposeSessionManager) {
								this.purposeSessionManager.setActiveProfile(profile);
							}

							this.toastManager.success('Answers updated!', 3000);
						}).open();
					},
					async (newRec) => {
						// Recalculate callback
						if (this.activeProfile) {
							this.activeProfile.recommendation = newRec;
							this.activeProfile.updatedAt = Date.now();
							await this.savePurposeData();

							const rec = EstimationEngine.describe(newRec);
							this.toastManager.success(`Defaults recalculated: ${rec}`, 4000);
						}
					}
				).open();
			}
		});

		this.addCommand({
			id: 'wm-recalculate-defaults',
			name: 'Recalculate defaults',
			callback: async () => {
				if (!this.activeProfile) {
					this.toastManager.warn('No profile found. Please run onboarding first.');
					return;
				}

				const newRec = EstimationEngine.estimate(this.activeProfile.answers);
				this.activeProfile.recommendation = newRec;
				this.activeProfile.updatedAt = Date.now();
				// Clear overrides when recalculating
				this.activeProfile.overrides = undefined;
				await this.savePurposeData();

				const rec = EstimationEngine.describe(newRec);
				this.toastManager.success(`Defaults recalculated: ${rec}`, 4000);
			}
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

	}

	onunload() {
		// End any active session before closing
		if (this.currentSession && this.currentSession.active) {
			this.sessionManager.endSession();
		}

		this.stopAllTimers();

		// Clean up purpose-based managers
		if (this.purposeSessionManager) {
			this.purposeSessionManager.destroy();
		}
		if (this.toastManager) {
			this.toastManager.cleanup();
		}
		if (this.nudgeInterval) {
			window.clearInterval(this.nudgeInterval);
		}
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
			this.completeSession();
		}
		// new Notice('All writing timers and alarms stopped');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	// Purpose-based data management
	async loadPurposeData() {
		const data = await this.loadData() as PluginData | null;
		this.activeProfile = data?.writingProfile || null;
		this.sessionLogs = data?.sessionLogs || [];
	}

	async savePurposeData() {
		const data = (await this.loadData() as PluginData | null) || {};
		data.writingProfile = this.activeProfile;
		data.sessionLogs = this.sessionLogs;
		await this.saveData(data);
	}

	// Weekly nudge scheduler
	startNudgeScheduler() {
		if (this.nudgeInterval) {
			window.clearInterval(this.nudgeInterval);
		}

		// Check for nudges every 15 minutes
		this.nudgeInterval = window.setInterval(() => {
			if (!this.activeProfile) return;

			const planner = new WeeklyPlanner(
				this.activeProfile,
				this.sessionLogs,
				this.toastManager
			);

			if (planner.shouldNudge()) {
				planner.showNudge();
			}
		}, 60000 * 15); // 15 minutes

		this.registerInterval(this.nudgeInterval);
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

	async migrateSessionHistory() {
		// Migrate old sessionHistory to new dataManager.sessions system
		const data = await this.loadData();
		if (data?.sessionHistory && Array.isArray(data.sessionHistory) && data.sessionHistory.length > 0) {
			console.debug(`Migrating ${data.sessionHistory.length} sessions from old sessionHistory to dataManager...`);

			// Get existing sessions to avoid duplicates
			const existingSessions = this.dataManager.getAllSessions();
			const existingIds = new Set(existingSessions.map(s => s.id));

			// Migrate sessions that don't already exist
			let migratedCount = 0;
			for (const session of data.sessionHistory) {
				if (!existingIds.has(session.id)) {
					await this.dataManager.addSession(session);
					migratedCount++;
				}
			}

			if (migratedCount > 0) {
				console.debug(`Successfully migrated ${migratedCount} sessions`);

				// Remove old sessionHistory after successful migration
				delete data.sessionHistory;
				await this.saveData(data);
			}
		}
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
			// On mobile, use the main leaf; on desktop, use right sidebar
			if (this.isMobile) {
				leaf = workspace.getLeaf(false);
			} else {
				const rightLeaf = workspace.getRightLeaf(false);
				if (rightLeaf) {
					leaf = rightLeaf;
				}
			}

			if (leaf) {
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
			date: new Date().toISOString().split('T')[0],
			files: [activeFile.path],
			completed: false
		};

		// Start monitoring word count
		this.startWordCountTracking();
		
		if (this.settings.enableNotifications) {
			// new Notice('Writing session started! 📝');
		}

		this.updateStatusBar();
		this.refreshDashboard();
	}

	async completeSession() {
		if (!this.currentSession) {
			// new Notice('No active session to complete');
			return;
		}

		this.currentSession.active = false;
		this.currentSession.endTime = Date.now();

		// Save to dataManager (handles persistence)
		await this.dataManager.addSession({...this.currentSession});

		if (this.settings.enableNotifications) {
			// const message = `Session completed! ${this.currentSession.wordCount} words in ${duration} minutes 🎉`;
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
	}

	resumeSession() {
		if (!this.currentSession || !this.currentSession.active || !this.currentSession.paused) {
			// new Notice('No paused session to resume');
			return;
		}

		// Add the paused duration to total
		if (this.currentSession.pausedTime) {
			this.currentSession.totalPausedDuration! += Date.now() - this.currentSession.pausedTime;
		}

		this.currentSession.paused = false;
		this.currentSession.pausedTime = undefined;

		// Restart word count tracking
		this.startWordCountTracking();

		if (this.settings.enableNotifications) {
			// new Notice('Session resumed ▶️');
		}

		this.updateStatusBar();
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

		const file = this.app.vault.getAbstractFileByPath(this.currentSession.filePath!);
		if (file instanceof TFile) {
			try {
				const content = await this.app.vault.read(file);
				const wordCount = this.countWords(content);
				this.currentSession.wordCount = wordCount;
				this.updateStatusBar();
			} catch {
				// Failed to read file, continue silently
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
			let effectiveDuration = Date.now() - this.currentSession.startTime - (this.currentSession.totalPausedDuration || 0);
			
			// If currently paused, don't include the current pause time
			if (this.currentSession.paused && this.currentSession.pausedTime) {
				effectiveDuration -= (Date.now() - this.currentSession.pausedTime);
			}
			
			const duration = Math.round(effectiveDuration / 60000);
			const pauseIndicator = this.currentSession.paused ? ' ⏸️' : '';
			this.statusBarItem.setText(`✍️ ${this.currentSession.wordCount} words (${duration}m)${pauseIndicator}`);
		} else {
			this.statusBarItem.setText('📝 ready to write');
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
			new Notice(`Failed to create quick note: ${error.message}`);
		}
	}

	async startSessionOnCurrentFile() {
		// Get the currently active file
		const activeFile = this.app.workspace.getActiveFile();

		if (!activeFile) {
			new Notice('Please open a file first to start a writing session');
			return;
		}

		// Check if there's already an active session
		if (this.currentSession && this.currentSession.active) {
			new Notice('A session is already active. Please complete or end it first.');
			return;
		}

		try {
			// Get goal target for the session
			let targetWordCount = 0;
			if (this.activeProfile && this.activeProfile.recommendation) {
				const rec = this.activeProfile.recommendation;
				if (rec.target.type === 'words') {
					targetWordCount = rec.target.value;
				}
			} else if (this.settings.streakRule.mode === 'daily') {
				targetWordCount = this.settings.streakRule.target;
			}

			// Start a new session on the current file
			const sessionId = `session-${Date.now()}`;
			const today = new Date().toISOString().split('T')[0];

			this.currentSession = {
				id: sessionId,
				date: today,
				startTime: Date.now(),
				wordCount: 0,
				targetCount: targetWordCount > 0 ? targetWordCount : undefined,
				files: [activeFile.path],
				completed: false,
				active: true,
				paused: false,
				totalPausedDuration: 0,
				filePath: activeFile.path
			};

			// Start word count monitoring (SessionManager will save to dataManager when session ends)
			this.sessionManager.startSession(activeFile.path, undefined, targetWordCount > 0 ? targetWordCount : undefined);

			// Show notification
			if (this.settings.ui.notifications) {
				const targetMsg = targetWordCount > 0 ? ` Target: ${targetWordCount} words` : '';
				new Notice(`Writing session started on "${activeFile.basename}"!${targetMsg}`);
			}

			// Refresh dashboard if open
			this.app.workspace.getLeavesOfType('writing-momentum-dashboard').forEach(leaf => {
				if (leaf.view instanceof ItemView && 'refresh' in leaf.view && typeof leaf.view.refresh === 'function') {
					leaf.view.refresh();
				}
			});
		} catch (error) {
			new Notice(`Failed to start session: ${error.message}`);
		}
	}

	async createTemplateNoteAndStartSession() {
		// Check if we should use active template directly
		let selectedTemplate;

		if (this.settings.alwaysUseActiveTemplate) {
			// Use active template without showing dialog
			const activeTemplate = this.templateManager.getActiveTemplate();
			if (activeTemplate) {
				selectedTemplate = {
					name: activeTemplate.name,
					title: activeTemplate.titlePattern,
					template: activeTemplate.content
				};
			} else {
				// No active template set, show dialog
				selectedTemplate = await this.showTemplateSelectionDialog();
				if (!selectedTemplate) {
					return; // User cancelled
				}
			}
		} else {
			// Show template selection dialog
			selectedTemplate = await this.showTemplateSelectionDialog();
			if (!selectedTemplate) {
				return; // User cancelled
			}
		}

		try {
			// Process the title pattern
			const title = this.processTemplate(selectedTemplate.title);

			// Process the template content
			const content = this.processTemplate(selectedTemplate.template, title);

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
			modal.className = 'template-modal-container';

			const dialog = document.createElement('div');
			dialog.className = 'template-selection-dialog';

			// Create header
			dialog.createEl('h2', { text: 'Choose writing template' });
			dialog.createEl('p', { text: 'Select a template to start your writing session:' });
			const optionsContainer = dialog.createEl('div', { cls: 'template-options' });
			const buttonsContainer = dialog.createEl('div', { cls: 'template-dialog-buttons' });
			const cancelBtn = buttonsContainer.createEl('button', { text: 'Cancel', cls: 'cancel-btn' });

			templates.forEach((template) => {
				const option = optionsContainer.createEl('div', { cls: 'template-option' });

				option.createEl('h3', { text: template.name });
				option.createEl('p', { text: template.description });

				option.addEventListener('click', () => {
					document.body.removeChild(modal);
					resolve(template);
				});
			});

			cancelBtn.addEventListener('click', () => {
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
		return 'Writing dashboard';
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
			let effectiveDuration = Date.now() - session.startTime - (session.totalPausedDuration || 0);
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

		// Update today's goal progress in real-time
		this.updateGoalProgress();
	}

	private updateGoalProgress() {
		// Determine goal type and target from active profile or fallback to streakRule
		let goalType: 'words' | 'minutes' = 'words';
		let dailyTarget = 0;

		if (this.plugin.activeProfile && this.plugin.activeProfile.recommendation) {
			const rec = this.plugin.activeProfile.recommendation;
			goalType = rec.target.type;
			dailyTarget = rec.target.value;
		} else if (this.plugin.settings.streakRule.mode === 'daily') {
			goalType = 'words';
			dailyTarget = this.plugin.settings.streakRule.target;
		} else {
			goalType = 'words';
			dailyTarget = Math.round(this.plugin.settings.streakRule.target / 7);
		}

		// Get today's progress
		const today = new Date().toISOString().split('T')[0];
		let currentProgress = 0;

		if (goalType === 'words') {
			// Calculate today's word count (including active session)
			const allSessions = this.plugin.dataManager.getAllSessions();
			currentProgress = allSessions
				.filter(session => session.date === today && session.endTime)
				.reduce((sum, session) => sum + session.wordCount, 0);

			// Add current active session if exists
			if (this.plugin.currentSession && this.plugin.currentSession.active && this.plugin.currentSession.date === today) {
				currentProgress += this.plugin.currentSession.wordCount || 0;
			}
		} else {
			// Calculate today's writing time in minutes (including active session)
			const allSessions = this.plugin.dataManager.getAllSessions();
			let totalMs = allSessions
				.filter(session => session.date === today && session.endTime && session.startTime)
				.reduce((sum, session) => sum + (session.endTime! - session.startTime), 0);

			// Add current active session if exists
			if (this.plugin.currentSession && this.plugin.currentSession.active && this.plugin.currentSession.date === today) {
				let effectiveDuration = Date.now() - this.plugin.currentSession.startTime - (this.plugin.currentSession.totalPausedDuration || 0);
				if (this.plugin.currentSession.paused && this.plugin.currentSession.pausedTime) {
					effectiveDuration -= (Date.now() - this.plugin.currentSession.pausedTime);
				}
				totalMs += effectiveDuration;
			}

			currentProgress = Math.floor(totalMs / 60000); // Convert to minutes
		}

		// Calculate percentage
		const percentage = Math.min((currentProgress / dailyTarget) * 100, 100);
		const isGoalMet = currentProgress >= dailyTarget;

		// Update progress ring
		const progressRing = this.containerEl.querySelector('.goal-progress-ring') as SVGCircleElement;
		if (progressRing) {
			const circumference = 2 * Math.PI * 70;
			const offset = circumference - (percentage / 100) * circumference;
			progressRing.setAttribute('stroke-dashoffset', offset.toString());
			progressRing.setAttribute('stroke', isGoalMet ? 'var(--color-green)' : 'var(--interactive-accent)');
		}

		// Update current value
		const currentValueElement = this.containerEl.querySelector('.goal-current-value');
		if (currentValueElement) {
			currentValueElement.textContent = currentProgress.toString();
		}

		// Update percentage
		const percentageElement = this.containerEl.querySelector('.goal-percentage');
		if (percentageElement) {
			percentageElement.textContent = Math.round(percentage) + '%';
		}

		// Update status message
		const statusElement = this.containerEl.querySelector('.goal-status');
		if (statusElement) {
			statusElement.empty();
			if (isGoalMet) {
				statusElement.createEl('span', {
					text: '🎉 goal achieved',
					cls: 'goal-status-achieved'
				});
			} else {
				const remaining = dailyTarget - currentProgress;
				const unit = goalType === 'words' ? 'words' : 'minutes';
				statusElement.createEl('span', {
					text: `${remaining} ${unit} to go`,
					cls: 'goal-status-remaining'
				});
			}
		}
	}

	render() {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass('writing-momentum-dashboard');

		// Add mobile class if on mobile
		if (this.plugin.isMobile) {
			container.addClass('is-mobile');
		}

		// Header
		const header = container.createEl('div', { cls: 'dashboard-header' });
		header.createEl('h2', { text: 'Writing dashboard', cls: 'dashboard-title' });

		// Current Session
		this.renderCurrentSession(container);

		// Only show Writing Mode when no session is active
		const hasActiveSession = this.plugin.currentSession && this.plugin.currentSession.active;

		if (!hasActiveSession) {
			this.renderWritingMode(container);
		}

		// Writing Volume Charts
		this.renderWritingVolumeChart(container);
	}

	private renderCurrentSession(container: Element) {
		const sessionEl = container.createEl('div', { cls: 'dashboard-section' });
		
		if (this.plugin.currentSession && this.plugin.currentSession.active) {
			const session = this.plugin.currentSession;
			
			// Calculate effective duration (excluding paused time)
			let effectiveDuration = Date.now() - session.startTime - (session.totalPausedDuration || 0);
			if (session.paused && session.pausedTime) {
				effectiveDuration -= (Date.now() - session.pausedTime);
			}
			
			// Add pause indicator to header
			const sessionHeader = sessionEl.createEl('h3', {
				text: session.paused ? '🎯 Current session (paused)' : '🎯 Current session'
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
			fileEl.createEl('span', { text: '📄 ' + (session.filePath?.split('/').pop() || 'Unknown file') });
			
			// Writing inspiration section
			const inspirationEl = sessionEl.createEl('div', { cls: 'writing-inspiration' });
			this.renderWritingInspiration(inspirationEl);
			
			const actionsEl = sessionEl.createEl('div', { cls: 'session-actions' });
			
			const completeBtn = actionsEl.createEl('button', {
				text: '✅ complete session',
				cls: 'session-btn complete-btn'
			});
			completeBtn.onclick = () => {
				this.plugin.completeSession();
				this.render();
			};
		} else {
			sessionEl.createEl('p', {
				text: '💤 no active session',
				cls: 'no-session-message'
			});
		}
	}

	private renderWritingInspiration(container: Element) {
		const promptCard = container.createEl('div', { cls: 'prompt-card' });
		
		// Header with refresh button
		const promptHeader = promptCard.createEl('div', { cls: 'prompt-header' });
		promptHeader.createEl('span', { text: '✨ writing inspiration', cls: 'prompt-title' });
		
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
			keywordContainer.createEl('span', {
				text: this.plugin.getRandomKeyword(),
				cls: 'keyword-tag'
			});
			if (i < 2) {
				keywordContainer.createEl('span', { text: ' • ', cls: 'keyword-separator' });
			}
		}
		
		// Copy to clipboard button
		const copyBtn = promptCard.createEl('button', {
			text: '📋 copy to clipboard',
			cls: 'copy-prompt-btn'
		});
		
		// Event handlers
		refreshPromptBtn.onclick = () => {
			promptText.setText(this.plugin.getRandomPrompt());
			
			// Refresh keywords
			keywordContainer.empty();
			for (let i = 0; i < 3; i++) {
				keywordContainer.createEl('span', {
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
				copyBtn.setText('✅ copied!');
				setTimeout(() => {
					copyBtn.setText('📋 copy to clipboard');
				}, 2000);
			} catch {
				// Fallback for older browsers
				const textArea = document.createElement('textarea');
				textArea.value = textToCopy;
				document.body.appendChild(textArea);
				textArea.select();
				document.execCommand('copy');
				document.body.removeChild(textArea);
				copyBtn.setText('✅ copied!');
				setTimeout(() => {
					copyBtn.setText('📋 copy to clipboard');
				}, 2000);
			}
		};
	}

	private renderWritingMode(container: Element) {
		const actionsEl = container.createEl('div', { cls: 'dashboard-section' });
		actionsEl.createEl('h3', { text: 'Writing mode' });

		const buttonsEl = actionsEl.createEl('div', { cls: 'action-buttons' });

		const startSessionBtn = buttonsEl.createEl('button', {
			text: '🚀 start new note',
			cls: 'action-btn start-session-btn'
		});
		startSessionBtn.onclick = async () => {
			await this.plugin.createTemplateNoteAndStartSession();
			// Dashboard will refresh automatically when session starts
		};

		const startWithoutTemplateBtn = buttonsEl.createEl('button', {
			text: '✏️ start on current file',
			cls: 'action-btn start-current-file-btn'
		});
		startWithoutTemplateBtn.onclick = async () => {
			await this.plugin.startSessionOnCurrentFile();
			// Dashboard will refresh automatically when session starts
		};
	}


	private renderWritingVolumeChart(container: Element) {
		const chartEl = container.createEl('div', { cls: 'dashboard-section' });
		chartEl.createEl('h3', { text: 'Writing progress' });

		// Create chart container
		const chartContainer = chartEl.createEl('div', { cls: 'chart-container' });

		// Render today's goal achievement
		this.renderTodaysGoal(chartContainer);

		// Render contribution heatmap
		this.renderContributionHeatmap(chartContainer);
	}

	private renderTodaysGoal(container: Element) {
		const goalEl = container.createEl('div', { cls: 'todays-goal' });

		// Determine goal type and target from active profile or fallback to streakRule
		let goalType: 'words' | 'minutes' = 'words';
		let dailyTarget = 0;

		if (this.plugin.activeProfile && this.plugin.activeProfile.recommendation) {
			const rec = this.plugin.activeProfile.recommendation;
			goalType = rec.target.type;

			// Calculate daily target from weekly target
			// If sessionsPerWeek is set, divide by that; otherwise assume 5 days per week
			// const sessionsPerWeek = rec.sessionsPerWeek || 5;
			dailyTarget = rec.target.value;
		} else if (this.plugin.settings.streakRule.mode === 'daily') {
			// Fallback to old system - assume it's words per day
			goalType = 'words';
			dailyTarget = this.plugin.settings.streakRule.target;
		} else {
			// Weekly mode - divide by 7 for daily average
			goalType = 'words';
			dailyTarget = Math.round(this.plugin.settings.streakRule.target / 7);
		}

		// Get today's progress
		const today = new Date().toISOString().split('T')[0];
		let currentProgress = 0;
		let currentProgressDisplay = '';

		if (goalType === 'words') {
			// Calculate today's word count (including active session)
			const allSessions = this.plugin.dataManager.getAllSessions();
			currentProgress = allSessions
				.filter(session => session.date === today && session.endTime)
				.reduce((sum, session) => sum + session.wordCount, 0);

			// Add current active session if exists
			if (this.plugin.currentSession && this.plugin.currentSession.active && this.plugin.currentSession.date === today) {
				currentProgress += this.plugin.currentSession.wordCount || 0;
			}

			currentProgressDisplay = currentProgress.toString();
		} else {
			// Calculate today's writing time in minutes (including active session)
			const allSessions = this.plugin.dataManager.getAllSessions();
			let totalMs = allSessions
				.filter(session => session.date === today && session.endTime && session.startTime)
				.reduce((sum, session) => sum + (session.endTime! - session.startTime), 0);

			// Add current active session if exists
			if (this.plugin.currentSession && this.plugin.currentSession.active && this.plugin.currentSession.date === today) {
				let effectiveDuration = Date.now() - this.plugin.currentSession.startTime - (this.plugin.currentSession.totalPausedDuration || 0);
				if (this.plugin.currentSession.paused && this.plugin.currentSession.pausedTime) {
					effectiveDuration -= (Date.now() - this.plugin.currentSession.pausedTime);
				}
				totalMs += effectiveDuration;
			}

			currentProgress = Math.floor(totalMs / 60000); // Convert to minutes
			currentProgressDisplay = currentProgress.toString();
		}

		// Calculate percentage
		const percentage = Math.min((currentProgress / dailyTarget) * 100, 100);
		const isGoalMet = currentProgress >= dailyTarget;

		// Header
		goalEl.createEl('h4', { text: "Today's goal" });

		// Progress ring
		const ringContainer = goalEl.createEl('div', { cls: 'goal-ring-container' });
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.setAttribute('class', 'goal-ring');
		svg.setAttribute('width', '160');
		svg.setAttribute('height', '160');
		svg.setAttribute('viewBox', '0 0 160 160');

		// Background circle
		const bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
		bgCircle.setAttribute('cx', '80');
		bgCircle.setAttribute('cy', '80');
		bgCircle.setAttribute('r', '70');
		bgCircle.setAttribute('fill', 'none');
		bgCircle.setAttribute('stroke', 'var(--background-modifier-border)');
		bgCircle.setAttribute('stroke-width', '12');
		svg.appendChild(bgCircle);

		// Progress circle
		const circumference = 2 * Math.PI * 70;
		const offset = circumference - (percentage / 100) * circumference;

		const progressCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
		progressCircle.setAttribute('cx', '80');
		progressCircle.setAttribute('cy', '80');
		progressCircle.setAttribute('r', '70');
		progressCircle.setAttribute('fill', 'none');
		progressCircle.setAttribute('stroke', isGoalMet ? 'var(--color-green)' : 'var(--interactive-accent)');
		progressCircle.setAttribute('stroke-width', '12');
		progressCircle.setAttribute('stroke-dasharray', circumference.toString());
		progressCircle.setAttribute('stroke-dashoffset', offset.toString());
		progressCircle.setAttribute('stroke-linecap', 'round');
		progressCircle.setAttribute('transform', 'rotate(-90 80 80)');
		progressCircle.setAttribute('class', 'goal-progress-ring');
		svg.appendChild(progressCircle);

		ringContainer.appendChild(svg);

		// Center text with proper units
		const centerText = ringContainer.createEl('div', { cls: 'goal-center-text' });
		centerText.createEl('div', {
			text: currentProgressDisplay,
			cls: 'goal-current-words goal-current-value'
		});
		centerText.createEl('div', {
			text: `/ ${dailyTarget} ${goalType === 'words' ? 'words' : 'min'}`,
			cls: 'goal-target-words'
		});
		centerText.createEl('div', {
			text: Math.round(percentage) + '%',
			cls: 'goal-percentage'
		});

		// Status message with proper units
		const statusEl = goalEl.createEl('div', { cls: 'goal-status' });
		if (isGoalMet) {
			statusEl.createEl('span', {
				text: '🎉 goal achieved',
				cls: 'goal-status-achieved'
			});
		} else {
			const remaining = dailyTarget - currentProgress;
			const unit = goalType === 'words' ? 'words' : 'minutes';
			statusEl.createEl('span', {
				text: `${remaining} ${unit} to go`,
				cls: 'goal-status-remaining'
			});
		}
	}

	private renderContributionHeatmap(container: Element) {
		const heatmapEl = container.createEl('div', { cls: 'contribution-heatmap' });
		heatmapEl.createEl('h4', { text: 'Goal achievement history' });

		// Get last 12 weeks of data (84 days)
		const heatmapData = this.getHeatmapData();

		// Determine daily goal target (only support word-based goals in heatmap for now)
		let dailyTarget = 0;
		if (this.plugin.activeProfile && this.plugin.activeProfile.recommendation) {
			const rec = this.plugin.activeProfile.recommendation;
			// For time-based goals, we can't easily show in heatmap as it requires session duration data
			// So we'll use word count from heatmap data
			if (rec.target.type === 'words') {
				dailyTarget = rec.target.value;
			} else {
				// For minute-based goals, we'll just use a default or skip intensity calculation
				dailyTarget = 500; // Default fallback for time-based goals
			}
		} else if (this.plugin.settings.streakRule.mode === 'daily') {
			dailyTarget = this.plugin.settings.streakRule.target;
		} else {
			dailyTarget = Math.round(this.plugin.settings.streakRule.target / 7);
		}

		const goalTarget = dailyTarget;

		// Create month labels
		const monthLabels = heatmapEl.createEl('div', { cls: 'heatmap-months' });
		const months = this.getMonthLabels(heatmapData);
		months.forEach(month => {
			monthLabels.createEl('span', {
				text: month.label,
				cls: 'month-label'
			});
		});

		// Create grid with day labels
		const gridWrapper = heatmapEl.createEl('div', { cls: 'heatmap-wrapper' });

		// Day labels (M, W, F)
		const dayLabels = gridWrapper.createEl('div', { cls: 'heatmap-day-labels' });
		['Mon', 'Wed', 'Fri'].forEach((day, idx) => {
			const label = dayLabels.createEl('div', { cls: 'day-label' });
			label.style.gridRow = (idx * 2 + 2).toString();
			label.setText(day);
		});

		// Create grid cells
		const grid = gridWrapper.createEl('div', { cls: 'heatmap-cells' });

		// Group by weeks
		const weeks: Array<Array<typeof heatmapData[0]>> = [];
		for (let i = 0; i < heatmapData.length; i += 7) {
			weeks.push(heatmapData.slice(i, i + 7));
		}

		weeks.forEach((week, weekIdx) => {
			week.forEach((day, dayIdx) => {
				const cell = grid.createEl('div', { cls: 'heatmap-cell' });

				// Determine intensity based on goal achievement
				let intensity = 'none';
				if (day.words > 0) {
					const percentOfGoal = (day.words / goalTarget) * 100;
					if (percentOfGoal >= 100) {
						intensity = 'high';
					} else if (percentOfGoal >= 75) {
						intensity = 'medium';
					} else if (percentOfGoal >= 25) {
						intensity = 'low';
					} else {
						intensity = 'minimal';
					}
				}

				cell.addClass(`intensity-${intensity}`);
				cell.title = `${day.date}: ${day.words} words`;

				// Position in grid
				cell.style.gridColumn = (weekIdx + 2).toString();
				cell.style.gridRow = (dayIdx + 1).toString();
			});
		});

		// Legend
		const legend = heatmapEl.createEl('div', { cls: 'heatmap-legend' });
		legend.createEl('span', { text: 'Less', cls: 'legend-label' });
		['none', 'minimal', 'low', 'medium', 'high'].forEach(level => {
			const box = legend.createEl('div', { cls: 'legend-box' });
			box.addClass(`intensity-${level}`);
		});
		legend.createEl('span', { text: 'More', cls: 'legend-label' });
	}

	private getHeatmapData() {
		const data = [];
		const today = new Date();

		// Get all sessions from dataManager
		const allSessions = this.plugin.dataManager.getAllSessions();

		// Get last 84 days (12 weeks)
		for (let i = 83; i >= 0; i--) {
			const date = new Date(today);
			date.setDate(today.getDate() - i);
			const dateStr = date.toISOString().split('T')[0];

			const dayWords = allSessions
				.filter(session => session.date === dateStr && session.endTime)
				.reduce((sum, session) => sum + session.wordCount, 0);

			data.push({
				date: dateStr,
				words: dayWords,
				dayOfWeek: date.getDay()
			});
		}

		// Pad to start on Sunday
		const firstDayOfWeek = data[0].dayOfWeek;
		for (let i = 0; i < firstDayOfWeek; i++) {
			data.unshift({ date: '', words: 0, dayOfWeek: i });
		}

		return data;
	}

	private getMonthLabels(heatmapData: Array<{date: string; words: number}>) {
		const months: Array<{label: string; week: number}> = [];
		let currentMonth = -1;

		heatmapData.forEach((day, index) => {
			if (!day.date) return;

			const date = new Date(day.date);
			const month = date.getMonth();
			const weekIndex = Math.floor(index / 7);

			if (month !== currentMonth) {
				currentMonth = month;
				months.push({
					label: date.toLocaleDateString('en-US', { month: 'short' }),
					week: weekIndex
				});
			}
		});

		return months;
	}

	refresh() {
		this.render();
	}
}