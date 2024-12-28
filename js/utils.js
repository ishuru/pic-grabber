const ImageUtils = {
  /**
   * Generate filename for the image
   * @param {string} url - Image URL or data URI
   * @returns {string} Generated filename
   */
  generateFileName: (url) => {
    if (url.startsWith('data:image')) {
      // Extract extension from base64 data
      const matches = url.match(/^data:image\/([a-zA-Z0-9-+.]+);base64,/);
      const extension = matches ? matches[1] : 'png';
      return `image_${Date.now()}.${extension}`;
    }

    try {
      const urlObj = new URL(url);
      const pathSegments = urlObj.pathname.split('/');
      let fileName = pathSegments[pathSegments.length - 1];

      if (!fileName.match(/\.(jpg|jpeg|png|gif|webp|svg|avif|bmp|ico|tiff|heic|jfif)$/i)) {
        return `image_${Date.now()}.png`;
      }
      return fileName;
    } catch {
      return `image_${Date.now()}.png`;
    }
  },

  /**
   * Check if string is a base64 encoded image
   * @param {string} str - String to check
   * @returns {boolean} Whether string is base64 encoded image
   */
  isBase64Image: (str) => {
    if (!str) return false;

    // Check for data URL format
    if (!str.startsWith('data:image/')) return false;

    // Verify base64 format
    const base64Regex = /^data:image\/[a-zA-Z0-9-+.]+;base64,[A-Za-z0-9+/=]+$/;
    return base64Regex.test(str);
  },

  /**
   * Convert base64 to blob
   * @param {string} base64 - Base64 string
   * @returns {Blob} Blob object
   */
  base64ToBlob: (base64) => {
    try {
      const parts = base64.split(';base64,');
      const contentType = parts[0].split(':')[1];
      const raw = window.atob(parts[1]);
      const rawLength = raw.length;
      const uInt8Array = new Uint8Array(rawLength);

      for (let i = 0; i < rawLength; ++i) {
        uInt8Array[i] = raw.charCodeAt(i);
      }

      return new Blob([uInt8Array], { type: contentType });
    } catch (error) {
      console.error('Error converting base64 to blob:', error);
      return null;
    }
  },

  /**
   * Convert image to blob URL
   * @param {string} url - Image URL or data URI
   * @returns {Promise<string>} Blob URL
   */
  getDownloadableUrl: async (url) => {
    try {
      if (ImageUtils.isBase64Image(url)) {
        const blob = ImageUtils.base64ToBlob(url);
        if (blob) {
          return URL.createObjectURL(blob);
        }
        throw new Error('Invalid base64 image');
      }

      const response = await fetch(url, {
        mode: 'no-cors',
        credentials: 'include'
      });
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch (error) {
      console.error('Error creating blob URL:', error);
      throw error;
    }
  },

  /**
   * Check if an image is valid and loaded
   * @param {HTMLImageElement} img - Image element to check
   * @returns {boolean} Whether the image is valid
   */
  isValidImage: (img) => {
    return img.complete &&
           img.naturalWidth !== 0 &&
           img.naturalHeight !== 0 &&
           !img.classList.contains('download-icon');
  },

  /**
   * Get all possible image sources from an element
   * @param {Element} element - DOM element to check
   * @returns {Array<string>} Array of image URLs
   */
  getAllImageSources: (element) => {
    const sources = new Set();

    // Direct src attribute
    if (element.src) sources.add(element.src);

    // Background image
    const bgImage = window.getComputedStyle(element).backgroundImage;
    if (bgImage && bgImage !== 'none') {
      const urls = bgImage.match(/url\(['"]?(.*?)['"]?\)/g) || [];
      urls.forEach(url => sources.add(url.slice(4, -1).replace(/['"]/g, '')));
    }

    // srcset attribute
    if (element.srcset) {
      const srcset = element.srcset.split(',').map(src => src.trim().split(' ')[0]);
      srcset.forEach(src => sources.add(src));
    }

    // data-src and similar attributes
    ['data-src', 'data-original', 'data-lazy', 'data-load'].forEach(attr => {
      const value = element.getAttribute(attr);
      if (value) sources.add(value);
    });

    return Array.from(sources);
  },

  /**
   * Extract canvas image data
   * @param {HTMLCanvasElement} canvas - Canvas element
   * @returns {string} Data URL of canvas content
   */
  getCanvasImage: (canvas) => {
    try {
      return canvas.toDataURL('image/png');
    } catch (e) {
      // Handle tainted canvas
      console.warn('Canvas may be tainted:', e);
      return null;
    }
  },

  /**
   * Check if element is or contains an image
   * @param {Element} element - Element to check
   * @returns {boolean} Whether element is image-related
   */
  isImageElement: (element) => {
    return (
      element.tagName === 'IMG' ||
      element.tagName === 'CANVAS' ||
      element.tagName === 'SVG' ||
      window.getComputedStyle(element).backgroundImage !== 'none'
    );
  },

  /**
   * Get MIME type from URL or data URI
   * @param {string} url - Image URL or data URI
   * @returns {string} MIME type
   */
  getMimeType: (url) => {
    if (url.startsWith('data:')) {
      return url.split(';')[0].split(':')[1];
    }

    const extension = url.split('.').pop().toLowerCase();
    const mimeTypes = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'svg': 'image/svg+xml',
      'avif': 'image/avif',
      'bmp': 'image/bmp',
      'ico': 'image/x-icon',
      'tiff': 'image/tiff',
      'heic': 'image/heic',
      'jfif': 'image/jpeg'
    };

    return mimeTypes[extension] || 'image/webp';
  },

  /**
   * Enhanced CORS bypass with proper content type handling
   */
  bypassCORS: async (url) => {
    try {
      const response = await fetch(url, {
        mode: 'cors',
        headers: {
          'Accept': 'image/webp,image/apng,image/*,*/*'
        }
      });
      return await response.blob();
    } catch (e) {
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            type: 'fetchImage',
            url: url,
            mimeType: ImageUtils.getMimeType(url)
          },
          response => {
            if (response.error) reject(response.error);
            else resolve(response.blob);
          }
        );
      });
    }
  }
};

window.ImageUtils = ImageUtils;
