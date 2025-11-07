import { App, Plugin, PluginManifest, TFile } from 'obsidian';
import type { WritingMomentumSettings, WritingSession, DashboardStats, SessionLog, WritingProfile, Template } from './interfaces';
import type { PurposeSessionManager } from '../core/purpose-session-manager';

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
	getSessionStats(): { duration: number; wordCount: number; wpm: number; targetProgress: number | null } | null;
	startSession(filePath: string, template?: string, targetWordCount?: number): void;
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

export interface ITemplateManager {
	getAllTemplates(): Template[];
	getTemplate(templateId: string): Template | null;
	getActiveTemplate(): Template | null;
	setActiveTemplate(templateId: string): Promise<void>;
	createTemplate(name: string, titlePattern: string, content: string, options?: Partial<Template>): Promise<Template>;
	updateTemplate(templateId: string, updates: Partial<Template>): Promise<Template>;
	renameTemplate(templateId: string, newName: string): Promise<void>;
	deleteTemplate(templateId: string): Promise<void>;
	duplicateTemplate(templateId: string, newName?: string): Promise<Template>;
	validateTemplate(titlePattern: string, content: string): { valid: boolean; errors: string[] };
	exportTemplates(): string;
	importTemplates(jsonString: string): Promise<number>;
	getUserTemplates(): Template[];
	getBuiltInTemplates(): Template[];
}

export interface IWritingMomentumPlugin extends Plugin {
	app: App;
	settings: WritingMomentumSettings;
	dataManager: IDataManager;
	templateEngine: ITemplateEngine;
	sessionManager: ISessionManager;
	reminderScheduler: IReminderScheduler;
	randomPrompts: IRandomPrompts;
	templateManager: ITemplateManager;
	statusBarItem: HTMLElement | null;
	manifest: PluginManifest;
	isMobile: boolean;

	// Purpose-based system
	activeProfile: WritingProfile | null;
	sessionLogs: SessionLog[];
	purposeSessionManager: PurposeSessionManager | null;

	loadData(): Promise<Record<string, unknown>>;
	saveData(data: Record<string, unknown>): Promise<void>;
	saveSettings(): Promise<void>;
	savePurposeData(): Promise<void>;
	createQuickNote(): Promise<void>;
}