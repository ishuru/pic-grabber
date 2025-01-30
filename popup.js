document.addEventListener('DOMContentLoaded', function() {
    const toggleSwitch = document.getElementById('toggleExtension');
    const recrawlBtn = document.getElementById('recrawlBtn');
    const openSidebarBtn = document.getElementById('openSidebarBtn');
    const statusDiv = document.getElementById('status');

    chrome.storage.local.get(['enabled'], function(result) {
        toggleSwitch.checked = result.enabled !== false; 
    });

    toggleSwitch.addEventListener('change', function() {
        const enabled = toggleSwitch.checked;
        chrome.storage.local.set({ enabled: enabled });
        statusDiv.textContent = `Extension ${enabled ? 'enabled' : 'disabled'}`;

        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {
                type: 'toggleExtension',
                enabled: enabled
            });
        });
    });

    recrawlBtn.addEventListener('click', function() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'scanImages' });
            statusDiv.textContent = 'Scanning page for images...';
            setTimeout(() => {
                statusDiv.textContent = 'Scan complete';
            }, 1500);
        });
    });

    openSidebarBtn.addEventListener('click', async function() {
        try {
            // Get the current tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            // Open the side panel for the current tab
            await chrome.sidePanel.open({ tabId: tab.id });
            
            // Trigger image scan
            chrome.tabs.sendMessage(tab.id, { type: 'scanImagesForSidebar' });
            
            // Close the popup
            window.close();
        } catch (error) {
            console.error('Error opening side panel:', error);
            statusDiv.textContent = 'Error opening side panel';
        }
    });
});
