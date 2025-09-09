// Gemini API keys are stored in chrome.storage.sync under 'apiKeys'
let currentKeyIndex = 0;

// Initialize storage
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.sync.set({
    currentKeyIndex: 0,
    totalRequests: 0,
    successfulRequests: 0
  });
  const existing = await chrome.storage.sync.get(['apiKeys']);
  if (!Array.isArray(existing.apiKeys)) {
    await chrome.storage.sync.set({ apiKeys: [] });
  }
  // Try to auto-import keys from config.json if present
  await importKeysFromConfig();
});

// Also attempt on browser startup
chrome.runtime.onStartup?.addListener(async () => {
  await importKeysFromConfig();
});

// Handle keyboard shortcut
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'fix-text') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;

    try {
      // Ensure API keys are present
      const API_KEYS = await getApiKeys();
      if (!API_KEYS.length) {
        await chrome.tabs.sendMessage(tab.id, { action: 'showNotification', message: 'Добавьте API‑ключ Gemini (см. README) — ключи не найдены', type: 'error' });
        return;
      }

      // Ask content script for selected text
      const selectedResp = await chrome.tabs.sendMessage(tab.id, { action: 'getSelectedText' });
      const selectedText = selectedResp?.text || '';

      if (!selectedText.trim()) {
        // Notify user to select text first
        await chrome.tabs.sendMessage(tab.id, { action: 'showNotification', message: 'Сначала выделите текст', type: 'error' });
        return;
      }

      await chrome.tabs.sendMessage(tab.id, { action: 'showNotification', message: 'Обрабатываю текст с помощью ИИ…', type: 'info' });

      // Get corrected text from AI
  const correctedText = await correctTextWithAI(selectedText);

      if (correctedText) {
        // Replace selected text with corrected text
        await chrome.tabs.sendMessage(tab.id, { action: 'replaceSelectedText', newText: correctedText });
        await chrome.tabs.sendMessage(tab.id, { action: 'showNotification', message: 'Готово! Текст исправлен', type: 'success' });
      } else {
        await chrome.tabs.sendMessage(tab.id, { action: 'showNotification', message: 'Не удалось исправить текст. Попробуйте ещё раз.', type: 'error' });
      }
  } catch (error) {
      console.error('Error processing text correction:', error);
      try {
        await chrome.tabs.sendMessage(tab.id, { action: 'showNotification', message: 'Произошла ошибка при обработке текста', type: 'error' });
      } catch (_) {}
    }
  }
});

// Note: Interactions with the page are handled by the content script via messaging.

// Correct text using Gemini AI with key rotation
async function correctTextWithAI(text) {
  const prompt = `Fix and improve the text below. Rules:
  - Output ONLY the corrected text.
  - Do NOT add explanations, comments, labels, or code fences.
  - Preserve meaning and tone.
  - If no changes are required, output the text EXACTLY as received.

${text}`;

  const API_KEYS = await getApiKeys();
  if (!API_KEYS.length) {
    // One more attempt to import from config.json
    await importKeysFromConfig();
    const retryKeys = await getApiKeys();
    if (retryKeys.length) {
      return await correctTextWithAI(text);
    }
    return null;
  }

  for (let attempt = 0; attempt < API_KEYS.length; attempt++) {
    try {
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': API_KEYS[currentKeyIndex]
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: 'You are a precise proofreading engine. Your job is to return ONLY the corrected text. Never add explanations. If no changes are needed, return the input exactly as-is.'
            }]
          },
          generationConfig: {
            temperature: 0.2,
            response_mime_type: 'text/plain'
          },
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
          const raw = data.candidates[0].content.parts?.[0]?.text ?? '';
          return cleanModelOutput(text, raw);
        }
      } else if (response.status === 429 || response.status === 403) {
        // Rate limit or quota exceeded, try next key
        console.log(`API key ${currentKeyIndex} exhausted, switching to next key`);
        await switchToNextKey(API_KEYS.length);
      } else {
        throw new Error(`API request failed: ${response.status}`);
      }
    } catch (error) {
      console.error(`Error with API key ${currentKeyIndex}:`, error);
      if (attempt < API_KEYS.length - 1) {
        await switchToNextKey(API_KEYS.length);
      }
    }
  }
  
  // All keys failed
  updateStats(false);
  console.error('All API keys failed');
  return null;
}

// Switch to next API key
async function switchToNextKey(keysLength) {
  const len = typeof keysLength === 'number' && keysLength > 0 ? keysLength : 1;
  currentKeyIndex = (currentKeyIndex + 1) % len;
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

// Clean and constrain model output to pure corrected text
function cleanModelOutput(original, output) {
  if (!output) return original;
  let text = String(output).trim();

  // Remove common leading labels
  text = text
    .replace(/^output\s*:\s*/i, '')
    .replace(/^result\s*:\s*/i, '')
    .replace(/^corrected\s*text\s*:\s*/i, '')
    .replace(/^исправленный\s*текст\s*:\s*/i, '')
    .replace(/^ответ\s*:\s*/i, '')
    .trim();

  // Strip surrounding quotes or code fences
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith('“') && text.endsWith('”')) || (text.startsWith('«') && text.endsWith('»'))) {
    text = text.slice(1, -1).trim();
  }
  if (text.startsWith('```') && text.endsWith('```')) {
    text = text.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim();
  }

  // If model echoed an explanation in first sentence, drop common patterns
  text = text.replace(/^(?:This .*?|Здесь .*?|Ниже .*?|There is .*?|Это .*?)\.?\s+/i, '').trim();

  // If output contains both explanation and a quoted version of the text, try to take the last paragraph
  if (text.includes('\n\n')) {
    const parts = text.split(/\n{2,}/).map(s => s.trim()).filter(Boolean);
    if (parts.length > 1) {
      text = parts[parts.length - 1];
    }
  }

  // Fallback: if output is essentially unchanged or empty, return original
  if (!text) return original;
  if (normalize(text) === normalize(original)) return original;

  return text;
}

function normalize(s) {
  return String(s).trim().replace(/\s+/g, ' ');
}

async function getApiKeys() {
  const { apiKeys } = await chrome.storage.sync.get(['apiKeys']);
  if (Array.isArray(apiKeys)) {
    return apiKeys.filter(Boolean).map(String);
  }
  return [];
}

// Import keys from a local config.json packaged with the extension, if available
async function importKeysFromConfig() {
  try {
    const { apiKeys: existing } = await chrome.storage.sync.get(['apiKeys']);
    if (Array.isArray(existing) && existing.length > 0) return; // already set

    const url = chrome.runtime.getURL('config.json');
    const resp = await fetch(url);
    if (!resp.ok) return;
    const data = await resp.json();
    const keys = Array.isArray(data?.apiKeys) ? data.apiKeys.filter(Boolean).map(String) : [];
    if (keys.length > 0) {
      await chrome.storage.sync.set({ apiKeys: keys, currentKeyIndex: 0 });
      console.log('Imported API keys from config.json');
    }
  } catch (e) {
    // Silently ignore if file not found or invalid
  }
}