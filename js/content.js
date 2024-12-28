class ImageDownloader {
    constructor() {
        this.processedElements = new WeakSet();
        this.processedSources = new Set();
        this.setupMutationObserver();
        this.setupMessageListener();
        this.setupEventCapture();
        this.processExistingImages();
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
            if (message.type === 'scanImages') {
                this.scanAllImages();
            }
        });
    }

    /**
     * Deep scan DOM for elements
     * @param {Element} root - Root element to scan
     */
    async deepScanElement(root) {
        // Process the root element itself
        await this.processElement(root);

        // Handle shadow DOM
        if (root.shadowRoot) {
            await this.deepScanElement(root.shadowRoot);
        }

        // Scan all child elements including those in closed shadow roots
        const elements = root.getElementsByTagName("");
        for (const element of elements) {
            await this.processElement(element);
            // Check for shadow DOM
            if (element.shadowRoot) {
                await this.deepScanElement(element.shadowRoot);
            }
        }

        // Check for elements in dialog, modal, or overlay
        const dialogs = root.querySelectorAll('dialog, [role="dialog"], [aria-modal="true"]');
        for (const dialog of dialogs) {
            await this.deepScanElement(dialog);
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
        this.processedElements = new WeakSet();
        this.processedSources = new Set();

        // Scan main document
        await this.deepScanElement(document.documentElement);

        // Process comments
        this.processComments(document.documentElement);

        // Scan iframes
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

        // Check style tags for background images
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
        // Create container if needed
        let container = element.closest('.img-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'img-container';
            element.parentNode.insertBefore(container, element);
            container.appendChild(element);
        }

        // Create download button
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'download-btn';

        // Determine best position for download button
        const positions = ['position-bl', 'position-br', 'position-tl', 'position-tr'];
        let bestPosition = 'position-bl'; // default to bottom-left

        // Check for overlapping elements
        const rect = container.getBoundingClientRect();
        positions.some(position => {
            const testElement = document.elementFromPoint(
                rect.left + (position.includes('r') ? rect.width - 8 : 8),
                rect.top + (position.includes('t') ? 8 : rect.height - 8)
            );
            if (!testElement || container.contains(testElement)) {
                bestPosition = position;
                return true;
            }
            return false;
        });

        downloadBtn.className = `download-btn ${bestPosition}`;

        downloadBtn.innerHTML = `
            <svg class="download-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
        `;

        downloadBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            e.preventDefault();
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
                console.error('Download failed:', error);
                alert('Failed to download image. Please try again.');
            } finally {
                downloadBtn.classList.remove('loading');
            }
        });

        container.appendChild(downloadBtn);
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
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                // Handle added nodes
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) { // Element node
                        // Check if it's an image element
                        if (ImageUtils.isImageElement(node)) {
                            this.processElement(node);
                        }
                        // Check for base64 images
                        const base64Images = this.findBase64Images(node);
                        base64Images.forEach(img => {
                            this.processBase64Image(img.element, img.src);
                        });
                        // Check child elements
                        if (node.getElementsByTagName) {
                            const elements = node.getElementsByTagName(" ");
                            Array.from(elements).forEach(element => {
                                if (ImageUtils.isImageElement(element)) {
                                    this.processElement(element);
                                }
                                const childBase64Images = this.findBase64Images(element);
                                childBase64Images.forEach(img => {
                                    this.processBase64Image(img.element, img.src);
                                });
                            });
                        }
                    }
                });
                // Handle attribute changes
                if (mutation.type === 'attributes') {
                    const element = mutation.target;
                    const base64Images = this.findBase64Images(element);
                    base64Images.forEach(img => {
                        this.processBase64Image(img.element, img.src);
                    });
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['src', 'style', 'data-src']
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
        downloader.scanAllImages();
    });
} else {
    const downloader = new ImageDownloader();
    downloader.scanAllImages();
}
