# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WhatsApp ZIP Viewer is a single-file HTML application that allows users to view WhatsApp "Export Chat" ZIP files locally in their browser. It's a client-side only application that never uploads data to servers.

## Architecture

- **Single HTML file**: `index.html` contains all HTML, CSS, and JavaScript
- **No build system**: Direct HTML/CSS/JavaScript, no compilation or bundling required
- **External dependency**: Uses fflate library from CDN for ZIP file extraction
- **Client-side only**: All processing happens in the browser using Web APIs

## Key Components

### Core Functionality (lines 148-714)
- **State management**: Global variables for files, messages, participants
- **ZIP processing**: Uses fflate to extract WhatsApp export files
- **Message parsing**: Regex-based parsing of WhatsApp chat format with multiple patterns
- **Media handling**: Creates object URLs for images, videos, audio files
- **Rendering**: Chunked rendering for performance with large chat histories

### Message Parsing System
The parser handles multiple WhatsApp export formats:
- Bracket format: `[date, time] sender: message`
- Dash format: `date, time - sender: message`  
- System messages: `date, time - system message`
- Attachment detection: Both explicit `<attached: filename>` and implicit filename patterns

### UI Features
- **Drag & drop**: File upload via drag/drop or file picker
- **Filtering**: Real-time message filtering by keyword
- **Date jumping**: Navigate to specific dates in chat history
- **Media lightbox**: Full-screen viewing of images and videos
- **Parsing modes**: Toggle between strict and loose parsing

## Development Workflow

Since this is a single HTML file with no build process:

1. **Local development**: Open `index.html` directly in a web browser
2. **Testing**: Use browser developer tools for debugging
3. **No installation required**: Project has zero dependencies beyond the browser

## File Structure

```
/
├── index.html          # Complete application (HTML/CSS/JS)
├── README.md          # Basic project description  
└── CLAUDE.md          # This file
```

## Key Implementation Details

- **Performance**: Uses `requestAnimationFrame` and chunked rendering for large chat files
- **Memory management**: Revokes object URLs to prevent memory leaks
- **Internationalization**: Supports RTL text detection and BiDi text handling
- **Accessibility**: Includes ARIA labels and semantic HTML structure
- **Local storage**: Persists UI state (filename, filter) between sessions
- use playwright mcp to test yourself
- dont mention clause code at all