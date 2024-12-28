# Image Downloader Plus (Pic-Grabber)

A powerful Chrome extension that allows you to download any image from any webpage, including protected and dynamically loaded images.

## Features

- **Easy Download**: Download any visible image with a single click.
- **Smart Icon Positioning**: Avoids overlapping with website elements.
- **Wide Support**: Handles protected and dynamically loaded images.
- **Compatibility**: Works with:
  - Regular images (`<img>` tags)
  - Background images (CSS)
  - Canvas elements
  - SVG images
  - Base64 encoded images
  - Lazy-loaded images
  - Images in iframes
  - Images in shadow DOM

## Installation

1. **Clone the Repository**:
   - Open your terminal or command prompt.
   - Run the following command to clone the repository:
     ```sh
     git clone https://github.com/venopyx/pic-grabber.git
     ```
   - Alternatively, you can download the zip file from [here](https://github.com/venopyx/pic-grabber/archive/refs/heads/main.zip) and extract it.

2. **Load the Extension in Chrome**:
   - Open Chrome and go to `chrome://extensions/`.
   - Enable "Developer mode" by toggling the switch in the top right corner.
   - Click the "Load unpacked" button and select the directory where you cloned or extracted the extension.

## Usage

1. **Scan for Images**:
   - Click the extension icon in the toolbar to scan the current page for images.

2. **Download Images**:
   - Hover over any image on the page to reveal the download button.
   - Click the download button to save the image to your device.

## Smart Icon Positioning

The extension implements smart icon positioning to avoid conflicts with website elements:

- **Default Position**: Bottom-left corner of images.
- **Automatic Repositioning**: If conflicts are detected, the icon will automatically reposition.
- **Four Possible Positions**: Bottom-left, bottom-right, top-left, top-right.
- **Lower z-index**: To avoid overlapping with critical website elements.

## Technical Details

### Directory Structure
```
./
├── assets/
│   ├── download-16.png
│   ├── download-32.png
│   └── download-48.png
├── css/
│   └── styles.css
├── js/
│   ├── background.js
│   ├── content.js
│   └── utils.js
└── manifest.json
```

### Permissions
- `downloads`: For saving images.
- `scripting`: For injecting content scripts.
- `activeTab`: For accessing the current tab.
- `webRequest`: For handling image requests.

## Contributing

1. **Fork the Repository**:
   - Click the "Fork" button at the top right of the [repository page](https://github.com/venopyx/pic-grabber).

2. **Create a Feature Branch**:
   - Create a new branch for your feature or bug fix.
   - Make your changes and commit them.

3. **Submit a Pull Request**:
   - Push your branch to your fork.
   - Open a pull request to the main repository.

## License

MIT License - feel free to use and modify as needed.

## Troubleshooting

### Common Issues

1. **Icon Overlapping with Website Elements**:
   - The extension uses smart positioning to avoid conflicts.
   - Icons will automatically reposition if conflicts are detected.
   - The default position is bottom-left to minimize interference.

2. **Images Not Downloading**:
   - Ensure the image is fully loaded.
   - Some websites may require authentication.
   - Check the browser console for error messages.

### Reporting Issues

Please report issues through GitHub issues with the following details:
- Browser version
- Steps to reproduce
- Screenshot if possible
- Website URL where the issue occurs

## Future Improvements

- [ ] Implement batch download functionality
- [ ] Add image format conversion options
- [ ] Include image preview on hover