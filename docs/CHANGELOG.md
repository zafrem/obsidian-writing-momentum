# Changelog

All notable changes to the Writing Momentum plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-15

### Added
- **Core Plugin Architecture**
  - Clean, single-file TypeScript architecture for maintainability
  - Type-safe interfaces with proper error handling
  - Obsidian Plugin API integration
  - No circular dependencies or complex module structure

- **Real-time Session Management** 
  - Live word count tracking (updates every 5 seconds)
  - Session timer with duration and WPM calculations
  - Visual feedback in status bar and dashboard
  - Single active session management
  - Auto-session detection for writing folders

- **Writing Dashboard**
  - Beautiful UI with real-time session statistics
  - Current session display (words, duration, active file)
  - Quick action buttons for session control
  - Progress overview and helpful usage tips
  - Responsive design with proper CSS styling
  - Refresh functionality for live updates

- **Smart Auto-Detection**
  - Automatic session prompts for writing folders:
    - `journal/` - Daily journaling
    - `writing/` - Creative writing projects  
    - `blog/` - Blog posts and articles
    - `drafts/` - Draft documents
  - Click-to-start session prompts
  - Folder-based writing workflow integration

- **Quick Note Creation**
  - Instant timestamped note generation
  - Format: `YYYY-MM-DD Quick Note HH:MM.md`
  - Pre-filled with writing prompts
  - Auto-session start after creation
  - Perfect for rapid idea capture

- **Command Integration**
  - Complete Command Palette support
  - Available commands:
    - `Open Writing Dashboard` - Access main interface
    - `Start Writing Session` - Begin tracking current file
    - `Complete Writing Session` - Mark session finished
    - `Create Quick Note` - Generate timestamped note
  - Customizable keyboard shortcuts via Obsidian settings

- **Status Bar Integration**
  - Live session tracking: `✍️ 45 words (12m)`
  - Idle state display: `📝 Ready to write`
  - Toggle on/off via plugin settings
  - Real-time updates during writing

- **Comprehensive Settings Panel**
  - **Reminders**: Daily reminder time configuration (HH:MM format)
  - **Interface**: Toggle status bar, ribbon icon, notifications
  - **File Paths**: Configure template and prompt file locations
  - **User Experience**: Full customization of UI elements
  - **Real-time Settings**: Changes apply immediately

- **Word Counting Engine**
  - Accurate word counting excluding YAML frontmatter
  - 5-second update intervals during active sessions
  - Whitespace-based counting with empty string filtering
  - Performance optimized for large documents
  - Error handling for file access issues

### Technical Implementation

- **Data Storage**
  - Local storage in `.obsidian/plugins/writing-momentum/data.json`
  - Settings-only persistence (no content stored)
  - Privacy-focused approach
  - Obsidian Sync compatible

- **Performance Features**
  - Minimal memory footprint
  - No background processing when inactive
  - Efficient word counting algorithm
  - Graceful error handling
  - Clean session management

- **UI Components**
  - Modern CSS with CSS custom properties
  - Dark/light theme compatibility
  - Responsive design for all screen sizes
  - Smooth transitions and hover effects
  - Accessible design patterns

### File Structure
```
writing-momentum/
├── main.ts              # Complete plugin implementation
├── main.js              # Compiled plugin bundle  
├── manifest.json        # Plugin metadata
├── styles.css          # Dashboard styling
├── README.md           # User documentation
├── CHANGELOG.md        # Version history
├── package.json        # Build dependencies
└── tsconfig.json       # TypeScript configuration
```

### Default Configuration
```json
{
  "reminderTime": "21:00",
  "showStatusBar": true,
  "showRibbonIcon": true, 
  "enableNotifications": true,
  "templatesFolder": ".writing-momentum/templates",
  "promptsFile": ".writing-momentum/prompts.md"
}
```

### Architecture Decisions

- **Single File Approach**: All functionality in main.ts for simplicity
- **No Complex Modules**: Avoided circular dependencies and import issues
- **Embedded Settings**: Settings tab included in main file
- **Clean Interfaces**: Simple TypeScript interfaces for type safety
- **Direct API Usage**: Direct Obsidian API calls without abstraction layers

### Compatibility
- **Obsidian Version**: 1.6.0+
- **Platforms**: Desktop (Windows, macOS, Linux) and Mobile (iOS, Android)
- **Vault Size**: Tested with vaults up to 10,000+ notes
- **Theme Support**: Compatible with all Obsidian themes

### User Experience Features

- **Intuitive Workflow**
  1. Click ribbon icon → Dashboard opens
  2. Open markdown file → Click "Start Session"
  3. Write content → Word count updates live
  4. Click "Complete Session" → See progress summary

- **Visual Feedback**
  - Status bar shows live writing progress
  - Dashboard displays current session stats
  - Notifications for session events
  - Clean, modern interface design

- **Flexible Usage**
  - Works with any markdown file
  - No mandatory folder structure
  - Optional auto-session detection
  - Customizable UI elements

### Known Limitations (v1.0.0)

- **Session History**: Only current session tracked (no historical data)
- **Streak Tracking**: Not implemented in v1.0.0
- **Templates**: Settings exist but template engine not active
- **Reminders**: Settings exist but scheduling not implemented
- **Data Export**: Interface exists but functionality pending

### Installation Requirements

- Obsidian 1.6.0 or higher
- No external dependencies
- ~50KB total plugin size
- Minimal performance impact

### Development Details

- **Build System**: npm + TypeScript + esbuild
- **Code Quality**: TypeScript strict mode, proper error handling
- **Testing**: Manual testing across platforms
- **Performance**: Memory and CPU optimized

---

## Planned Features (Future Versions)

### v1.1.0 (Next Release)
- **Session History**: Track multiple sessions over time
- **Data Export**: Export session data to JSON/CSV
- **Streak Tracking**: Daily and weekly writing streaks
- **Template Engine**: Activate template creation system
- **Advanced Statistics**: Progress charts and analytics

### v1.2.0 (Medium Term)
- **Smart Reminders**: Scheduled notification system
- **Template Variables**: Full variable substitution system
- **Writing Prompts**: Random prompt generation
- **Session Goals**: Word count targets and achievements
- **Calendar Integration**: Visual progress calendar

### v1.3.0 (Long Term)
- **Advanced Analytics**: Weekly/monthly reports
- **Habit Tracking**: Long-term writing habit visualization
- **Plugin Integrations**: Connect with other Obsidian plugins
- **Mobile Optimizations**: Enhanced mobile experience
- **Theme Customization**: Custom dashboard themes

---

## Technical Roadmap

### Code Architecture Evolution
- **v1.0**: Single-file approach (current)
- **v1.1**: Extract core modules while maintaining simplicity
- **v1.2**: Add plugin API for extensibility
- **v1.3**: Full modular architecture with proper separation

### Performance Targets
- **Dashboard Load**: <100ms for 1 year of session data
- **Word Count Update**: <10ms per update cycle
- **Memory Usage**: <15MB for typical usage
- **Battery Impact**: Minimal on mobile devices

---

*For support, feature requests, or bug reports, visit the [GitHub repository](https://github.com/zafrem/obsidian-writing-momentum).*