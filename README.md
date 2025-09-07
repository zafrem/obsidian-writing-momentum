# Writing Momentum - Obsidian Plugin

> **Goal:** An Obsidian plugin that helps users write consistently. Focused on reminders and templates. Minimal friction, maximum persistence.

**Vision:** "5 minutes, 3 sentences a day" to build long-term habits

## 🌟 Features

### ⏰ Smart Reminders
- **Scheduled Reminders**: Daily/weekly reminders at your preferred times
- **Click-to-Write**: Reminders open directly to your writing template
- **Snooze Options**: 10-minute snooze for busy moments
- **Do-Not-Disturb**: Quiet hours (e.g., 11:30 PM - 7:30 AM)
- **Double Reminders**: Second notification if you miss the first one

### 📝 Template System
- **Pre-built Templates**: Daily journal, blog outline, fiction scenes
- **Variable Substitution**: 
  - `{{date}}` - Current date (2025-09-07)
  - `{{time}}` - Current time (9:00 PM)
  - `{{weekday}}` - Day of week (Monday)
  - `{{random_prompt}}` - Random writing prompt
  - `{{vault}}` - Current vault name
- **Smart File Naming**: Auto-generates filenames like "2025-09-07 Daily.md"
- **Auto Organization**: Templates specify target folders

### 🔥 Streak Tracking
- **Flexible Modes**: Daily streaks or weekly goals (e.g., 5 days/week)
- **Grace Days**: Miss a day without breaking your streak (configurable)
- **Visual Progress**: Weekly dots showing completed days
- **Longest Streak**: Track your personal best
- **Real-time Updates**: Streak updates as you write

### 📊 Writing Dashboard
- **Current Session**: Real-time word count, duration, WPM
- **Progress Stats**: Today/week/month word counts
- **Streak Visualization**: Current and longest streaks with weekly view
- **Quick Actions**: One-click template creation
- **Recent History**: Last 7 sessions with completion rates

### ⚡ Workflow Integration
- **Command Palette**: All features accessible via Ctrl/Cmd+P
- **Status Bar**: Shows current progress or session stats
- **Auto Sessions**: Automatically tracks writing when you open notes
- **Session Management**: Start, pause, complete, or end sessions

## 🚀 Getting Started

### Installation

1. **Manual Installation**:
   - Download the latest release files
   - Copy to `.obsidian/plugins/writing-momentum/`
   - Enable in Settings > Community Plugins

2. **BRAT Installation** (recommended for beta):
   - Install BRAT plugin
   - Add repository URL
   - Install and enable

### First Setup

1. **Open Dashboard**: Click ribbon icon or use Command Palette → "Open Writing Dashboard"
2. **Configure Reminders**: Settings → Writing Momentum → Set your preferred reminder time
3. **Choose Streak Mode**: Daily or weekly goals (default: 5 days/week)
4. **Create First Note**: Use Command Palette → "New note from template"

## 📖 Usage Guide

### Daily Workflow

1. **Get Reminded**: Notification appears at your set time
2. **Click to Write**: Reminder opens template with today's prompt
3. **Write**: Aim for 3 sentences minimum (or your goal)
4. **Complete**: Use dashboard button or let auto-complete when target reached
5. **Track Progress**: View stats and maintain streak

### Templates

#### Default Templates

**Daily 3-Lines** (`daily-3lines.md`):
```markdown
---
title: "{{date}}"
type: daily
tags: [journal, daily]
---
{{random_prompt}}

- Line 1
- Line 2  
- Line 3
```

**Blog Outline** (`blog-outline.md`):
```markdown
---
title: "{{date}} {{topic}} Draft"
type: blog
tags: [blog, draft]
---
# Introduction
{{random_prompt}}

## Body
- Key Idea 1
- Key Idea 2

## Conclusion
- Summary & Next action
```

**Fiction Scene** (`fiction-scene.md`):
```markdown
---
title: "Scene - {{date}}"
type: fiction
tags: [novel, scene]
---
## Scene Goal
{{random_prompt}}

## Characters
- Protagonist:
- Other:

## Conflict/Turn
- Obstacle:
- Twist:
```

#### Custom Templates

Create templates in `.writing-momentum/templates/`:

```markdown
---
name: My Custom Template
category: custom
description: Your template description
filePaths:
  pattern: "{{date}} - {{title}}.md"
  folder: "MyWriting"
---
Your template content with {{variables}}
```

### Writing Prompts

Default prompts in `.writing-momentum/prompts.md`:

```markdown
# Writing Prompts

- What was the most meaningful moment today?
- What did I learn today?
- Express your current feeling in one word.
- What am I grateful for right now?
- What challenge did I overcome today?
```

Add your own prompts to this file - one per line with `- ` prefix.

## ⚙️ Configuration

### Reminder Settings

- **Default Time**: 21:00 (9:00 PM)
- **Days**: All days (can customize per reminder)
- **Double Reminder**: 30 minutes after first missed
- **Do-Not-Disturb**: 23:30 - 07:30 (customizable)

### Streak Settings

- **Mode**: 
  - Daily: Write every day
  - Weekly: Hit target days per week (recommended)
- **Weekly Target**: 5 days (adjustable 1-7)
- **Grace Days**: 1 day forgiveness (adjustable 0-3)

### File Paths

- **Templates**: `.writing-momentum/templates/`
- **Prompts**: `.writing-momentum/prompts.md`
- Both paths are customizable in settings

## 🎯 Commands

| Command | Description | Shortcut |
|---------|-------------|----------|
| Open Writing Dashboard | View stats and progress | - |
| New note from template | Create note using template | - |
| Create quick note | Fast note with random prompt | - |
| Complete writing session | Mark current session done | - |
| Insert random prompt | Add prompt to current note | - |
| Snooze reminder | 10-minute reminder delay | - |

*Shortcuts can be customized in Obsidian's Hotkeys settings*

## 📊 Data & Privacy

### Local Storage
- All data stored locally in `.obsidian/plugins/writing-momentum/data.json`
- No external servers or accounts required
- Compatible with Obsidian Sync for cross-device sync

### Data Export
- Export sessions and streak data via Settings
- JSON format for backup or analysis
- Import capability for data migration

### What's Tracked
- Writing sessions (date, duration, word count)
- Streak statistics (current, longest, weekly progress)
- Template usage and completion rates
- No content is stored - only metadata

## 🛠️ Advanced Usage

### Multiple Reminders
```json
{
  "reminders": [
    {
      "id": "morning",
      "time": "08:00",
      "days": [1,2,3,4,5],
      "templateId": "daily-3lines"
    },
    {
      "id": "evening", 
      "time": "21:00",
      "days": [0,1,2,3,4,5,6],
      "templateId": "reflection"
    }
  ]
}
```

### Custom File Naming
Template frontmatter supports:
```yaml
filePaths:
  pattern: "{{date}} - {{mood}} Journal.md"
  folder: "Daily/{{weekday}}"
```

## 🐛 Troubleshooting

### Common Issues

**Reminders not appearing**:
- Check if notifications are enabled in browser/OS
- Verify reminder time isn't in do-not-disturb period
- Restart Obsidian after changing settings

**Templates not found**:
- Ensure templates folder exists: `.writing-momentum/templates/`
- Check template file extension is `.md`
- Verify template syntax and frontmatter

**Streak not updating**:
- Write at least 1 word and complete session
- Check streak mode settings (daily vs weekly)
- Verify date/time settings are correct

**Word count issues**:
- Word count excludes frontmatter
- Only counts completed sessions
- Auto-saves every 5 seconds during sessions

### Performance

**Plugin runs slowly**:
- Reduce reminder frequency
- Limit prompt file size
- Clear old session data via export/import

**High memory usage**:
- Large vaults: disable auto-session detection
- Limit tracked folders in settings
- Restart Obsidian periodically

## 🔄 Updates & Roadmap

### Version 1.0.0 Features
✅ Daily/weekly reminders with snooze  
✅ Template system with variable substitution    
✅ Flexible streak tracking with grace days  
✅ Beautiful dashboard with real-time stats  
✅ Session management and word counting  
✅ Data export and local storage  
✅ Mobile compatibility  

### Planned Features (v1.1+)
🔄 Calendar integration for reminders  
🔄 Voice-to-text input support    
🔄 AI-assisted prompt generation  
🔄 Weekly/monthly summary reports  
🔄 Integration with task management plugins  
🔄 Advanced template conditionals and loops  
🔄 Custom CSS themes for dashboard  
🔄 Plugin API for third-party integrations  

## 🤝 Contributing

### Feedback & Issues
- GitHub Issues: Report bugs and request features
- Community: Share templates and workflows
- Documentation: Help improve this guide

### Development
```bash
# Clone repository
git clone https://github.com/zafrem/obsidian-writing-momentum

# Install dependencies  
npm install

# Development build with hot reload
npm run dev

# Production build
npm run build

# Run tests
npm test
```

### Template Contributions
Share your templates by creating issues with:
- Template markdown file
- Use case description
- Screenshot of result

## 📜 License

MIT License - see LICENSE file for details.

## 🙏 Credits

- Inspired by Don't Break the Chain methodology
- Built with Obsidian Plugin API
- Icons from Lucide Icons
- Streak visualization inspired by GitHub contributions

---

**Happy Writing! 🎉**

*Build the habit, one sentence at a time.*