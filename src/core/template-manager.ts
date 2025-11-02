import { Notice } from 'obsidian';
import type { Template } from '../types/interfaces';
import type { IWritingMomentumPlugin } from '../types/plugin-interface';
import { DEFAULT_TEMPLATES } from '../types/interfaces';

export class TemplateManager {
  private plugin: IWritingMomentumPlugin;

  constructor(plugin: IWritingMomentumPlugin) {
    this.plugin = plugin;
  }

  /**
   * Get all templates (built-in + user-created)
   */
  getAllTemplates(): Template[] {
    return this.plugin.settings.templates || [];
  }

  /**
   * Get a specific template by ID
   */
  getTemplate(templateId: string): Template | null {
    return this.plugin.settings.templates.find(t => t.id === templateId) || null;
  }

  /**
   * Get the currently active template
   */
  getActiveTemplate(): Template | null {
    const activeId = this.plugin.settings.activeTemplateId;
    if (!activeId) {
      return this.getAllTemplates()[0] || null;
    }
    return this.getTemplate(activeId);
  }

  /**
   * Set the active template
   */
  async setActiveTemplate(templateId: string): Promise<void> {
    const template = this.getTemplate(templateId);
    if (!template) {
      new Notice('Template not found');
      return;
    }

    this.plugin.settings.activeTemplateId = templateId;

    // Update default title pattern and template content
    this.plugin.settings.defaultTitlePattern = template.titlePattern;
    this.plugin.settings.defaultTemplate = template.content;

    await this.plugin.saveSettings();
    new Notice(`Template "${template.name}" activated`);
  }

  /**
   * Create a new template
   */
  async createTemplate(
    name: string,
    titlePattern: string,
    content: string,
    options?: {
      category?: 'daily' | 'blog' | 'fiction' | 'custom';
      description?: string;
    }
  ): Promise<Template> {
    // Validate inputs
    if (!name || name.trim().length === 0) {
      throw new Error('Template name cannot be empty');
    }

    if (!titlePattern || titlePattern.trim().length === 0) {
      throw new Error('Title pattern cannot be empty');
    }

    if (!content || content.trim().length === 0) {
      throw new Error('Template content cannot be empty');
    }

    // Check for duplicate names
    const existingTemplate = this.plugin.settings.templates.find(
      t => t.name.toLowerCase() === name.toLowerCase()
    );
    if (existingTemplate) {
      throw new Error(`Template with name "${name}" already exists`);
    }

    // Generate unique ID
    const id = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const newTemplate: Template = {
      id,
      name: name.trim(),
      titlePattern: titlePattern.trim(),
      content: content.trim(),
      variables: this.extractVariables(content),
      category: options?.category || 'custom',
      description: options?.description,
      isBuiltIn: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.plugin.settings.templates.push(newTemplate);
    await this.plugin.saveSettings();

    new Notice(`Template "${name}" created successfully`);
    return newTemplate;
  }

  /**
   * Update an existing template
   */
  async updateTemplate(
    templateId: string,
    updates: {
      name?: string;
      titlePattern?: string;
      content?: string;
      category?: 'daily' | 'blog' | 'fiction' | 'custom';
      description?: string;
    }
  ): Promise<Template> {
    const templateIndex = this.plugin.settings.templates.findIndex(t => t.id === templateId);

    if (templateIndex === -1) {
      throw new Error('Template not found');
    }

    const template = this.plugin.settings.templates[templateIndex];

    // Don't allow editing built-in templates
    if (template.isBuiltIn) {
      throw new Error('Cannot modify built-in templates. Create a copy instead.');
    }

    // Validate name uniqueness if name is being changed
    if (updates.name && updates.name !== template.name) {
      const existingTemplate = this.plugin.settings.templates.find(
        t => t.id !== templateId && t.name.toLowerCase() === updates.name!.toLowerCase()
      );
      if (existingTemplate) {
        throw new Error(`Template with name "${updates.name}" already exists`);
      }
    }

    // Apply updates
    const updatedTemplate: Template = {
      ...template,
      ...(updates.name && { name: updates.name.trim() }),
      ...(updates.titlePattern && { titlePattern: updates.titlePattern.trim() }),
      ...(updates.content && { content: updates.content.trim() }),
      ...(updates.category && { category: updates.category }),
      ...(updates.description !== undefined && { description: updates.description }),
      updatedAt: Date.now()
    };

    // Re-extract variables if content changed
    if (updates.content) {
      updatedTemplate.variables = this.extractVariables(updates.content);
    }

    this.plugin.settings.templates[templateIndex] = updatedTemplate;

    // If this is the active template, update the defaults
    if (this.plugin.settings.activeTemplateId === templateId) {
      this.plugin.settings.defaultTitlePattern = updatedTemplate.titlePattern;
      this.plugin.settings.defaultTemplate = updatedTemplate.content;
    }

    await this.plugin.saveSettings();
    new Notice(`Template "${updatedTemplate.name}" updated`);

    return updatedTemplate;
  }

  /**
   * Rename a template
   */
  async renameTemplate(templateId: string, newName: string): Promise<void> {
    if (!newName || newName.trim().length === 0) {
      throw new Error('Template name cannot be empty');
    }

    await this.updateTemplate(templateId, { name: newName });
  }

  /**
   * Delete a template
   */
  async deleteTemplate(templateId: string): Promise<void> {
    const templateIndex = this.plugin.settings.templates.findIndex(t => t.id === templateId);

    if (templateIndex === -1) {
      throw new Error('Template not found');
    }

    const template = this.plugin.settings.templates[templateIndex];

    // Don't allow deleting built-in templates
    if (template.isBuiltIn) {
      throw new Error('Cannot delete built-in templates');
    }

    // If this is the active template, switch to first available template
    if (this.plugin.settings.activeTemplateId === templateId) {
      const remainingTemplates = this.plugin.settings.templates.filter(t => t.id !== templateId);
      if (remainingTemplates.length > 0) {
        await this.setActiveTemplate(remainingTemplates[0].id);
      } else {
        this.plugin.settings.activeTemplateId = undefined;
      }
    }

    this.plugin.settings.templates.splice(templateIndex, 1);
    await this.plugin.saveSettings();

    new Notice(`Template "${template.name}" deleted`);
  }

  /**
   * Duplicate a template (useful for customizing built-in templates)
   */
  async duplicateTemplate(templateId: string, newName?: string): Promise<Template> {
    const template = this.getTemplate(templateId);

    if (!template) {
      throw new Error('Template not found');
    }

    const baseName = newName || `${template.name} (Copy)`;
    let finalName = baseName;
    let counter = 1;

    // Ensure unique name
    while (this.plugin.settings.templates.some(t => t.name === finalName)) {
      finalName = `${baseName} ${counter}`;
      counter++;
    }

    return await this.createTemplate(
      finalName,
      template.titlePattern,
      template.content,
      {
        category: template.category,
        description: template.description
      }
    );
  }

  /**
   * Reset templates to defaults (restore built-in templates)
   */
  async resetToDefaults(): Promise<void> {
    // Keep user-created templates, restore built-in ones
    const userTemplates = this.plugin.settings.templates.filter(t => !t.isBuiltIn);
    this.plugin.settings.templates = [...DEFAULT_TEMPLATES, ...userTemplates];

    await this.plugin.saveSettings();
    new Notice('Built-in templates restored to defaults');
  }

  /**
   * Extract template variables from content
   */
  private extractVariables(content: string): string[] {
    const variableRegex = /\{\{([^}]+)\}\}/g;
    const variables: Set<string> = new Set();
    let match;

    while ((match = variableRegex.exec(content)) !== null) {
      variables.add(match[1].trim());
    }

    return Array.from(variables);
  }

  /**
   * Get user-created templates only
   */
  getUserTemplates(): Template[] {
    return this.plugin.settings.templates.filter(t => !t.isBuiltIn);
  }

  /**
   * Get built-in templates only
   */
  getBuiltInTemplates(): Template[] {
    return this.plugin.settings.templates.filter(t => t.isBuiltIn);
  }

  /**
   * Validate template content
   */
  validateTemplate(titlePattern: string, content: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!titlePattern || titlePattern.trim().length === 0) {
      errors.push('Title pattern cannot be empty');
    }

    if (!content || content.trim().length === 0) {
      errors.push('Template content cannot be empty');
    }

    // Check for balanced braces
    const openBraces = (content.match(/\{\{/g) || []).length;
    const closeBraces = (content.match(/\}\}/g) || []).length;

    if (openBraces !== closeBraces) {
      errors.push('Unbalanced template variables ({{ }})');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Export templates as JSON
   */
  exportTemplates(): string {
    const userTemplates = this.getUserTemplates();
    return JSON.stringify(userTemplates, null, 2);
  }

  /**
   * Import templates from JSON
   */
  async importTemplates(jsonString: string): Promise<number> {
    try {
      const templates = JSON.parse(jsonString) as Template[];

      if (!Array.isArray(templates)) {
        throw new Error('Invalid template data format');
      }

      let importedCount = 0;

      for (const template of templates) {
        // Validate template structure
        if (!template.name || !template.titlePattern || !template.content) {
          console.warn('Skipping invalid template:', template);
          continue;
        }

        // Check for duplicate names and rename if necessary
        let finalName = template.name;
        let counter = 1;
        while (this.plugin.settings.templates.some(t => t.name === finalName)) {
          finalName = `${template.name} (${counter})`;
          counter++;
        }

        // Create new template
        await this.createTemplate(
          finalName,
          template.titlePattern,
          template.content,
          {
            category: template.category,
            description: template.description
          }
        );

        importedCount++;
      }

      new Notice(`Imported ${importedCount} template(s)`);
      return importedCount;
    } catch (error) {
      throw new Error(`Failed to import templates: ${error.message}`);
    }
  }
}
