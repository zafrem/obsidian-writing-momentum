# Writing Momentum Plugin API Documentation

This document describes the internal API structure and extension points for the Writing Momentum plugin.

## Plugin Architecture

### Core Modules

#### `WritingMomentumPlugin` (Main Plugin Class)

**Location**: `main.ts`

The main plugin class that orchestrates all functionality.

```typescript
class WritingMomentumPlugin extends Plugin {
  settings: WritingMomentumSettings;
  dataManager: DataManager;
  templateEngine: TemplateEngine;
  sessionManager: SessionManager;
  reminderScheduler: ReminderScheduler;
  statusBarItem: HTMLElement | null;
}
```

**Key Methods**:
- `onload()`: Initialize all core systems
- `activateView()`: Open writing dashboard
- `showTemplateSelector()`: Display template selection interface
- `createQuickNote()`: Create note with random prompt
- `insertRandomPrompt()`: Insert prompt at cursor position

#### `DataManager`

**Location**: `src/core/data-manager.ts`

Handles all data persistence and retrieval operations.

```typescript
class DataManager {
  async loadData(): Promise<void>
  async saveData(): Promise<void>
  async addSession(session: WritingSession): Promise<void>
  getTodaysSessions(): WritingSession[]
  getTodaysWordCount(): number
  getWeekWordCount(): number
  getMonthWordCount(): number
  getDashboardStats(): DashboardStats
  exportData(): ExportData
}
```

**Data Structures**:
```typescript
interface WritingSession {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: number;
  endTime?: number;
  wordCount: number;
  targetCount?: number;
  templateUsed?: string;
  files: string[];
  completed: boolean;
}

interface StreakData {
  current: number;
  longest: number;
  lastWritingDay: string;
  graceUsed: number;
  weeklyProgress: number[];
}
```

#### `TemplateEngine`

**Location**: `src/core/template-engine.ts`

Processes templates and handles variable substitution.

```typescript
class TemplateEngine {
  async initialize(): Promise<void>
  async createNoteFromTemplate(templateId: string, customVariables?: Record<string, string>): Promise<TFile>
  getTemplate(id: string): Template | undefined
  getAllTemplates(): Template[]
  async reloadTemplates(): Promise<void>
}
```

**Template Structure**:
```typescript
interface Template {
  id: string;
  name: string;
  content: string;
  variables: string[];
  category: 'daily' | 'blog' | 'fiction' | 'custom';
  description?: string;
  filePaths?: FilePathRule;
}

interface FilePathRule {
  pattern: string; // e.g., "{{date}} Daily.md"
  folder: string;  // target folder
}
```

**Available Variables**:
- `{{date}}`: Current date (YYYY-MM-DD format)
- `{{time}}`: Current time (12-hour format)
- `{{weekday}}`: Full weekday name
- `{{vault}}`: Vault name
- `{{random_prompt}}`: Random writing prompt

#### `SessionManager`

**Location**: `src/core/session-manager.ts`

Manages writing sessions and real-time tracking.

```typescript
class SessionManager {
  startSession(filePath: string, templateId?: string, targetWordCount?: number): void
  completeSession(): void
  endSession(): void
  getCurrentSession(): WritingSession | null
  getSessionStats(): SessionStats | null
  handleFileOpen(file: TFile): void
}
```

**Session Statistics**:
```typescript
interface SessionStats {
  duration: number; // minutes
  wordCount: number;
  wpm: number;
  targetProgress: number | null; // percentage
}
```

#### `ReminderScheduler`

**Location**: `src/core/scheduler.ts`

Handles reminder scheduling and notifications.

```typescript
class ReminderScheduler {
  start(): void
  stop(): void
  snoozeReminder(reminderId: string, minutes: number): void
  reschedule(): void
}
```

**Reminder Configuration**:
```typescript
interface ReminderConfig {
  id: string;
  days: number[]; // 0=Sunday, 1=Monday, etc.
  time: string; // "21:00" format
  secondShotMins?: number;
  templateId?: string;
  dnd?: {
    start: string; // "23:30"
    end: string;   // "07:30"
  };
  enabled: boolean;
}
```

#### `WritingDashboard`

**Location**: `src/ui/dashboard.ts`

Dashboard UI component with statistics and controls.

```typescript
class WritingDashboard extends ItemView {
  render(): void
  refresh(): void
  private renderCurrentSession(container: Element): void
  private renderTodayStats(container: Element): void
  private renderStreak(container: Element): void
}
```

## Extension Points

### Custom Templates

Create templates in `.writing-momentum/templates/` with frontmatter:

```yaml
---
name: Custom Template Name
category: custom
description: Template description
filePaths:
  pattern: "{{date}} - Custom.md"
  folder: "CustomFolder"
---
Template content with {{variables}}
```

### Custom Variables

Extend the template engine with custom variables:

```typescript
// In your plugin extension
plugin.templateEngine.addCustomVariable('myvar', () => 'my value');
```

### Custom Prompts

Add prompts to `.writing-momentum/prompts.md`:

```markdown
# Writing Prompts

- Your custom prompt here
- Another custom prompt
- Category-specific prompts
```

### Event Hooks

The plugin emits custom events you can listen to:

```typescript
// Session events
this.app.workspace.trigger('writing-momentum:session-started', session);
this.app.workspace.trigger('writing-momentum:session-completed', session);
this.app.workspace.trigger('writing-momentum:streak-updated', streakData);

// Reminder events  
this.app.workspace.trigger('writing-momentum:reminder-triggered', reminder);
this.app.workspace.trigger('writing-momentum:reminder-snoozed', reminder);
```

### CSS Customization

Override default styles by targeting these classes:

```css
/* Dashboard container */
.writing-momentum-dashboard {
  /* Your styles */
}

/* Streak cards */
.streak-card {
  /* Custom streak styling */
}

/* Session statistics */
.session-stats-grid {
  /* Grid layout customization */
}

/* Action buttons */
.action-btn {
  /* Button styling */
}
```

## Data Format

### Settings Storage

```json
{
  "reminders": [
    {
      "id": "evening-default",
      "days": [1,2,3,4,5,6,0],
      "time": "21:00",
      "secondShotMins": 30,
      "templateId": "daily-3lines",
      "dnd": {
        "start": "23:30",
        "end": "07:30"
      },
      "enabled": true
    }
  ],
  "streakRule": {
    "mode": "weekly",
    "target": 5,
    "grace": 1
  },
  "locale": "en",
  "dateFormat": "YYYY-MM-DD",
  "paths": {
    "templates": ".writing-momentum/templates",
    "prompts": ".writing-momentum/prompts.md"
  },
  "ui": {
    "showStatusBar": true,
    "showRibbonIcon": true,
    "notifications": true
  }
}
```

### Session Data

```json
{
  "writingData": {
    "sessions": [
      {
        "id": "session-1705123456789",
        "date": "2025-01-15",
        "startTime": 1705123456789,
        "endTime": 1705124456789,
        "wordCount": 287,
        "targetCount": 250,
        "templateUsed": "daily-3lines",
        "files": ["2025-01-15 Daily.md"],
        "completed": true
      }
    ],
    "streak": {
      "current": 12,
      "longest": 18,
      "lastWritingDay": "2025-01-15",
      "graceUsed": 0,
      "weeklyProgress": [1, 1, 0, 1, 1, 1, 1]
    },
    "lastUpdated": "2025-01-15T21:30:00.000Z"
  }
}
```

## Command Registration

The plugin registers these commands with Obsidian:

```typescript
// Command IDs and their handlers
{
  'writing-momentum:open-dashboard': () => this.activateView(),
  'writing-momentum:new-from-template': () => this.showTemplateSelector(),
  'writing-momentum:quick-note': () => this.createQuickNote(),
  'writing-momentum:complete-session': () => this.sessionManager.completeSession(),
  'writing-momentum:insert-random-prompt': () => this.insertRandomPrompt(),
  'writing-momentum:snooze-reminder': () => this.snoozeReminder()
}
```

## Error Handling

The plugin implements comprehensive error handling:

```typescript
// Template creation errors
try {
  await this.templateEngine.createNoteFromTemplate(templateId);
} catch (error) {
  console.error('Failed to create note from template:', error);
  new Notice('Failed to create writing note. Please try again.');
}

// Data persistence errors
try {
  await this.dataManager.saveData();
} catch (error) {
  console.error('Failed to save writing data:', error);
  // Graceful degradation - continue working in memory
}
```

## Performance Considerations

### Memory Management
- Sessions are stored in memory and persisted periodically
- Large session histories are automatically cleaned up
- Template caching prevents repeated file reads

### Optimization Tips
- Limit prompt file size to <100KB for best performance
- Use template variables instead of complex content generation
- Clear old session data via export/import if performance degrades

### Resource Usage
- Dashboard updates are throttled to prevent excessive rerendering  
- Word count calculations are batched every 5 seconds
- Reminder scheduling uses efficient timeout management

## Security Considerations

### Data Privacy
- All data stored locally in Obsidian vault
- No network requests or external dependencies
- Content is never stored, only metadata

### File System Access
- Templates and prompts read from vault only
- File creation follows Obsidian's security model
- No access to system files outside vault

## Testing

### Unit Testing
```bash
npm test
```

### Manual Testing Checklist
- [ ] Reminder notifications appear at scheduled times
- [ ] Templates create notes with proper variable substitution
- [ ] Dashboard updates in real-time during writing sessions
- [ ] Streak calculations work correctly across date boundaries
- [ ] Data persists across plugin reloads
- [ ] Mobile compatibility on iOS/Android

### Performance Testing
```bash
# Load testing with large datasets
npm run test:performance

# Memory leak detection
npm run test:memory
```

## Debugging

Enable debug mode in developer console:

```javascript
// Enable verbose logging
window.writingMomentumDebug = true;

// Access plugin instance
const plugin = app.plugins.plugins['writing-momentum'];
console.log(plugin.settings);
console.log(plugin.dataManager.getDashboardStats());
```

## Migration Guide

### From v0.x to v1.0
- Settings format changed - plugin will migrate automatically
- Templates moved to `.writing-momentum/templates/`
- Data structure updated - existing sessions preserved

### Plugin Compatibility
- Compatible with all major Obsidian plugins
- No conflicts with community themes
- Works with Obsidian Sync, Git, and other sync solutions

---

*This API documentation is for plugin developers and advanced users. For general usage, see [README.md](README.md).*