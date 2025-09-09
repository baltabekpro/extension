// Gemini API keys with rotation support
const API_KEYS = [
  'AIzaSyClo-DqTkK3WgI1clFzzB9kgrxUI2WPBfQ',
  'AIzaSyAki3gbqQCfiUCa61i-a4f_hvTrfgXncOY',
  'AIzaSyCWeNr4ime4BPeeA3aXlSxLHEEE-rL2pgI'
];

let currentKeyIndex = 0;

// Initialize storage
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({
    currentKeyIndex: 0,
    totalRequests: 0,
    successfulRequests: 0
  });
});

// Handle keyboard shortcut
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'fix-text') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    try {
      // Get selected text from content script
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: getSelectedText
      });
      
      const selectedText = results[0].result;
      
      if (!selectedText || selectedText.trim() === '') {
        console.log('No text selected');
        return;
      }
      
      // Show processing notification
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: showNotification,
        args: ['Processing text with AI...', 'info']
      });
      
      // Get corrected text from AI
      const correctedText = await correctTextWithAI(selectedText);
      
      if (correctedText && correctedText !== selectedText) {
        // Replace selected text with corrected text
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          function: replaceSelectedText,
          args: [correctedText]
        });
        
        // Show success notification
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          function: showNotification,
          args: ['Text corrected successfully!', 'success']
        });
      } else if (correctedText === selectedText) {
        // Text was already correct
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          function: showNotification,
          args: ['Text looks good already!', 'info']
        });
      } else {
        // API failed
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          function: showNotification,
          args: ['Failed to correct text. Please try again.', 'error']
        });
      }
    } catch (error) {
      console.error('Error processing text correction:', error);
    }
  }
});

// Function to get selected text (injected into page)
function getSelectedText() {
  return window.getSelection().toString();
}

// Function to replace selected text (injected into page)
function replaceSelectedText(newText) {
  const selection = window.getSelection();
  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(document.createTextNode(newText));
    selection.removeAllRanges();
  }
}

// Function to inject notification function into page
function showNotification(message, type = 'info') {
  // Remove existing notification
  const existingNotification = document.getElementById('ai-text-corrector-notification');
  if (existingNotification) {
    existingNotification.remove();
  }
  
  // Create notification element
  const notification = document.createElement('div');
  notification.id = 'ai-text-corrector-notification';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
    color: white;
    padding: 12px 16px;
    border-radius: 4px;
    font-family: Arial, sans-serif;
    font-size: 14px;
    z-index: 10000;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    max-width: 300px;
    word-wrap: break-word;
    animation: slideIn 0.3s ease-out;
  `;
  
  // Add animation keyframes
  if (!document.getElementById('ai-corrector-styles')) {
    const style = document.createElement('style');
    style.id = 'ai-corrector-styles';
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }
  
  notification.textContent = message;
  document.body.appendChild(notification);
  
  // Auto remove after 3 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.style.animation = 'slideIn 0.3s ease-out reverse';
      setTimeout(() => notification.remove(), 300);
    }
  }, 3000);
}

// Correct text using Gemini AI with key rotation
async function correctTextWithAI(text) {
  const prompt = `Please fix and improve the following text. Correct grammar, spelling, punctuation, and make it more clear and professional while keeping the original meaning and tone. Only return the corrected text without any explanations:

${text}`;

  for (let attempt = 0; attempt < API_KEYS.length; attempt++) {
    try {
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': API_KEYS[currentKeyIndex]
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
          // Update statistics
          updateStats(true);
          return data.candidates[0].content.parts[0].text.trim();
        }
      } else if (response.status === 429 || response.status === 403) {
        // Rate limit or quota exceeded, try next key
        console.log(`API key ${currentKeyIndex} exhausted, switching to next key`);
        await switchToNextKey();
      } else {
        throw new Error(`API request failed: ${response.status}`);
      }
    } catch (error) {
      console.error(`Error with API key ${currentKeyIndex}:`, error);
      if (attempt < API_KEYS.length - 1) {
        await switchToNextKey();
      }
    }
  }
  
  // All keys failed
  updateStats(false);
  console.error('All API keys failed');
  return null;
}

// Switch to next API key
async function switchToNextKey() {
  currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
  await chrome.storage.sync.set({ currentKeyIndex });
}

// Update usage statistics
async function updateStats(success) {
  const result = await chrome.storage.sync.get(['totalRequests', 'successfulRequests']);
  const totalRequests = (result.totalRequests || 0) + 1;
  const successfulRequests = result.successfulRequests || 0;
  
  await chrome.storage.sync.set({
    totalRequests,
    successfulRequests: success ? successfulRequests + 1 : successfulRequests
  });
}

// Load saved key index on startup
chrome.storage.sync.get(['currentKeyIndex'], (result) => {
  if (result.currentKeyIndex !== undefined) {
    currentKeyIndex = result.currentKeyIndex;
  }
});