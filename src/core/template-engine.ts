import { TFile, TFolder } from 'obsidian';
import type { Template, TemplateVariable, PromptSource } from '../types/interfaces';
import type WritingMomentumPlugin from '../../main';

export class TemplateEngine {
  private plugin: WritingMomentumPlugin;
  private templates: Map<string, Template> = new Map();
  private prompts: string[] = [];

  constructor(plugin: WritingMomentumPlugin) {
    this.plugin = plugin;
  }

  async initialize() {
    await this.loadTemplates();
    await this.loadPrompts();
  }

  private async loadTemplates() {
    const templatePath = this.plugin.settings.paths.templates;
    const templateFolder = this.plugin.app.vault.getAbstractFileByPath(templatePath);
    
    if (!(templateFolder instanceof TFolder)) {
      await this.createDefaultTemplates();
      return;
    }

    const templateFiles = templateFolder.children.filter(child => 
      child instanceof TFile && child.extension === 'md'
    ) as TFile[];

    for (const file of templateFiles) {
      try {
        const content = await this.plugin.app.vault.read(file);
        const template = this.parseTemplate(file, content);
        this.templates.set(template.id, template);
      } catch (error) {
        console.error(`Failed to load template ${file.path}:`, error);
      }
    }
  }

  private parseTemplate(file: TFile, content: string): Template {
    const frontmatter = this.extractFrontmatter(content);
    const templateContent = content.replace(/^---[\s\S]*?---\n/, '');
    
    const variables = this.extractVariables(templateContent);
    
    return {
      id: file.basename,
      name: frontmatter.name || file.basename,
      content: templateContent,
      variables,
      category: frontmatter.category || 'custom',
      description: frontmatter.description,
      filePaths: frontmatter.filePaths
    };
  }

  private extractFrontmatter(content: string): any {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) return {};

    const frontmatterLines = frontmatterMatch[1].split('\n');
    const frontmatter: any = {};

    for (const line of frontmatterLines) {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length > 0) {
        frontmatter[key.trim()] = valueParts.join(':').trim();
      }
    }

    return frontmatter;
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

  private async createDefaultTemplates() {
    const templatePath = this.plugin.settings.paths.templates;
    await this.plugin.app.vault.createFolder(templatePath).catch(() => {});

    const defaultTemplates = [
      {
        filename: 'daily-3lines.md',
        content: `---
name: Daily 3 Lines
category: daily
description: Simple 3-line daily journal
filePaths:
  pattern: "{{date}} Daily.md"
  folder: "Journal"
---
{{random_prompt}}

- Line 1
- Line 2  
- Line 3`
      },
      {
        filename: 'blog-outline.md',
        content: `---
name: Blog Outline
category: blog
description: Blog post structure template
filePaths:
  pattern: "Blog-{{date}}-{{slug}}.md"
  folder: "Blog"
---
# {{title}}

## Introduction
{{random_prompt}}

## Body
- Key Idea 1
- Key Idea 2

## Conclusion
- Summary & Next action`
      },
      {
        filename: 'fiction-scene.md',
        content: `---
name: Fiction Scene
category: fiction
description: Fiction writing scene template
filePaths:
  pattern: "Scene-{{date}}.md"
  folder: "Writing/Scenes"
---
## Scene Goal
{{random_prompt}}

## Characters
- Protagonist:
- Other:

## Conflict/Turn
- Obstacle:
- Twist:

## Closing Image`
      }
    ];

    for (const template of defaultTemplates) {
      const filePath = `${templatePath}/${template.filename}`;
      try {
        await this.plugin.app.vault.create(filePath, template.content);
      } catch (error) {
        // File might already exist, ignore
      }
    }

    await this.loadTemplates();
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

  async createNoteFromTemplate(templateId: string, customVariables?: Record<string, string>) {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template '${templateId}' not found`);
    }

    const variables = this.buildVariables(customVariables);
    const processedContent = this.processTemplate(template.content, variables);
    const fileName = this.generateFileName(template, variables);
    const folderPath = template.filePaths?.folder || '';

    if (folderPath) {
      await this.plugin.app.vault.createFolder(folderPath).catch(() => {});
    }

    const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;
    
    try {
      const file = await this.plugin.app.vault.create(filePath, processedContent);
      
      // Open the created file
      const leaf = this.plugin.app.workspace.getLeaf();
      await leaf.openFile(file);
      
      // Start a writing session
      this.plugin.sessionManager.startSession(file.path, templateId);
      
      return file;
    } catch (error) {
      if (error.message.includes('already exists')) {
        // File exists, open it instead
        const existingFile = this.plugin.app.vault.getAbstractFileByPath(filePath) as TFile;
        const leaf = this.plugin.app.workspace.getLeaf();
        await leaf.openFile(existingFile);
        return existingFile;
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

  private generateFileName(template: Template, variables: TemplateVariable[]): string {
    if (!template.filePaths?.pattern) {
      const date = variables.find(v => v.name === 'date')?.value || 'untitled';
      return `${date}-${template.id}.md`;
    }

    let fileName = template.filePaths.pattern;
    for (const variable of variables) {
      const value = typeof variable.value === 'function' ? variable.value() : variable.value;
      const regex = new RegExp(`\\{\\{\\s*${variable.name}\\s*\\}\\}`, 'g');
      fileName = fileName.replace(regex, value);
    }

    return fileName;
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

  private getRandomPrompt(): string {
    if (this.prompts.length === 0) {
      return "What's on your mind today?";
    }
    
    const randomIndex = Math.floor(Math.random() * this.prompts.length);
    return this.prompts[randomIndex];
  }

  getTemplate(id: string): Template | undefined {
    return this.templates.get(id);
  }

  getAllTemplates(): Template[] {
    return Array.from(this.templates.values());
  }

  async reloadTemplates() {
    this.templates.clear();
    await this.loadTemplates();
  }

  async reloadPrompts() {
    await this.loadPrompts();
  }
}