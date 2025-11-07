import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import obsidianPlugin from 'eslint-plugin-obsidianmd';

export default [
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		plugins: {
			'obsidianmd': obsidianPlugin,
		},
		languageOptions: {
			parser: tseslint.parser,
			parserOptions: {
				project: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			// Obsidian plugin-specific rules
			'obsidianmd/commands/no-command-in-command-id': 'error',
			'obsidianmd/commands/no-command-in-command-name': 'error',
			'obsidianmd/commands/no-default-hotkeys': 'error',
			'obsidianmd/commands/no-plugin-id-in-command-id': 'error',
			'obsidianmd/commands/no-plugin-name-in-command-name': 'error',
			'obsidianmd/settings-tab/no-manual-html-headings': 'error',
			'obsidianmd/settings-tab/no-problematic-settings-headings': 'error',
			'obsidianmd/vault/iterate': 'error',
			'obsidianmd/detach-leaves': 'error',
			'obsidianmd/hardcoded-config-path': 'error',
			'obsidianmd/no-forbidden-elements': 'error',
			'obsidianmd/no-plugin-as-component': 'error',
			'obsidianmd/no-sample-code': 'error',
			'obsidianmd/no-tfile-tfolder-cast': 'error',
			'obsidianmd/no-view-references-in-plugin': 'error',
			'obsidianmd/no-static-styles-assignment': 'error',
			'obsidianmd/object-assign': 'error',
			'obsidianmd/platform': 'error',
			'obsidianmd/prefer-file-manager-trash-file': 'warn',
			'obsidianmd/prefer-abstract-input-suggest': 'error',
			'obsidianmd/regex-lookbehind': 'error',
			'obsidianmd/sample-names': 'error',
			'obsidianmd/validate-manifest': 'error',
			'obsidianmd/validate-license': 'error',
			'obsidianmd/ui/sentence-case': ['error', { enforceCamelCaseLower: true }],

			// General rules
			'no-console': ['error', { allow: ['warn', 'error', 'debug'] }],
			'no-eval': 'error',
			'no-implied-eval': 'error',
			'no-alert': 'error',

			// TypeScript rules
			'@typescript-eslint/no-unused-vars': ['warn', { args: 'none' }],
			'@typescript-eslint/ban-ts-comment': 'off',
		},
	},
	{
		ignores: ['main.js', 'main-old.ts', 'node_modules/**', '*.config.mjs', 'version-bump.mjs'],
	}
];
