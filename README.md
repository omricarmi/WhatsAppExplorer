# WhatsApp Explorer

A privacy-focused, browser-based WhatsApp chat viewer that processes exported chat files entirely on your device. No data ever leaves your browser.

## Features

- **100% Private**: All processing happens locally in your browser
- **No Installation Required**: Single HTML file that works offline
- **Media Support**: View images, videos, audio, and documents from your chats
- **Advanced Search**: Filter messages by keyword, media type, or date range
- **Mobile Optimized**: LRU cache prevents memory issues on mobile devices
- **Virtual Scrolling**: Handles chats with 10,000+ messages smoothly

## Quick Start

1. Export your WhatsApp chat (includes media in a ZIP file)
2. Open `index.html` in your browser
3. Click the button to select your exported ZIP file
4. Browse your chat history with full media support

## Architecture

The project uses a modular architecture with ES6 modules:

- **MessageParser**: Parses WhatsApp chat formats (bracket, dash, system messages)
- **ZipHandler**: Extracts and manages media files with LRU caching
- **StateManager**: Observable state management with event-driven updates
- **MediaHandler**: Creates appropriate DOM elements for different media types
- **UIRenderer**: Virtual scrolling for performance (coming soon)

## Development

### Prerequisites
- Modern web browser with ES6 module support

### Running Tests

Tests use ES6 modules and require a local server due to browser CORS policies.

1. **Start a local server** from the project folder:

   **Python 3:**
   ```bash
   python3 -m http.server 8080
   ```

   **Node.js:**
   ```bash
   npx serve
   # or
   npx http-server
   ```

   **PHP:**
   ```bash
   php -S localhost:8080
   ```

2. Navigate to http://localhost:8080/test-runner.html
3. Tests will run automatically in the Jasmine test runner

**Note**: The local server is only needed for running tests. The main application (`index.html`) works without a server - just open it directly in your browser.

### Project Structure
```
wa_explorer/
├── index.html           # Main application (coming soon)
├── test-runner.html     # Jasmine test runner
├── src/                 # ES6 modules
│   ├── messageParser.js
│   ├── zipHandler.js
│   ├── stateManager.js
│   └── mediaHandler.js
└── tests/              # Unit tests
    ├── messageParser.test.js
    ├── zipHandler.test.js
    ├── stateManager.test.js
    └── mediaHandler.test.js
```

## Technical Details

- **Virtual Scrolling**: Efficiently renders only visible messages
- **LRU Cache**: Limits concurrent blob URLs to 50 (configurable) to prevent mobile OOM
- **Missing Files Tracking**: Warns users when many media files are missing from export
- **Strict Parsing**: Validates dates and tracks unparseable lines for debugging

## Privacy & Security

- No external API calls
- No analytics or tracking
- No data persistence beyond optional localStorage for settings
- All media URLs are blob URLs that are revoked when not in view
- Completely client-side processing

## Contributing

Contributions are welcome! Please ensure:
- All tests pass
- Code follows existing patterns
- No external dependencies beyond fflate for ZIP extraction
- Privacy-first approach is maintained