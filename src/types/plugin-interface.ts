import { App, Plugin, PluginManifest, TFile } from 'obsidian';
import type { WritingMomentumSettings } from './interfaces';

// Define proper interfaces for the various managers
export interface IDataManager {
	getDashboardStats(): any; // This would need more specific typing based on actual implementation
	exportData(): any;
	importData(data: Record<string, any>): Promise<void>;
	addSession(session: any): Promise<void>;
	getTodaysSessions(): any[];
	getTodaysWordCount(): number;
	loadData(): Promise<void>;
	saveData(): Promise<void>;
}

export interface ITemplateEngine {
	createNoteFromTemplate(customVariables?: Record<string, string>): Promise<TFile>;
	initialize(): Promise<void>;
}

export interface ISessionManager {
	getCurrentSession(): any; // This would need more specific typing
	getSessionStats(): any;
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

	loadData(): Promise<Record<string, any>>;
	saveData(data: Record<string, any>): Promise<void>;
	saveSettings(): Promise<void>;
	createQuickNote(): Promise<void>;
}