// Store image data for the sidebar
let sidebarImages = new Map();
let sidebarPorts = new Set();

// Set up side panel behavior on installation
chrome.runtime.onInstalled.addListener(() => {
    // Configure the side panel to open when clicking the action button
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
        .catch(error => console.error('Error setting panel behavior:', error));
});

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
    try {
        // Open the side panel
        await chrome.sidePanel.open({ tabId: tab.id });
        // Trigger image scan
        chrome.tabs.sendMessage(tab.id, { type: 'scanImagesForSidebar' });
    } catch (error) {
        console.error('Error opening side panel:', error);
    }
});

// Handle connections from sidebar
chrome.runtime.onConnect.addListener((port) => {
    if (port.name === 'sidebar') {
        sidebarPorts.add(port);
        
        // Send existing images if any
        if (sidebarImages.size > 0) {
            port.postMessage({ type: 'initialImages', images: Array.from(sidebarImages.values()) });
        }

        port.onDisconnect.addListener(() => {
            sidebarPorts.delete(port);
        });

        // When sidebar connects, trigger a scan on the active tab
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { type: 'scanImagesForSidebar' });
            }
        });
    }
});

// Handle messages from content script and sidebar
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'fetchImage') {
        fetch(message.url, {
            headers: {
                'Accept': 'image/webp,image/apng,image/*,*/*',
                'Content-Type': message.mimeType || 'image/webp'
            }
        })
            .then(response => response.blob())
            .then(blob => {
                const newBlob = new Blob([blob], { type: message.mimeType || blob.type });
                sendResponse({ blob: newBlob });
            })
            .catch(error => {
                sendResponse({ error: error.message });
            });
        return true;
    } 
    else if (message.type === 'clearImages') {
        sidebarImages.clear();
        // Broadcast to all connected sidebars
        for (const port of sidebarPorts) {
            port.postMessage({ type: 'clearImages' });
        }
    }
    else if (message.type === 'newImage') {
        const imageData = message.data;
        if (!sidebarImages.has(imageData.url)) {
            sidebarImages.set(imageData.url, imageData);
            // Broadcast to all connected sidebars
            for (const port of sidebarPorts) {
                port.postMessage({ type: 'newImage', data: imageData });
            }
        }
    }
    else if (message.type === 'scanComplete') {
        // Broadcast scan completion to all connected sidebars
        for (const port of sidebarPorts) {
            port.postMessage({ type: 'scanComplete' });
        }
    }
});
