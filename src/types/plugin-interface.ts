import { App, Plugin, PluginManifest, TFile } from 'obsidian';
import type { WritingMomentumSettings, WritingSession, DashboardStats } from './interfaces';

// Define proper interfaces for the various managers
export interface IDataManager {
	getDashboardStats(): DashboardStats;
	exportData(): Record<string, unknown>;
	importData(data: Record<string, unknown>): Promise<void>;
	addSession(session: WritingSession): Promise<void>;
	getTodaysSessions(): WritingSession[];
	getTodaysWordCount(): number;
	loadData(): Promise<void>;
	saveData(): Promise<void>;
}

export interface ITemplateEngine {
	createNoteFromTemplate(customVariables?: Record<string, string>): Promise<TFile>;
	initialize(): Promise<void>;
}

export interface ISessionManager {
	getCurrentSession(): WritingSession | null;
	getSessionStats(): DashboardStats;
	startSession(filePath: string, template: string): void;
	completeSession(): void;
	endSession(): void;
}

export interface IReminderScheduler {
	start(): void;
	stop(): void;
	snoozeReminder(reminderId: string, minutes: number): void;
	reschedule(): void;
}

export interface IRandomPrompts {
	fetchNetworkPrompts(): Promise<string[]>;
	getRandomNetworkPrompt(): string | null;
	refreshPrompts(): Promise<boolean>;
	getCachedPromptsCount(): number;
	getLastFetchTime(): Date | null;
}

export interface IWritingMomentumPlugin extends Plugin {
	app: App;
	settings: WritingMomentumSettings;
	dataManager: IDataManager;
	templateEngine: ITemplateEngine;
	sessionManager: ISessionManager;
	reminderScheduler: IReminderScheduler;
	randomPrompts: IRandomPrompts;
	statusBarItem: HTMLElement | null;
	manifest: PluginManifest;

	loadData(): Promise<Record<string, unknown>>;
	saveData(data: Record<string, unknown>): Promise<void>;
	saveSettings(): Promise<void>;
	createQuickNote(): Promise<void>;
}