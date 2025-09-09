// Content script for handling text selection and replacement
console.log('AI Text Corrector content script loaded');

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSelectedText') {
    const selectedText = window.getSelection().toString();
    sendResponse({ text: selectedText });
  } else if (request.action === 'replaceSelectedText') {
    replaceSelectedText(request.newText);
    sendResponse({ success: true });
  }
});

// Function to replace selected text
function replaceSelectedText(newText) {
  const selection = window.getSelection();
  
  if (selection.rangeCount === 0) {
    console.log('No text selection found');
    return;
  }
  
  const range = selection.getRangeAt(0);
  
  // Check if we're in an editable element
  const activeElement = document.activeElement;
  const isEditable = activeElement && (
    activeElement.tagName === 'TEXTAREA' ||
    activeElement.tagName === 'INPUT' ||
    activeElement.contentEditable === 'true'
  );
  
  if (isEditable) {
    // Handle input/textarea elements
    if (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT') {
      const start = activeElement.selectionStart;
      const end = activeElement.selectionEnd;
      const currentValue = activeElement.value;
      
      activeElement.value = currentValue.substring(0, start) + newText + currentValue.substring(end);
      activeElement.selectionStart = activeElement.selectionEnd = start + newText.length;
      
      // Trigger input event to notify the page of changes
      activeElement.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (activeElement.contentEditable === 'true') {
      // Handle contentEditable elements
      range.deleteContents();
      const textNode = document.createTextNode(newText);
      range.insertNode(textNode);
      
      // Move cursor to end of inserted text
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  } else {
    // Handle regular text selection (read-only content)
    range.deleteContents();
    const textNode = document.createTextNode(newText);
    range.insertNode(textNode);
    selection.removeAllRanges();
  }
}

// Visual feedback for text correction
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
  `;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  // Auto remove after 3 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 3000);
}

// Listen for keyboard shortcuts (backup method)
document.addEventListener('keydown', (event) => {
  if (event.ctrlKey && event.shiftKey && event.key === 'F') {
    event.preventDefault();
    
    const selectedText = window.getSelection().toString().trim();
    if (selectedText) {
      showNotification('Processing text with AI...', 'info');
    } else {
      showNotification('Please select text first', 'error');
    }
  }
});

// Highlight selection when hovering with modifier keys
document.addEventListener('mouseover', (event) => {
  if (event.ctrlKey && event.shiftKey) {
    const selection = window.getSelection();
    if (selection.toString().trim()) {
      document.body.style.cursor = 'help';
    }
  }
});

document.addEventListener('mouseout', (event) => {
  document.body.style.cursor = 'default';
});