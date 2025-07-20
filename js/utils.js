/**
 * Utility functions for image handling.
 */
const ImageUtils = {
  /**
   * Generates a filename for an image.
   * @param {string} url - Image URL or data URI.
   * @returns {string} Generated filename.
   */
  generateFileName: (url) => {
    if (url.startsWith('data:image')) {
      const matches = url.match(/^data:image\/([a-zA-Z0-9-+.]+);base64,/);
      const extension = matches ? matches[1] : 'png';
      return `image_${Date.now()}.${extension}`;
    }

    try {
      const urlObj = new URL(url);
      const pathSegments = urlObj.pathname.split('/');
      const fileName = pathSegments[pathSegments.length - 1];

      if (!fileName.match(/\.(jpg|jpeg|png|gif|webp|svg|avif|bmp|ico|tiff|heic|jfif)$/i)) {
        return `image_${Date.now()}.png`;
      }
      return fileName;
    } catch {
      return `image_${Date.now()}.png`;
    }
  },

  /**
   * Checks if a string is a base64 encoded image.
   * @param {string} str - String to check.
   * @returns {boolean} Whether the string is a base64 encoded image.
   */
  isBase64Image: (str) => {
    if (!str) return false;
    if (!str.startsWith('data:image/')) return false;
    const base64Regex = /^data:image\/[a-zA-Z0-9-+.]+;base64,[A-Za-z0-9+/=]+$/;
    return base64Regex.test(str);
  },

  /**
   * Converts base64 to a Blob.
   * @param {string} base64 - Base64 string.
   * @returns {Blob} Blob object.
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
   * Converts an image to a Blob URL.
   * @param {string} url - Image URL or data URI.
   * @returns {Promise<string>} Blob URL.
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
        credentials: 'include',
      });
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch (error) {
      console.error('Error creating blob URL:', error);
      throw error;
    }
  },

  /**
   * Checks if an image is valid and loaded.
   * @param {HTMLImageElement} img - Image element to check.
   * @returns {boolean} Whether the image is valid.
   */
  isValidImage: (img) => img.complete
           && img.naturalWidth !== 0
           && img.naturalHeight !== 0
           && !img.classList.contains('download-icon'),

  /**
   * Gets all possible image sources from an element.
   * @param {Element} element - DOM element to check.
   * @returns {Array<string>} Array of image URLs.
   */
  getAllImageSources: (element) => {
    const sources = new Set();

    if (element.src) sources.add(element.src);

    const bgImage = window.getComputedStyle(element).backgroundImage;
    if (bgImage && bgImage !== 'none') {
      const urls = bgImage.match(/url\(['"]?(.*?)['"]?\)/g) || [];
      urls.forEach((url) => sources.add(url.slice(4, -1).replace(/['"]/g, '')));
    }

    if (element.srcset) {
      const srcset = element.srcset.split(',').map((src) => src.trim().split(' ')[0]);
      srcset.forEach((src) => sources.add(src));
    }

    ['data-src', 'data-original', 'data-lazy', 'data-load'].forEach((attr) => {
      const value = element.getAttribute(attr);
      if (value) sources.add(value);
    });

    return Array.from(sources);
  },

  /**
   * Extracts canvas image data.
   * @param {HTMLCanvasElement} canvas - Canvas element.
   * @returns {string} Data URL of canvas content.
   */
  getCanvasImage: (canvas) => {
    try {
      return canvas.toDataURL('image/png');
    } catch (e) {
      console.warn('Canvas may be tainted:', e);
      return null;
    }
  },

  /**
   * Checks if element is or contains an image.
   * @param {Element} element - Element to check.
   * @returns {boolean} Whether element is image-related.
   */
  isImageElement: (element) => (
    element.tagName === 'IMG'
      || element.tagName === 'CANVAS'
      || element.tagName === 'SVG'
      || window.getComputedStyle(element).backgroundImage !== 'none'
  ),

  /**
   * Gets MIME type from URL or data URI.
   * @param {string} url - Image URL or data URI.
   * @returns {string} MIME type.
   */
  getMimeType: (url) => {
    if (url.startsWith('data:')) {
      return url.split(';')[0].split(':')[1];
    }

    const extension = url.split('.').pop().toLowerCase();
    const mimeTypes = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      avif: 'image/avif',
      bmp: 'image/bmp',
      ico: 'image/x-icon',
      tiff: 'image/tiff',
      heic: 'image/heic',
      jfif: 'image/jpeg',
    };

    return mimeTypes[extension] || 'image/webp';
  },

  /**
   * Enhanced CORS bypass with proper content type handling.
   * @param {string} url - Image URL.
   * @returns {Promise<Blob>} The image blob.
   */
  bypassCORS: async (url) => {
    try {
      const response = await fetch(url, {
        mode: 'cors',
        headers: {
          Accept: 'image/webp,image/apng,image/*,*/*',
        },
      });
      return await response.blob();
    } catch (e) {
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            type: 'fetchImage',
            url,
            mimeType: ImageUtils.getMimeType(url),
          },
          (response) => {
            if (response.error) reject(response.error);
            else resolve(response.blob);
          },
        );
      });
    }
  },

  /**
   * Checks if element is hidden or in a hidden container.
   * @param {Element} element - Element to check.
   * @returns {boolean} Whether element is truly hidden.
   */
  isElementTrulyHidden: (element) => {
    const style = window.getComputedStyle(element);
    return style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0';
  },

  /**
   * Extracts src from various attributes.
   * @param {Element} element - Element to check.
   * @returns {Array<string>} Array of possible image sources.
   */
  getAllPossibleSources: (element) => {
    const sources = new Set();

    const imageAttributes = [
      'src', 'data-src', 'data-original', 'data-lazy', 'data-load',
      'data-image', 'data-original-src', 'data-hi-res-src', 'data-lazy-src',
      'data-actual-src', 'data-full-src', 'data-bg', 'data-background',
      'data-img', 'data-zoom-image', 'data-srcset', 'srcset',
    ];

    if (element.attributes) {
      Array.from(element.attributes).forEach((attr) => {
        const value = attr.value.trim();
        if (value && (value.match(/\.(jpg|jpeg|png|gif|webp|svg|avif)$/i)
            || value.startsWith('data:image/')
            || value.match(/^blob:/i))) {
          sources.add(value);
        }
      });
    }

    if (element.style && element.style.backgroundImage) {
      const urls = element.style.backgroundImage.match(/url\(['"]?([^'"]+)['"]?\)/g) || [];
      urls.forEach((url) => {
        sources.add(url.slice(4, -1).replace(/['"]/g, ''));
      });
    }

    const computedStyle = window.getComputedStyle(element);
    if (computedStyle.backgroundImage !== 'none') {
      const urls = computedStyle.backgroundImage.match(/url\(['"]?([^'"]+)['"]?\)/g) || [];
      urls.forEach((url) => {
        sources.add(url.slice(4, -1).replace(/['"]/g, ''));
      });
    }

    return Array.from(sources);
  },

  /**
   * Checks if a string might be an image source.
   * @param {string} str - String to check.
   * @returns {boolean} Whether string might be an image source.
   */
  isPossibleImageSource: (str) => {
    if (!str) return false;
    return str.match(/\.(jpg|jpeg|png|gif|webp|svg|avif)$/i)
           || str.startsWith('data:image/')
           || str.match(/^blob:/i)
           || str.match(/^https?:\/\/[^/]+\/[^?]+\?(.*&)?image/i);
  },
};

window.ImageUtils = ImageUtils;
