// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.sendMessage(tab.id, { type: 'scanImages' });
});

// Handle image fetch requests from content script
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
        // Create a new blob with the correct type if needed
        const newBlob = new Blob([blob], { type: request.mimeType || blob.type });
        sendResponse({ blob: newBlob });
      })
      .catch(error => {
        sendResponse({ error: error.message });
      });
    return true; // Will respond asynchronously
  }
});