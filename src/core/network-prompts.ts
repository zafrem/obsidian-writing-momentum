import type { IWritingMomentumPlugin } from '../types/plugin-interface';
import { TFile } from 'obsidian';

interface PromptSource {
  name: string;
  url: string;
  selector: string;
  transform?: (text: string) => string | string[];
}

export class NetworkPromptsService {
  private plugin: IWritingMomentumPlugin;
  private cachedPrompts: string[] = [];
  private lastFetchTime: number = 0;
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  private readonly CACHE_FILE = '.writing-momentum/network-prompts.json';

  private promptSources: PromptSource[] = [
    {
      name: 'Writing Prompts Reddit',
      url: 'https://www.reddit.com/r/WritingPrompts/hot.json?limit=50',
      selector: 'json',
      transform: (jsonText: string) => {
        try {
          const data = JSON.parse(jsonText);
          const prompts: string[] = [];

          if (data.data && data.data.children) {
            for (const post of data.data.children) {
              if (post.data && post.data.title) {
                let title = post.data.title;
                // Remove [WP] or similar tags
                title = title.replace(/^\[.*?\]\s*/, '');
                // Clean up and format
                title = title.trim();
                if (title.length > 20 && title.length < 200) {
                  prompts.push(title);
                }
              }
            }
          }
          return prompts;
        } catch (error) {
          console.error('Error parsing Reddit JSON:', error);
          return [];
        }
      }
    }
  ];

  constructor(plugin: IWritingMomentumPlugin) {
    this.plugin = plugin;
    this.loadCachedPrompts();
  }

  private async loadCachedPrompts() {
    try {
      const cacheFile = this.plugin.app.vault.getAbstractFileByPath(this.CACHE_FILE);
      if (cacheFile instanceof TFile) {
        const content = await this.plugin.app.vault.read(cacheFile);
        const cacheData = JSON.parse(content);

        if (cacheData.prompts && Array.isArray(cacheData.prompts)) {
          this.cachedPrompts = cacheData.prompts;
          this.lastFetchTime = cacheData.timestamp || 0;
        }
      }
    } catch (error) {
      console.log('No cached prompts found or error loading cache:', error);
    }
  }

  private async saveCachedPrompts() {
    try {
      const cacheData = {
        prompts: this.cachedPrompts,
        timestamp: this.lastFetchTime
      };

      const cacheDir = '.writing-momentum';
      const dirExists = await this.plugin.app.vault.adapter.exists(cacheDir);
      if (!dirExists) {
        await this.plugin.app.vault.createFolder(cacheDir);
      }

      const existingFile = this.plugin.app.vault.getAbstractFileByPath(this.CACHE_FILE);
      if (existingFile instanceof TFile) {
        await this.plugin.app.vault.modify(existingFile, JSON.stringify(cacheData, null, 2));
      } else {
        await this.plugin.app.vault.create(this.CACHE_FILE, JSON.stringify(cacheData, null, 2));
      }
    } catch (error) {
      console.error('Error saving cached prompts:', error);
    }
  }

  async fetchNetworkPrompts(): Promise<string[]> {
    const now = Date.now();

    // Return cached prompts if they're still fresh
    if (this.cachedPrompts.length > 0 && (now - this.lastFetchTime) < this.CACHE_DURATION) {
      return this.cachedPrompts;
    }

    try {
      const allPrompts: string[] = [];

      for (const source of this.promptSources) {
        try {
          const prompts = await this.fetchFromSource(source);
          allPrompts.push(...prompts);
        } catch (error) {
          console.error(`Error fetching from ${source.name}:`, error);
        }
      }

      if (allPrompts.length > 0) {
        // Remove duplicates and filter
        const uniquePrompts = [...new Set(allPrompts)]
          .filter(prompt => prompt.length > 10 && prompt.length < 300)
          .slice(0, 100); // Limit to 100 prompts

        this.cachedPrompts = uniquePrompts;
        this.lastFetchTime = now;
        await this.saveCachedPrompts();
      }

      return this.cachedPrompts;
    } catch (error) {
      console.error('Error fetching network prompts:', error);
      return this.cachedPrompts; // Return cached prompts as fallback
    }
  }

  private async fetchFromSource(source: PromptSource): Promise<string[]> {
    try {
      const response = await fetch(source.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const text = await response.text();

      if (source.transform) {
        const result = source.transform(text);
        return Array.isArray(result) ? result : [];
      }

      // Default text processing for HTML sources
      return this.extractPromptsFromHTML(text, source.selector);
    } catch (error) {
      console.error(`Error fetching from ${source.name}:`, error);
      return [];
    }
  }

  private extractPromptsFromHTML(html: string, selector: string): string[] {
    // Simple HTML parsing for prompts
    const prompts: string[] = [];

    try {
      // Create a temporary DOM element to parse HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const elements = doc.querySelectorAll(selector);
      elements.forEach(element => {
        const text = element.textContent?.trim();
        if (text && text.length > 10 && text.length < 300) {
          prompts.push(text);
        }
      });
    } catch (error) {
      console.error('Error parsing HTML:', error);
    }

    return prompts;
  }

  getRandomNetworkPrompt(): string | null {
    if (this.cachedPrompts.length === 0) {
      return null;
    }

    const randomIndex = Math.floor(Math.random() * this.cachedPrompts.length);
    return this.cachedPrompts[randomIndex];
  }

  async refreshPrompts(): Promise<boolean> {
    this.lastFetchTime = 0; // Force refresh
    const prompts = await this.fetchNetworkPrompts();
    return prompts.length > 0;
  }

  getCachedPromptsCount(): number {
    return this.cachedPrompts.length;
  }

  getLastFetchTime(): Date | null {
    return this.lastFetchTime > 0 ? new Date(this.lastFetchTime) : null;
  }
}