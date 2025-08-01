import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, ItemView, WorkspaceLeaf } from 'obsidian';

interface WritingSession {
	id: string;
	start: number;
	end?: number;
	wordCount: number;
	files: string[];
}

interface WritingGoal {
	id: string;
	name: string;
	target: number;
	type: 'daily' | 'weekly' | 'monthly';
	active: boolean;
	created: number;
	folders?: string[];
}

interface WritingStreak {
	current: number;
	longest: number;
	lastWritingDay: string;
}

interface WritingMomentumSettings {
	dailyWordGoal: number;
	weeklyWordGoal: number;
	monthlyWordGoal: number;
	trackingFolders: string[];
	excludeFolders: string[];
	showStatusBar: boolean;
	showRibbonIcon: boolean;
	notifications: boolean;
	countingMethod: 'words' | 'characters';
}

const DEFAULT_SETTINGS: WritingMomentumSettings = {
	dailyWordGoal: 500,
	weeklyWordGoal: 3500,
	monthlyWordGoal: 15000,
	trackingFolders: [],
	excludeFolders: [],
	showStatusBar: true,
	showRibbonIcon: true,
	notifications: true,
	countingMethod: 'words'
};

class WordCounter {
	static countWords(text: string): number {
		return text.trim().split(/\s+/).filter(word => word.length > 0).length;
	}

	static countCharacters(text: string): number {
		return text.replace(/\s/g, '').length;
	}

	static count(text: string, method: 'words' | 'characters'): number {
		return method === 'words' ? this.countWords(text) : this.countCharacters(text);
	}
}

class DataManager {
	private plugin: WritingMomentumPlugin;
	private sessions: WritingSession[] = [];
	private goals: WritingGoal[] = [];
	private streak: WritingStreak = { current: 0, longest: 0, lastWritingDay: '' };

	constructor(plugin: WritingMomentumPlugin) {
		this.plugin = plugin;
	}

	async loadData() {
		const data = await this.plugin.loadData();
		if (data) {
			this.sessions = data.sessions || [];
			this.goals = data.goals || [];
			this.streak = data.streak || { current: 0, longest: 0, lastWritingDay: '' };
		}
	}

	async saveData() {
		await this.plugin.saveData({
			sessions: this.sessions,
			goals: this.goals,
			streak: this.streak
		});
	}

	addSession(session: WritingSession) {
		this.sessions.push(session);
		this.updateStreak();
		this.saveData();
	}

	addGoal(goal: WritingGoal) {
		this.goals.push(goal);
		this.saveData();
	}

	getTodaysSessions(): WritingSession[] {
		const today = new Date().toDateString();
		return this.sessions.filter(session => 
			new Date(session.start).toDateString() === today
		);
	}

	getTodaysWordCount(): number {
		return this.getTodaysSessions().reduce((total, session) => total + session.wordCount, 0);
	}

	getActiveGoals(): WritingGoal[] {
		return this.goals.filter(goal => goal.active);
	}

	getStreak(): WritingStreak {
		return this.streak;
	}

	private updateStreak() {
		const today = new Date().toDateString();
		const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();
		
		if (this.streak.lastWritingDay === today) {
			return;
		}
		
		if (this.streak.lastWritingDay === yesterday) {
			this.streak.current++;
		} else if (this.streak.lastWritingDay !== today) {
			this.streak.current = 1;
		}
		
		this.streak.lastWritingDay = today;
		if (this.streak.current > this.streak.longest) {
			this.streak.longest = this.streak.current;
		}
	}
}

const VIEW_TYPE_WRITING_DASHBOARD = 'writing-dashboard';

class WritingDashboardView extends ItemView {
	plugin: WritingMomentumPlugin;

	constructor(leaf: WorkspaceLeaf, plugin: WritingMomentumPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType() {
		return VIEW_TYPE_WRITING_DASHBOARD;
	}

	getDisplayText() {
		return 'Writing Dashboard';
	}

	async onOpen() {
		const container = this.containerEl.children[1];
		container.empty();
		container.createEl('h2', { text: 'Writing Dashboard' });
		
		this.renderStats(container);
		this.renderGoals(container);
		this.renderStreak(container);
	}

	private renderStats(container: Element) {
		const statsContainer = container.createEl('div', { cls: 'writing-stats' });
		statsContainer.createEl('h3', { text: 'Today\'s Progress' });
		
		const todaysCount = this.plugin.dataManager.getTodaysWordCount();
		const dailyGoal = this.plugin.settings.dailyWordGoal;
		const progress = Math.min((todaysCount / dailyGoal) * 100, 100);
		
		statsContainer.createEl('p', { text: `Words written: ${todaysCount}/${dailyGoal}` });
		statsContainer.createEl('p', { text: `Progress: ${progress.toFixed(1)}%` });
	}

	private renderGoals(container: Element) {
		const goalsContainer = container.createEl('div', { cls: 'writing-goals' });
		goalsContainer.createEl('h3', { text: 'Active Goals' });
		
		const activeGoals = this.plugin.dataManager.getActiveGoals();
		if (activeGoals.length === 0) {
			goalsContainer.createEl('p', { text: 'No active goals. Set one to get started!' });
		} else {
			activeGoals.forEach(goal => {
				goalsContainer.createEl('p', { text: `${goal.name}: ${goal.target} ${this.plugin.settings.countingMethod}` });
			});
		}
	}

	private renderStreak(container: Element) {
		const streakContainer = container.createEl('div', { cls: 'writing-streak' });
		streakContainer.createEl('h3', { text: 'Writing Streak' });
		
		const streak = this.plugin.dataManager.getStreak();
		streakContainer.createEl('p', { text: `Current streak: ${streak.current} days` });
		streakContainer.createEl('p', { text: `Longest streak: ${streak.longest} days` });
	}

	async onClose() {
		// Nothing to clean up
	}
}

export default class WritingMomentumPlugin extends Plugin {
	settings: WritingMomentumSettings;
	dataManager: DataManager;
	statusBarItem: HTMLElement;
	currentSession: WritingSession | null = null;

	async onload() {
		await this.loadSettings();
		this.dataManager = new DataManager(this);
		await this.dataManager.loadData();

		this.registerView(
			VIEW_TYPE_WRITING_DASHBOARD,
			(leaf) => new WritingDashboardView(leaf, this)
		);

		if (this.settings.showRibbonIcon) {
			this.addRibbonIcon('target', 'Writing Momentum', () => {
				this.activateView();
			});
		}

		if (this.settings.showStatusBar) {
			this.statusBarItem = this.addStatusBarItem();
			this.updateStatusBar();
		}

		this.addCommand({
			id: 'open-writing-dashboard',
			name: 'Open Writing Dashboard',
			callback: () => {
				this.activateView();
			}
		});

		this.addCommand({
			id: 'start-writing-session',
			name: 'Start Writing Session',
			callback: () => {
				this.startWritingSession();
			}
		});

		this.addCommand({
			id: 'end-writing-session',
			name: 'End Writing Session',
			callback: () => {
				this.endWritingSession();
			}
		});

		this.addSettingTab(new WritingMomentumSettingTab(this.app, this));

		this.registerEvent(
			this.app.workspace.on('file-open', (file) => {
				if (file && this.shouldTrackFile(file)) {
					this.startAutoSession(file);
				}
			})
		);

		this.registerInterval(
			window.setInterval(() => {
				this.updateStatusBar();
			}, 30000)
		);
	}

	async activateView() {
		const { workspace } = this.app;
		
		let leaf: WorkspaceLeaf;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_WRITING_DASHBOARD);

		if (leaves.length > 0) {
			leaf = leaves[0];
		} else {
			const rightLeaf = workspace.getRightLeaf(false);
			if (rightLeaf) {
				leaf = rightLeaf;
				await leaf.setViewState({ type: VIEW_TYPE_WRITING_DASHBOARD, active: true });
			} else {
				return;
			}
		}

		workspace.revealLeaf(leaf);
	}

	private shouldTrackFile(file: TFile): boolean {
		if (this.settings.trackingFolders.length === 0) {
			return true;
		}
		
		for (const folder of this.settings.excludeFolders) {
			if (file.path.startsWith(folder)) {
				return false;
			}
		}
		
		for (const folder of this.settings.trackingFolders) {
			if (file.path.startsWith(folder)) {
				return true;
			}
		}
		
		return this.settings.trackingFolders.length === 0;
	}

	private startAutoSession(file: TFile) {
		if (!this.currentSession) {
			this.startWritingSession([file.path]);
		}
	}

	private startWritingSession(files: string[] = []) {
		if (this.currentSession) {
			this.endWritingSession();
		}
		
		this.currentSession = {
			id: Date.now().toString(),
			start: Date.now(),
			wordCount: 0,
			files: files
		};
		
		new Notice('Writing session started!');
	}

	private endWritingSession() {
		if (!this.currentSession) {
			return;
		}
		
		this.currentSession.end = Date.now();
		this.currentSession.wordCount = this.calculateSessionWordCount();
		
		this.dataManager.addSession(this.currentSession);
		
		const duration = Math.round((this.currentSession.end - this.currentSession.start) / 60000);
		new Notice(`Session ended! Wrote ${this.currentSession.wordCount} words in ${duration} minutes.`);
		
		this.currentSession = null;
	}

	private calculateSessionWordCount(): number {
		let totalWords = 0;
		
		for (const filePath of this.currentSession?.files || []) {
			const file = this.app.vault.getAbstractFileByPath(filePath);
			if (file instanceof TFile) {
				this.app.vault.cachedRead(file).then(content => {
					totalWords += WordCounter.count(content, this.settings.countingMethod);
				});
			}
		}
		
		return totalWords;
	}

	private updateStatusBar() {
		if (!this.statusBarItem) return;
		
		const todaysCount = this.dataManager.getTodaysWordCount();
		const dailyGoal = this.settings.dailyWordGoal;
		const progress = Math.min((todaysCount / dailyGoal) * 100, 100);
		
		this.statusBarItem.setText(`${todaysCount}/${dailyGoal} words (${progress.toFixed(0)}%)`);
	}

	onunload() {
		if (this.currentSession) {
			this.endWritingSession();
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.updateStatusBar();
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

		new Setting(containerEl)
			.setName('Daily word goal')
			.setDesc('Target number of words to write each day')
			.addText(text => text
				.setPlaceholder('500')
				.setValue(this.plugin.settings.dailyWordGoal.toString())
				.onChange(async (value) => {
					this.plugin.settings.dailyWordGoal = parseInt(value) || 500;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Weekly word goal')
			.setDesc('Target number of words to write each week')
			.addText(text => text
				.setPlaceholder('3500')
				.setValue(this.plugin.settings.weeklyWordGoal.toString())
				.onChange(async (value) => {
					this.plugin.settings.weeklyWordGoal = parseInt(value) || 3500;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Monthly word goal')
			.setDesc('Target number of words to write each month')
			.addText(text => text
				.setPlaceholder('15000')
				.setValue(this.plugin.settings.monthlyWordGoal.toString())
				.onChange(async (value) => {
					this.plugin.settings.monthlyWordGoal = parseInt(value) || 15000;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Counting method')
			.setDesc('Choose whether to count words or characters')
			.addDropdown(dropdown => dropdown
				.addOption('words', 'Words')
				.addOption('characters', 'Characters')
				.setValue(this.plugin.settings.countingMethod)
				.onChange(async (value: 'words' | 'characters') => {
					this.plugin.settings.countingMethod = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Show status bar')
			.setDesc('Display writing progress in the status bar')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showStatusBar)
				.onChange(async (value) => {
					this.plugin.settings.showStatusBar = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Show ribbon icon')
			.setDesc('Display plugin icon in the left ribbon')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showRibbonIcon)
				.onChange(async (value) => {
					this.plugin.settings.showRibbonIcon = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Enable notifications')
			.setDesc('Show notifications for achievements and reminders')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.notifications)
				.onChange(async (value) => {
					this.plugin.settings.notifications = value;
					await this.plugin.saveSettings();
				}));
	}
}
