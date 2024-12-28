// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.sendMessage(tab.id, { type: 'scanImages' });
});

/**
 * Handles image fetch requests from the content script.
 * @param {object} request - The request object.
 * @param {object} sender - The sender object.
 * @param {function} sendResponse - The sendResponse function.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'fetchImage') {
    fetch(request.url, {
      headers: {
        'Accept': 'image/webp,image/apng,image/*,*/*',
        'Content-Type': request.mimeType || 'image/webp'
      }
    })
      .then(response => response.blob())
      .then(blob => {
        const newBlob = new Blob([blob], { type: request.mimeType || blob.type });
        sendResponse({ blob: newBlob });
      })
      .catch(error => {
        sendResponse({ error: error.message });
      });
    return true; 
  }
});
