import { TFile, TFolder } from 'obsidian';
import type { Template, TemplateVariable, PromptSource } from '../types/interfaces';
import type { IWritingMomentumPlugin } from '../types/plugin-interface';

export class TemplateEngine {
  private plugin: IWritingMomentumPlugin;
  private prompts: string[] = [];

  constructor(plugin: IWritingMomentumPlugin) {
    this.plugin = plugin;
  }

  async initialize() {
    await this.loadPrompts();
  }

  private extractVariables(content: string): string[] {
    const variableRegex = /\{\{([^}]+)\}\}/g;
    const variables: Set<string> = new Set();
    let match;

    while ((match = variableRegex.exec(content)) !== null) {
      variables.add(match[1].trim());
    }

    return Array.from(variables);
  }

  private async loadPrompts() {
    const promptPath = this.plugin.settings.paths.prompts;
    const promptFile = this.plugin.app.vault.getAbstractFileByPath(promptPath);
    
    if (!(promptFile instanceof TFile)) {
      await this.createDefaultPrompts();
      return;
    }

    try {
      const content = await this.plugin.app.vault.read(promptFile);
      this.prompts = this.parsePrompts(content);
    } catch (error) {
      console.error('Failed to load prompts:', error);
      await this.createDefaultPrompts();
    }
  }

  private parsePrompts(content: string): string[] {
    const lines = content.split('\n');
    const prompts: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        prompts.push(trimmed.substring(2));
      } else if (trimmed && !trimmed.startsWith('#')) {
        prompts.push(trimmed);
      }
    }

    return prompts.filter(p => p.length > 0);
  }

  private async createDefaultPrompts() {
    const promptPath = this.plugin.settings.paths.prompts;
    const defaultPrompts = `# Writing Prompts

- What was the most meaningful moment today?
- What did I learn today?
- Express your current feeling in one word.
- What am I grateful for right now?
- What challenge did I overcome today?
- What would I tell my past self?
- What's one thing I want to remember about today?
- How did I grow today?
- What made me smile today?
- What am I looking forward to tomorrow?
- Describe today in exactly three words.
- What surprised me today?
- What would I change about today?
- What small victory can I celebrate?
- What's one thing I did well today?`;

    try {
      await this.plugin.app.vault.create(promptPath, defaultPrompts);
      await this.loadPrompts();
    } catch (error) {
      console.error('Failed to create default prompts:', error);
    }
  }

  async createNoteFromTemplate(customVariables?: Record<string, string>) {
    const variables = this.buildVariables(customVariables);
    const processedTitle = this.processTemplate(this.plugin.settings.defaultTitlePattern, variables);
    const processedContent = this.processTemplate(this.plugin.settings.defaultTemplate, variables);

    // Replace title variable in content if it exists
    const titleVariable = { name: 'title', value: processedTitle };
    const finalContent = this.processTemplate(processedContent, [titleVariable]);

    const fileName = `${processedTitle}.md`;

    try {
      const file = await this.plugin.app.vault.create(fileName, finalContent);

      // Open the created file
      const leaf = this.plugin.app.workspace.getLeaf();
      await leaf.openFile(file);

      // Start a writing session
      this.plugin.sessionManager.startSession(file.path, 'default');

      return file;
    } catch (error) {
      if (error.message.includes('already exists')) {
        // File exists, open it instead
        const existingFile = this.plugin.app.vault.getAbstractFileByPath(fileName);
        if (existingFile instanceof TFile) {
          const leaf = this.plugin.app.workspace.getLeaf();
          await leaf.openFile(existingFile);
          return existingFile;
        }
        throw new Error('File exists but is not a valid file');
      }
      throw error;
    }
  }

  private buildVariables(customVariables?: Record<string, string>): TemplateVariable[] {
    const now = new Date();
    const baseVariables: TemplateVariable[] = [
      {
        name: 'date',
        value: this.formatDate(now)
      },
      {
        name: 'time',
        value: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      },
      {
        name: 'weekday',
        value: now.toLocaleDateString('en-US', { weekday: 'long' })
      },
      {
        name: 'vault',
        value: this.plugin.app.vault.getName()
      },
      {
        name: 'random_prompt',
        value: () => this.getRandomPrompt()
      }
    ];

    if (customVariables) {
      for (const [key, value] of Object.entries(customVariables)) {
        baseVariables.push({ name: key, value });
      }
    }

    return baseVariables;
  }

  private processTemplate(content: string, variables: TemplateVariable[]): string {
    let processed = content;

    for (const variable of variables) {
      const value = typeof variable.value === 'function' ? variable.value() : variable.value;
      const regex = new RegExp(`\\{\\{\\s*${variable.name}\\s*\\}\\}`, 'g');
      processed = processed.replace(regex, value);
    }

    return processed;
  }


  private formatDate(date: Date): string {
    const format = this.plugin.settings.dateFormat;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return format
      .replace('YYYY', year.toString())
      .replace('MM', month)
      .replace('DD', day);
  }

  getRandomPrompt(): string {
    // Try to use random prompts if enabled
    if (this.plugin.settings.randomPrompts?.enabled && this.plugin.randomPrompts) {
      const randomPrompt = this.plugin.randomPrompts.getRandomNetworkPrompt();

      if (randomPrompt) {
        // If mixing with local prompts, randomly choose between random and local
        if (this.plugin.settings.randomPrompts.mixWithLocal) {
          const allPrompts = [...this.prompts];
          if (allPrompts.length > 0) {
            // 50% chance to use random prompt, 50% for local prompts
            if (Math.random() < 0.5) {
              return randomPrompt;
            } else {
              const randomIndex = Math.floor(Math.random() * allPrompts.length);
              return allPrompts[randomIndex];
            }
          }
        }
        return randomPrompt;
      }
    }

    // Fallback to local prompts
    if (this.prompts.length === 0) {
      return "What's on your mind today?";
    }

    const randomIndex = Math.floor(Math.random() * this.prompts.length);
    return this.prompts[randomIndex];
  }

  getDefaultTemplate(): { title: string; content: string } {
    return {
      title: this.plugin.settings.defaultTitlePattern,
      content: this.plugin.settings.defaultTemplate
    };
  }

  async reloadPrompts() {
    await this.loadPrompts();
  }
}