// Popup script for displaying statistics and status
document.addEventListener('DOMContentLoaded', async () => {
  // Load and display usage statistics
  const stats = await chrome.storage.sync.get(['totalRequests', 'successfulRequests', 'currentKeyIndex', 'apiKeys']);
  
  document.getElementById('totalRequests').textContent = stats.totalRequests || 0;
  document.getElementById('successfulRequests').textContent = stats.successfulRequests || 0;
  
  // Update status based on current state
  const statusDot = document.querySelector('.status-dot');
  const statusText = document.querySelector('.status-text');
  
  const totalRequests = stats.totalRequests || 0;
  const successfulRequests = stats.successfulRequests || 0;
  const currentKeyIndex = stats.currentKeyIndex || 0;
  
  if (totalRequests === 0) {
    statusText.textContent = 'Ready to correct text';
  } else if (successfulRequests === totalRequests) {
    statusText.textContent = `All requests successful (Key ${currentKeyIndex + 1})`;
  } else if (successfulRequests === 0) {
    statusDot.style.background = '#ea4335';
    statusText.style.color = '#d93025';
    statusText.textContent = 'All API keys exhausted';
  } else {
    statusDot.style.background = '#fbbc04';
    statusText.style.color = '#f29900';
    statusText.textContent = `Some failures (Key ${currentKeyIndex + 1})`;
  }
  // If no keys, warn
  if (!Array.isArray(stats.apiKeys) || stats.apiKeys.length === 0) {
    statusDot.style.background = '#ea4335';
    statusText.style.color = '#d93025';
    statusText.textContent = 'No API keys set';
  }

  // Keys UI handlers
  const keysContainer = document.getElementById('keysContainer');
  const newKeyInput = document.getElementById('newKey');
  const addKeyBtn = document.getElementById('addKeyBtn');
  const saveKeysBtn = document.getElementById('saveKeysBtn');
  const clearKeysBtn = document.getElementById('clearKeysBtn');

  let keys = Array.isArray(stats.apiKeys) ? [...stats.apiKeys] : [];
  renderKeys();

  addKeyBtn.addEventListener('click', () => {
    const v = (newKeyInput.value || '').trim();
    if (!v) return;
    keys.push(v);
    newKeyInput.value = '';
    renderKeys();
  });

  saveKeysBtn.addEventListener('click', async () => {
    // sanitize
    keys = keys.filter(Boolean).map(String);
    await chrome.storage.sync.set({ apiKeys: keys, currentKeyIndex: 0 });
    // update status
    statusDot.style.background = keys.length ? '#34a853' : '#ea4335';
    statusText.style.color = keys.length ? '#137333' : '#d93025';
    statusText.textContent = keys.length ? 'Keys saved' : 'No API keys set';
  });

  clearKeysBtn.addEventListener('click', async () => {
    keys = [];
    await chrome.storage.sync.set({ apiKeys: [], currentKeyIndex: 0 });
    renderKeys();
    statusDot.style.background = '#ea4335';
    statusText.style.color = '#d93025';
    statusText.textContent = 'No API keys set';
  });

  function renderKeys() {
    keysContainer.innerHTML = '';
    if (!keys.length) {
      const hint = document.createElement('div');
      hint.style.cssText = 'font-size:12px; color:#5f6368;';
      hint.textContent = 'Ключи не добавлены';
      keysContainer.appendChild(hint);
      return;
    }
    keys.forEach((k, idx) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex; align-items:center; gap:8px; margin-top:6px;';
      const input = document.createElement('input');
      input.type = 'text';
      input.value = k;
      input.style.cssText = 'flex:1; padding:8px; border:1px solid #dadce0; border-radius:4px;';
      input.addEventListener('input', (e) => {
        keys[idx] = e.target.value;
      });
      const del = document.createElement('button');
      del.textContent = 'Удалить';
      del.addEventListener('click', () => {
        keys.splice(idx, 1);
        renderKeys();
      });
      row.appendChild(input);
      row.appendChild(del);
      keysContainer.appendChild(row);
    });
  }
  
  // Test current tab permissions
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      statusDot.style.background = '#ea4335';
      statusText.style.color = '#d93025';
      statusText.textContent = 'Cannot work on Chrome pages';
    }
  } catch (error) {
    console.log('Could not check tab permissions');
  }
});

// Listen for storage changes to update stats in real-time
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync') {
    if (changes.totalRequests) {
      document.getElementById('totalRequests').textContent = changes.totalRequests.newValue || 0;
    }
    if (changes.successfulRequests) {
      document.getElementById('successfulRequests').textContent = changes.successfulRequests.newValue || 0;
    }
  }
});