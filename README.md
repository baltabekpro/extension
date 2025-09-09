# AI Text Corrector Chrome Extension

A Chrome extension that uses AI to fix and improve text with keyboard shortcuts. Simply select text and press `Ctrl+Shift+F` to get AI-powered corrections using Google's Gemini API.

## Features

- **Keyboard Shortcut**: Quick text correction with `Ctrl+Shift+F`
- **AI-Powered**: Uses Google Gemini 2.0 Flash for text improvement
- **Auto Key Rotation**: Automatically switches between API keys when quotas are exhausted
- **Universal Support**: Works on any webpage with different input types:
  - Regular text selection
  - Textarea elements
  - ContentEditable divs
  - Input fields
- **Visual Feedback**: Animated notifications for success/error states
- **Usage Statistics**: Track your correction attempts and success rate
- **No External Dependencies**: Works entirely within Chrome

## Installation

1. Clone this repository or download the files
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension folder
5. The extension is now ready to use!

## Usage

1. **Select text** on any webpage that you want to improve
2. **Press `Ctrl+Shift+F`** (or your configured shortcut)
3. **Wait for AI processing** - you'll see a notification
4. **Text is automatically replaced** with the improved version

### Supported Text Types

- **Regular webpage text**: Select and correct any text on a page
- **Form inputs**: Works in textboxes, textareas, and contentEditable elements
- **Multiple languages**: Supports text correction in various languages

## API Configuration

The extension uses Google Gemini API with automatic key rotation:

```javascript
const API_KEYS = [
  'AIzaSyClo-DqTkK3WgI1clFzzB9kgrxUI2WPBfQ',
  'AIzaSyAki3gbqQCfiUCa61i-a4f_hvTrfgXncOY',
  'AIzaSyCWeNr4ime4BPeeA3aXlSxLHEEE-rL2pgI'
];
```

When one API key reaches its quota, the extension automatically switches to the next available key.

## File Structure

```
├── manifest.json          # Extension configuration
├── background.js           # Service worker for API calls and shortcuts
├── content.js             # Content script for page interaction
├── popup.html             # Extension popup UI
├── popup.js               # Popup functionality
├── test.html              # Test page for manual testing
└── TEST_INSTRUCTIONS.md   # Testing guidelines
```

## Testing

Open `test.html` in your browser to test the extension with various text types and scenarios.

## Permissions

The extension requires these permissions:
- `activeTab`: To interact with the current webpage
- `scripting`: To inject scripts for text replacement
- `storage`: To save usage statistics and settings
- Host permission for `https://generativelanguage.googleapis.com/*`: To make API calls

## Troubleshooting

- **Extension not working on some pages**: Chrome extensions cannot run on `chrome://` or `chrome-extension://` pages
- **No response from AI**: Check if all API keys have reached their quota
- **Text not replacing properly**: Make sure the text is properly selected before pressing the shortcut

## Development

To modify or extend the extension:

1. Make changes to the relevant files
2. Go to `chrome://extensions/` and click the refresh icon for the extension
3. Test your changes

## Privacy & Security

- Text is sent to Google's Gemini API for processing
- API keys are stored in the extension code (consider using Chrome storage for production)
- No text is stored locally beyond the processing session
- Usage statistics are stored locally in Chrome's sync storage