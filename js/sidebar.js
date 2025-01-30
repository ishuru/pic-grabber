/**
 * Manages the sidebar functionality for Pic-Grabber
 */
class SidebarManager {
    constructor() {
        this.images = new Map();
        this.port = null;
        this.initializeElements();
        this.setupEventListeners();
        this.setupPortConnection();
    }

    /**
     * Initialize DOM elements
     */
    initializeElements() {
        this.imagesContainer = document.getElementById('imagesContainer');
        this.searchInput = document.getElementById('searchImages');
        this.refreshButton = document.getElementById('refreshImages');
        this.downloadAllButton = document.getElementById('downloadAll');
        this.closeButton = document.getElementById('closeSidebar');
    }

    /**
     * Set up event listeners for sidebar controls
     */
    setupEventListeners() {
        this.searchInput.addEventListener('input', () => this.filterImages());
        this.refreshButton.addEventListener('click', () => this.requestImageScan());
        this.downloadAllButton.addEventListener('click', () => this.downloadAllImages());
        this.closeButton.addEventListener('click', () => window.close());

        // Handle keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                window.close();
            } else if (e.key === 'f' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.searchInput.focus();
            }
        });
    }

    /**
     * Set up port connection with background script
     */
    setupPortConnection() {
        this.port = chrome.runtime.connect({ name: 'sidebar' });
        
        this.port.onMessage.addListener((message) => {
            if (message.type === 'initialImages') {
                message.images.forEach(imageData => this.addImage(imageData));
            } else if (message.type === 'newImage') {
                this.addImage(message.data);
            } else if (message.type === 'clearImages') {
                this.clearImages();
            } else if (message.type === 'scanComplete') {
                this.updateLoadingState(false);
            }
        });

        // Request initial image scan
        this.requestImageScan();
    }

    /**
     * Request a new image scan from the content script
     */
    requestImageScan() {
        this.clearImages();
        this.updateLoadingState(true);
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'scanImagesForSidebar' });
        });
    }

    /**
     * Clear all images from the sidebar
     */
    clearImages() {
        this.images.clear();
        this.imagesContainer.innerHTML = '<div class="loading-message">Scanning for images...</div>';
    }

    /**
     * Update the loading state of the sidebar
     * @param {boolean} isLoading - Whether the sidebar is loading
     */
    updateLoadingState(isLoading) {
        const loadingMessage = this.imagesContainer.querySelector('.loading-message');
        if (loadingMessage) {
            if (!isLoading) {
                if (this.images.size === 0) {
                    loadingMessage.textContent = 'No images found on this page';
                    loadingMessage.className = 'no-images';
                } else {
                    loadingMessage.remove();
                }
            }
        }
    }

    /**
     * Add a new image to the sidebar
     * @param {Object} imageData - Data about the image
     */
    addImage(imageData) {
        if (this.images.has(imageData.url)) {
            return;
        }

        this.images.set(imageData.url, imageData);
        const loadingMessage = this.imagesContainer.querySelector('.loading-message');
        if (loadingMessage) {
            loadingMessage.remove();
        }

        const imageElement = document.createElement('div');
        imageElement.className = 'image-item';
        imageElement.innerHTML = `
            <img src="${imageData.url}" class="image-preview" alt="Preview">
            <div class="image-info">
                <h3 class="image-filename">${imageData.filename}</h3>
                <p class="image-dimensions">${imageData.dimensions}</p>
            </div>
            <button class="download-button" data-url="${imageData.url}">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download
            </button>
        `;

        const downloadButton = imageElement.querySelector('.download-button');
        downloadButton.addEventListener('click', () => this.downloadImage(imageData));

        this.imagesContainer.appendChild(imageElement);
    }

    /**
     * Filter images based on search input
     */
    filterImages() {
        const searchTerm = this.searchInput.value.toLowerCase();
        const items = this.imagesContainer.getElementsByClassName('image-item');

        for (const item of items) {
            const filename = item.querySelector('.image-filename').textContent.toLowerCase();
            item.style.display = filename.includes(searchTerm) ? '' : 'none';
        }
    }

    /**
     * Download a single image
     * @param {Object} imageData - Data about the image to download
     */
    async downloadImage(imageData) {
        const button = this.imagesContainer.querySelector(`[data-url="${imageData.url}"]`);
        button.classList.add('loading');

        try {
            const blob = await ImageUtils.bypassCORS(imageData.url);
            const blobUrl = URL.createObjectURL(blob);
            
            chrome.downloads.download({
                url: blobUrl,
                filename: imageData.filename,
                saveAs: false
            }, () => {
                URL.revokeObjectURL(blobUrl);
            });
        } catch (error) {
            console.error('Error downloading image:', error);
            alert('Failed to download image. Please try again.');
        } finally {
            button.classList.remove('loading');
        }
    }

    /**
     * Download all visible images
     */
    async downloadAllImages() {
        const visibleImages = Array.from(this.imagesContainer.getElementsByClassName('image-item'))
            .filter(item => item.style.display !== 'none')
            .map(item => {
                const url = item.querySelector('.download-button').dataset.url;
                return this.images.get(url);
            });

        if (visibleImages.length === 0) {
            alert('No images to download');
            return;
        }

        this.downloadAllButton.classList.add('loading');

        try {
            for (const imageData of visibleImages) {
                await this.downloadImage(imageData);
            }
        } finally {
            this.downloadAllButton.classList.remove('loading');
        }
    }
}

// Initialize the sidebar when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new SidebarManager();
});
