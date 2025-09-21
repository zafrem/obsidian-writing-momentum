import { App, Plugin } from 'obsidian';
import type { WritingMomentumSettings } from './interfaces';

export interface IWritingMomentumPlugin extends Plugin {
	app: App;
	settings: WritingMomentumSettings;
	dataManager: any;
	templateEngine: any;
	sessionManager: any;
	reminderScheduler: any;
	randomPrompts: any;
	statusBarItem: HTMLElement | null;
	manifest: any;

	loadData(): Promise<any>;
	saveData(data: any): Promise<void>;
	saveSettings(): Promise<void>;
	createQuickNote(): Promise<void>;
}