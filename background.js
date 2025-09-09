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
      
      // Get corrected text from AI
      const correctedText = await correctTextWithAI(selectedText);
      
      if (correctedText) {
        // Replace selected text with corrected text
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          function: replaceSelectedText,
          args: [correctedText]
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