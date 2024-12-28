/**
 * Manages image downloading functionality.
 */
class ImageDownloader {
    constructor() {
        this.processedElements = new WeakSet();
        this.processedSources = new Set();
        this.enabled = true; 
        this.setupMutationObserver();
        this.setupMessageListener();
        this.setupEventCapture();
        this.initializeState();
    }

    /**
     * Initializes the extension's state from local storage.
     */
    async initializeState() {
        const result = await chrome.storage.local.get(['enabled']);
        this.enabled = result.enabled !== false; 
        if (this.enabled) {
            this.processExistingImages();
        } else {
            this.removeAllButtons();
        }
    }

    /**
     * Removes all download buttons from the page.
     */
    removeAllButtons() {
        const buttons = document.querySelectorAll('.download-btn');
        buttons.forEach(button => button.remove());
    }

    /**
     * Sets up event listeners for right-click and canvas events.
     */
    setupEventCapture() {
        document.addEventListener('contextmenu', (e) => {
            if (e.target.closest('.download-btn')) {
                e.stopPropagation();
                return;
            }
        }, true);

        document.addEventListener('mouseup', (e) => {
            const canvas = e.target.closest('canvas');
            if (canvas && !this.processedElements.has(canvas)) {
                this.processCanvas(canvas);
            }
        }, true);
    }

    /**
     * Sets up a message listener for communication with the background script.
     */
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
     * Recursively scans a DOM element for images.
     * @param {Element} root - The root element to scan.
     */
    async deepScanElement(root) {
        if (!root) return;
        await this.processElement(root);
        const elements = root.querySelectorAll('*');
        for (const element of elements) {
            await this.processElement(element);
        }
        if (root.shadowRoot) {
            await this.deepScanElement(root.shadowRoot);
        }
    }

    /**
     * Processes comments for potential image sources.
     * @param {Element} root - The root element to scan.
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
     * Creates a floating download button for sources without elements.
     * @param {Node} node - Reference node.
     * @param {string} src - Image source.
     */
    createFloatingDownloadButton(node, src) {
        const container = document.createElement('span');
        container.className = 'img-container inline-img-container';
        container.style.position = 'relative';
        container.style.display = 'inline-block';

        const preview = document.createElement('img');
        preview.src = src;
        preview.style.maxWidth = '50px';
        preview.style.maxHeight = '50px';
        preview.style.verticalAlign = 'middle';
        container.appendChild(preview);

        this.createDownloadButton(container, src);

        if (node.parentNode) {
            node.parentNode.insertBefore(container, node.nextSibling);
        }
    }

    /**
     * Scans all images on the page and adds download buttons.
     */
    async scanAllImages() {
        console.log("Starting full rescan...");
        this.processedElements = new WeakSet();
        this.processedSources = new Set();
        this.removeAllButtons();
        await this.deepScanElement(document.documentElement);
        this.processComments(document.documentElement);

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

    /**
     * Processes a single DOM element for images.
     * @param {Element} element - The element to process.
     */
    async processElement(element) {
        if (this.processedElements.has(element)) return;
        this.processedElements.add(element);

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

            if (element.tagName === 'CANVAS') {
                const dataUrl = element.toDataURL('image/png');
                if (!this.processedSources.has(dataUrl)) {
                    this.processedSources.add(dataUrl);
                    this.createDownloadButton(element, dataUrl);
                }
            }

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

    /**
     * Processes a canvas element to extract its image data.
     * @param {HTMLCanvasElement} canvas - The canvas element.
     */
    processCanvas(canvas) {
        const imageData = ImageUtils.getCanvasImage(canvas);
        if (imageData) {
            this.createDownloadButton(canvas, imageData);
        }
    }

    /**
     * Processes an SVG element.
     * @param {SVGSVGElement} svg - The SVG element.
     */
    processSVG(svg) {
        const svgData = new XMLSerializer().serializeToString(svg);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        this.createDownloadButton(svg, url);
    }

    /**
     * Processes background images of an element.
     * @param {Element} element - The element to process.
     */
    processBackgroundImage(element) {
        const bgImage = window.getComputedStyle(element).backgroundImage;
        const urls = bgImage.match(/url\("?(.*?)["']?\)/g) || [];
        urls.forEach(url => {
            const cleanUrl = url.slice(4, -1).replace(/["']/g, "");
            this.createDownloadButton(element, cleanUrl);
        });
    }

    /**
     * Creates a download button for an image.
     * @param {Element} element - The element to attach the button to.
     * @param {string} imageUrl - The URL of the image.
     */
    createDownloadButton(element, imageUrl) {
        console.log("Creating download button for:", imageUrl);
        if (!this.enabled) return;

        let container = element.closest('.img-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'img-container';
            element.parentNode.insertBefore(container, element);
            container.appendChild(element);
        }

        if (container.querySelector('.download-btn')) {
            console.log("Download button already exists for:", imageUrl);
            return;
        }

        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'download-btn';

        const rect = element.getBoundingClientRect();
        const isSmallImage = rect.width < 100 || rect.height < 100;

        if (isSmallImage) {
            container.classList.add('small-image');
        } else {
            const positions = ['position-tr', 'position-tl', 'position-br', 'position-bl'];
            let bestPosition = 'position-tr'; 

            const isPointWithinImage = (x, y) => {
                const imageRect = element.getBoundingClientRect();
                return x >= imageRect.left && x <= imageRect.right &&
                       y >= imageRect.top && y <= imageRect.bottom;
            };

            const isPositionClear = (position) => {
                const offset = 24; 
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

                if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) {
                    return false;
                }

                if (!isPointWithinImage(x, y)) {
                    return false;
                }

                const elementAtPoint = document.elementFromPoint(x, y);
                return elementAtPoint && (elementAtPoint === element || element.contains(elementAtPoint));
            };

            for (const position of positions) {
                if (isPositionClear(position)) {
                    bestPosition = position;
                    break;
                }
            }

            downloadBtn.className = `download-btn ${bestPosition}`;
        }

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

    /**
     * Processes an image element.
     * @param {HTMLImageElement} img - The image element.
     */
    processImage(img) {
        if (this.processedElements.has(img) || !ImageUtils.isValidImage(img)) {
            return;
        }
        this.processedElements.add(img);
        this.createDownloadButton(img, img.src);
    }

    /**
     * Processes existing images on the page.
     */
    processExistingImages() {
        const images = document.getElementsByTagName('img');
        for (const img of images) {
            this.processImage(img);
        }
    }

    /**
     * Sets up a mutation observer to detect changes in the DOM.
     */
    setupMutationObserver() {
        const observer = new MutationObserver(async (mutations) => {
            for (const mutation of mutations) {
                mutation.addedNodes.forEach(async (node) => {
                    if (node.nodeType === 1) { 
                        await this.deepScanElement(node); 
                    }
                });

                if (mutation.type === 'attributes') {
                    const target = mutation.target;
                    await this.processElement(target); 
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

    /**
     * Finds base64 encoded images within an element.
     * @param {Element} element - The element to search.
     * @returns {Array<{element: Element, src: string}>} Array of base64 images.
     */
    findBase64Images(element) {
        const images = [];
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

    /**
     * Processes a base64 encoded image.
     * @param {Element} element - The element containing the image.
     * @param {string} base64Src - The base64 encoded image data.
     */
    async processBase64Image(element, base64Src) {
        if (this.processedElements.has(element)) return;
        this.processedElements.add(element);
        this.createDownloadButton(element, base64Src);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        const downloader = new ImageDownloader();
    });
} else {
    const downloader = new ImageDownloader();
}
