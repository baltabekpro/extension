# Test the Chrome Extension

1. Open Chrome
2. Go to chrome://extensions/
3. Enable "Developer mode" 
4. Click "Load unpacked"
5. Select this folder
6. Test the extension:
   - Go to any website
   - Select some text
   - Press Ctrl+Shift+F
   - Check if text gets corrected

## Extension Features

- Keyboard shortcut: Ctrl+Shift+F
- Works on any webpage
- Automatic API key rotation
- Visual feedback notifications
- Usage statistics in popup
- Handles different input types (textarea, contentEditable, etc.)

## API Keys Used

The extension rotates between 3 Gemini API keys automatically when one is exhausted.