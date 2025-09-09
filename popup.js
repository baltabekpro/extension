// Popup script for displaying statistics and status
document.addEventListener('DOMContentLoaded', async () => {
  // Load and display usage statistics
  const stats = await chrome.storage.sync.get(['totalRequests', 'successfulRequests', 'currentKeyIndex']);
  
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