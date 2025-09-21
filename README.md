# Writing Momentum - Obsidian Plugin

> **Goal:** An Obsidian plugin that helps users write consistently. Focused on session tracking and writing momentum. Minimal friction, maximum persistence.

**Vision:** "Start writing, track progress, build habits"

## Features

### Session Management
- **Real-time Word Counting**: Track words as you write (updates every 5 seconds)
- **Session Timer**: Monitor writing duration and calculate WPM
- **Active Session Tracking**: Visual feedback in status bar and dashboard
- **Session Controls**: Start, complete, or end sessions with one click
- **Auto-session Detection**: Prompts to start sessions in writing folders

### Writing Dashboard
- **Current Session Display**: Live word count, duration, and active file
- **Progress Overview**: Today's writing statistics and session info
- **Quick Actions**: Start sessions and create quick notes instantly
- **Real-time Updates**: Refresh to see latest progress
- **Beautiful UI**: Clean, responsive design with dark/light theme support

### Workflow Integration
- **Ribbon Icon**: One-click access to dashboard
- **Command Palette**: All features accessible via Ctrl/Cmd+P
- **Status Bar**: Shows current session stats or daily progress
- **Quick Notes**: Auto-generates timestamped notes with prompts
- **Folder Detection**: Auto-detects writing in journal, blog, writing, drafts folders

### Customizable Settings
- **UI Controls**: Toggle status bar, ribbon icon, and notifications
- **Reminder Configuration**: Set daily reminder times
- **File Organization**: Configure template and prompt file locations
- **Notification Preferences**: Control session start/complete messages

## Getting Started

### Installation

1. **Manual Installation**:
   - Download the latest release files (`main.js`, `manifest.json`, `styles.css`)
   - Copy to `.obsidian/plugins/writing-momentum/`
   - Enable in Settings > Community Plugins

2. **BRAT Installation** (for development versions):
   - Install BRAT plugin
   - Add repository URL: `https://github.com/zafrem/obsidian-writing-momentum`
   - Install and enable

### First Use

1. **Enable Plugin**: Settings → Community Plugins → Writing Momentum (toggle on)
2. **Open Dashboard**: Click the target icon in the left ribbon
3. **Start Writing**: Open any markdown file and click "🚀 Start Session"
4. **Track Progress**: Watch word count update in real-time in status bar

## Usage Guide

### Basic Workflow

1. **Open a markdown file** (or create a new one)
2. **Start a session**:
   - Click ribbon icon → Dashboard → "🚀 Start Session"
   - Or use Command Palette → "Start Writing Session"
   - Or sessions auto-prompt in writing folders
3. **Write content** - word count updates every 5 seconds
4. **Complete session** when done:
   - Dashboard → "✅ Complete Session"
   - Or Command Palette → "Complete Writing Session"
5. **View progress** in status bar and dashboard

### Auto-Session Detection

The plugin automatically prompts to start sessions when opening files in these folders:
- `journal/` - Daily journaling
- `writing/` - Creative writing projects
- `blog/` - Blog posts and articles
- `drafts/` - Draft documents

### Quick Notes

Create instant writing notes with:
- **Command**: "Create Quick Note"
- **Format**: `YYYY-MM-DD Quick Note HH:MM.md`
- **Content**: Pre-filled with date, time, and writing prompt
- **Auto-session**: Automatically starts tracking after creation

## Available Commands

Access these via Command Palette (Ctrl/Cmd + P):

| Command | Description | When to Use |
|---------|-------------|-------------|
| **Open Writing Dashboard** | View current session and progress | Check progress, start/complete sessions |
| **Start Writing Session** | Begin tracking current file | When ready to start focused writing |
| **Complete Writing Session** | Mark current session as finished | When you've reached your writing goal |
| **Create Quick Note** | Generate timestamped note with prompt | Quick journaling or idea capture |

*Custom hotkeys can be assigned in Obsidian's Settings → Hotkeys*

## Configuration

### Settings Panel

Access via Settings → Writing Momentum:

** Reminders**
- **Reminder Time**: Set daily reminder time (format: HH:MM)
- Default: 21:00 (9:00 PM)

** Interface**
- **Show Status Bar**: Display writing progress in bottom status bar
- **Show Ribbon Icon**: Display plugin icon in left sidebar ribbon
- **Enable Notifications**: Show session start/complete messages

** File Paths**
- **Templates Folder**: Location for future template files
- **Prompts File**: File containing writing prompts for quick notes

### Status Bar Display

When **enabled**, shows:
- **During Session**: `✍️ 45 words (12m)` (live word count and duration)
- **No Active Session**: `📝 Ready to write` (idle state)

## Dashboard Features

### Current Session Section
- **Live Statistics**: Word count, writing duration
- **File Information**: Currently tracked file name
- **Session Controls**: Complete or end session buttons
- **No Session State**: Helpful message with instructions

### Quick Actions
- **🚀 Start Session**: Begin tracking current file
- **📝 Quick Note**: Create new timestamped note

### Today's Progress
- **Session Status**: Shows if session is active with start time
- **Helpful Tips**: Usage guidance and folder detection info

## Technical Details

### Word Counting
- **Updates**: Every 5 seconds during active sessions
- **Accuracy**: Excludes YAML frontmatter from count
- **Method**: Splits on whitespace, filters empty strings
- **Performance**: Minimal impact on Obsidian performance

### Data Storage
- **Location**: `.obsidian/plugins/writing-momentum/data.json`
- **Content**: Plugin settings only (no writing content stored)
- **Privacy**: All data remains local to your device
- **Sync**: Compatible with Obsidian Sync

### Session Logic
- **Single Session**: Only one active session at a time
- **File Tracking**: Sessions track specific file paths
- **Auto-cleanup**: Sessions end when plugin unloads
- **Error Handling**: Graceful handling of file read errors

## Troubleshooting

### Common Issues

**Plugin doesn't load**:
- Check browser console (F12) for error messages
- Ensure all files (main.js, manifest.json, styles.css) are present
- Try disabling/re-enabling the plugin

**Word count not updating**:
- Ensure session is active (check status bar)
- Verify file is saved and readable
- Check console for file access errors

**Sessions not starting**:
- Ensure a markdown file is open and active
- Check that file path is accessible
- Try manually starting via Command Palette

**Status bar not showing**:
- Enable in plugin settings: "Show Status Bar"
- Restart Obsidian after changing setting
- Check if other plugins are conflicting

### Performance

**For large vaults**:
- Auto-session detection only checks folder names
- Word counting only runs during active sessions
- No background processing when sessions aren't active

## Version History

### Current Version (1.0.0)
**Core Features Implemented:**
- Real-time session tracking and word counting
- Beautiful dashboard with live statistics  
- Command palette integration
- Settings panel with full customization
- Status bar integration
- Auto-session detection for writing folders
- Quick note creation with timestamps

### Planned Features (v1.1+)
**Session History**: Track multiple sessions over time  
**Streak Tracking**: Daily/weekly writing streaks  
**Template System**: Customizable writing templates  
**Reminders**: Scheduled writing reminders  
**Data Export**: Export session data for analysis  
**Advanced Statistics**: Weekly/monthly progress reports  

## Contributing

### Feedback & Bug Reports
- **GitHub Issues**: [Report bugs or request features](https://github.com/zafrem/obsidian-writing-momentum/issues)
- **Community**: Share your workflows and suggestions

### Development Setup
```bash
# Clone repository
git clone https://github.com/zafrem/obsidian-writing-momentum
cd obsidian-writing-momentum

# Install dependencies  
npm install

# Development build (builds automatically on changes)
npm run dev

# Production build
npm run build
```

## License

MIT License - see LICENSE file for details.

## Credits

- Built with [Obsidian Plugin API](https://github.com/obsidianmd/obsidian-api)
- Inspired by writing habit methodologies
- Icons and UI elements follow Obsidian design patterns

---

## Quick Start Checklist

- [ ] Install and enable plugin
- [ ] Click target icon in ribbon to open dashboard  
- [ ] Open a markdown file
- [ ] Click "🚀 Start Session" 
- [ ] Write and watch word count update
- [ ] Click "✅ Complete Session" when done
- [ ] Customize settings as needed

**Happy Writing! ✍️**

*Build momentum, one word at a time.*