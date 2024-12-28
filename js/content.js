class ImageDownloader {
    constructor() {
        this.processedElements = new WeakSet();
        this.processedSources = new Set();
        this.enabled = true; // Default to enabled
        this.setupMutationObserver();
        this.setupMessageListener();
        this.setupEventCapture();
        this.initializeState();
    }

    async initializeState() {
        // Get initial state from storage
        const result = await chrome.storage.local.get(['enabled']);
        this.enabled = result.enabled !== false; // Default to true if not set
        if (this.enabled) {
            this.processExistingImages();
        } else {
            this.removeAllButtons();
        }
    }

    removeAllButtons() {
        const buttons = document.querySelectorAll('.download-btn');
        buttons.forEach(button => button.remove());
    }

    setupEventCapture() {
        // Capture right-click events
        document.addEventListener('contextmenu', (e) => {
            // Allow right-click but prevent default only if it's our download button
            if (e.target.closest('.download-btn')) {
                e.stopPropagation();
                return;
            }
        }, true);

        // Monitor canvas changes
        document.addEventListener('mouseup', (e) => {
            const canvas = e.target.closest('canvas');
            if (canvas && !this.processedElements.has(canvas)) {
                this.processCanvas(canvas);
            }
        }, true);
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((message) => {
            if (message.type === 'scanImages' && this.enabled) {
                this.scanAllImages();
            } else if (message.type === 'toggleExtension') {
                this.enabled = message.enabled;
                if (!this.enabled) {
                    this.removeAllButtons();
                } else {
                    this.scanAllImages();
                }
            }
        });
    }

    /**
     * Deep scan DOM for elements
     * @param {Element} root - Root element to scan
     */
    async deepScanElement(root) {
        if (!root) return;

        // Process the root element itself
        await this.processElement(root);

        // Recursively scan child nodes
        const elements = root.querySelectorAll('*');
        for (const element of elements) {
            await this.processElement(element);
        }

        // Process shadow DOMs if present
        if (root.shadowRoot) {
            await this.deepScanElement(root.shadowRoot);
        }
    }

    /**
     * Process comments for potential image sources
     * @param {Element} root - Root element to scan
     */
    processComments(root) {
        const iterator = document.createNodeIterator(
            root,
            NodeFilter.SHOW_COMMENT,
            null,
            false
        );
        let comment;
        while (comment = iterator.nextNode()) {
            const text = comment.textContent;
            const urls = text.match(/(https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp|svg|avif))/gi);
            if (urls) {
                urls.forEach(url => {
                    if (!this.processedSources.has(url)) {
                        this.processedSources.add(url);
                        this.createFloatingDownloadButton(comment, url);
                    }
                });
            }
        }
    }

    /**
     * Create floating download button for sources without elements
     * @param {Node} node - Reference node
     * @param {string} src - Image source
     */
    createFloatingDownloadButton(node, src) {
        // Create a container that follows the text
        const container = document.createElement('span');
        container.className = 'img-container inline-img-container';
        container.style.position = 'relative';
        container.style.display = 'inline-block';

        // Add a small preview
        const preview = document.createElement('img');
        preview.src = src;
        preview.style.maxWidth = '50px';
        preview.style.maxHeight = '50px';
        preview.style.verticalAlign = 'middle';
        container.appendChild(preview);

        // Create download button
        this.createDownloadButton(container, src);

        // Insert after the node
        if (node.parentNode) {
            node.parentNode.insertBefore(container, node.nextSibling);
        }
    }

    async scanAllImages() {
        console.log("Starting full rescan...");

        // Clear processed elements and sources
        this.processedElements = new WeakSet();
        this.processedSources = new Set();

        // Remove all existing buttons
        this.removeAllButtons();

        // Rescan the main document
        await this.deepScanElement(document.documentElement);

        // Check and process any comments for image sources
        this.processComments(document.documentElement);

        // Scan iframes for dynamically loaded content
        const frames = document.getElementsByTagName('iframe');
        for (const frame of frames) {
            try {
                const frameDoc = frame.contentDocument || frame.contentWindow.document;
                await this.deepScanElement(frameDoc.documentElement);
                this.processComments(frameDoc.documentElement);
            } catch (e) {
                console.warn('Cannot access iframe content:', e);
            }
        }

        // Rescan elements for dynamically applied styles (e.g., background images)
        const styles = document.getElementsByTagName('style');
        for (const style of styles) {
            const cssText = style.textContent;
            const urls = cssText.match(/url\("?(.*?\.(?:jpg|jpeg|png|gif|webp|svg|avif))["']?\)/gi);
            if (urls) {
                urls.forEach(url => {
                    const cleanUrl = url.slice(4, -1).replace(/["']/g, "");
                    if (!this.processedSources.has(cleanUrl)) {
                        this.processedSources.add(cleanUrl);
                        this.createFloatingDownloadButton(style, cleanUrl);
                    }
                });
            }
        }

        console.log("Finished rescanning.");
    }

    async processElement(element) {
        if (this.processedElements.has(element)) return;
        this.processedElements.add(element);

        // Get all possible sources
        const sources = ImageUtils.getAllPossibleSources(element);
        for (const src of sources) {
            if (!this.processedSources.has(src)) {
                this.processedSources.add(src);
                if (element.tagName === 'IMG') {
                    this.createDownloadButton(element, src);
                } else {
                    this.createFloatingDownloadButton(element, src);
                }
            }

            // Check for canvas elements
            if (element.tagName === 'CANVAS') {
                const dataUrl = element.toDataURL('image/png');
                if (!this.processedSources.has(dataUrl)) {
                    this.processedSources.add(dataUrl);
                    this.createDownloadButton(element, dataUrl);
                }
            }

            // Check element's computed styles
            const computedStyle = window.getComputedStyle(element);
            const properties = ['backgroundImage', 'content', 'mask', 'webkitMask'];
            for (const prop of properties) {
                const value = computedStyle[prop];
                if (value && value !== 'none') {
                    const urls = value.match(/url\("?(.*?["']?)\)/g);
                    if (urls) {
                        urls.forEach(url => {
                            const cleanUrl = url.slice(4, -1).replace(/["']/g, "");
                            if (!this.processedSources.has(cleanUrl) && ImageUtils.isPossibleImageSource(cleanUrl)) {
                                this.processedSources.add(cleanUrl);
                                this.createFloatingDownloadButton(element, cleanUrl);
                            }
                        });
                    }
                }
            }
        }
    }

    processCanvas(canvas) {
        const imageData = ImageUtils.getCanvasImage(canvas);
        if (imageData) {
            this.createDownloadButton(canvas, imageData);
        }
    }

    processSVG(svg) {
        // Convert SVG to data URL
        const svgData = new XMLSerializer().serializeToString(svg);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        this.createDownloadButton(svg, url);
    }

    processBackgroundImage(element) {
        const bgImage = window.getComputedStyle(element).backgroundImage;
        const urls = bgImage.match(/url\("?(.*?)["']?\)/g) || [];
        urls.forEach(url => {
            const cleanUrl = url.slice(4, -1).replace(/["']/g, "");
            this.createDownloadButton(element, cleanUrl);
        });
    }

    createDownloadButton(element, imageUrl) {
        console.log("Creating download button for:", imageUrl);

        if (!this.enabled) return;

        // Create or get container
        let container = element.closest('.img-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'img-container';
            element.parentNode.insertBefore(container, element);
            container.appendChild(element);
        }

        // Check for existing download button
        if (container.querySelector('.download-btn')) {
            console.log("Download button already exists for:", imageUrl);
            return;
        }

        // Create download button
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'download-btn';

        // Get element dimensions
        const rect = element.getBoundingClientRect();
        const isSmallImage = rect.width < 100 || rect.height < 100;

        if (isSmallImage) {
            container.classList.add('small-image');
        } else {
            // Determine best position for download button
            const positions = ['position-tr', 'position-tl', 'position-br', 'position-bl'];
            let bestPosition = 'position-tr'; // default to top-right

            // Function to check if a point is within the image boundaries
            const isPointWithinImage = (x, y) => {
                const imageRect = element.getBoundingClientRect();
                return x >= imageRect.left && x <= imageRect.right &&
                       y >= imageRect.top && y <= imageRect.bottom;
            };

            // Function to check if a position is clear of overlapping elements
            const isPositionClear = (position) => {
                const offset = 24; // Half of button size + padding
                let x, y;

                switch (position) {
                    case 'position-tr':
                        x = rect.right - offset;
                        y = rect.top + offset;
                        break;
                    case 'position-tl':
                        x = rect.left + offset;
                        y = rect.top + offset;
                        break;
                    case 'position-br':
                        x = rect.right - offset;
                        y = rect.bottom - offset;
                        break;
                    case 'position-bl':
                        x = rect.left + offset;
                        y = rect.bottom - offset;
                        break;
                }

                // Check if point is within viewport
                if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) {
                    return false;
                }

                // Check if point is within image
                if (!isPointWithinImage(x, y)) {
                    return false;
                }

                const elementAtPoint = document.elementFromPoint(x, y);
                return elementAtPoint && (elementAtPoint === element || element.contains(elementAtPoint));
            };

            // Find the best position
            for (const position of positions) {
                if (isPositionClear(position)) {
                    bestPosition = position;
                    break;
                }
            }

            downloadBtn.className = `download-btn ${bestPosition}`;
        }

        // Add download icon
        downloadBtn.innerHTML = `
            <svg class="download-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
        `;

        // Add click handler
        downloadBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            e.preventDefault();
            console.log("Download button clicked for:", imageUrl);

            try {
                downloadBtn.classList.add('loading');
                const blob = await ImageUtils.bypassCORS(imageUrl);
                const blobUrl = URL.createObjectURL(blob);
                const filename = ImageUtils.generateFileName(imageUrl);

                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
            } catch (error) {
                console.error("Error downloading image:", error);
                alert("Failed to download image. Please try again.");
            } finally {
                downloadBtn.classList.remove('loading');
            }
        });

        container.appendChild(downloadBtn);
        console.log("Download button added for:", imageUrl);
    }

    processImage(img) {
        if (this.processedElements.has(img) || !ImageUtils.isValidImage(img)) {
            return;
        }
        this.processedElements.add(img);
        this.createDownloadButton(img, img.src);
    }

    processExistingImages() {
        const images = document.getElementsByTagName('img');
        for (const img of images) {
            this.processImage(img);
        }
    }

    setupMutationObserver() {
        const observer = new MutationObserver(async (mutations) => {
            for (const mutation of mutations) {
                mutation.addedNodes.forEach(async (node) => {
                    if (node.nodeType === 1) { // Element node
                        await this.deepScanElement(node); // Scan the new node
                    }
                });

                if (mutation.type === 'attributes') {
                    const target = mutation.target;
                    await this.processElement(target); // Process attributes dynamically
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['src', 'style', 'data-src'],
        });
    }

    findBase64Images(element) {
        const images = [];
        // Check element attributes
        if (element.attributes) {
            Array.from(element.attributes).forEach(attr => {
                if (ImageUtils.isBase64Image(attr.value)) {
                    images.push({
                        element: element,
                        src: attr.value
                    });
                }
            });
        }
        // Check background-image CSS
        const style = window.getComputedStyle(element);
        const backgroundImage = style.backgroundImage;
        if (backgroundImage) {
            const base64Match = backgroundImage.match(/url\("?(data:image\n[^"]+)"?\)/);
            if (base64Match && ImageUtils.isBase64Image(base64Match[1])) {
                images.push({
                    element: element,
                    src: base64Match[1]
                });
            }
        }
        // Check inline style
        if (element.style && element.style.backgroundImage) {
            const base64Match = element.style.backgroundImage.match(/url\("?(data:image\n[^"]+)"?\)/);
            if (base64Match && ImageUtils.isBase64Image(base64Match[1])) {
                images.push({
                    element: element,
                    src: base64Match[1]
                });
            }
        }
        return images;
    }

    async processBase64Image(element, base64Src) {
        if (this.processedElements.has(element)) return;
        this.processedElements.add(element);
        // Create container and download button
        this.createDownloadButton(element, base64Src);
    }
}

// Initialize with immediate scan
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        const downloader = new ImageDownloader();
    });
} else {
    const downloader = new ImageDownloader();
}
