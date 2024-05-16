# Obsidian Image OCR

This is a desktop-only Obisidan plugin that uses Tesseract to perform OCR on an image, your screen, or from your camera. It can be used to extract text from images and insert it into your notes.

## Installation

Download and install Tesseract from [here](https://tesseract-ocr.github.io/tessdoc/Installation.html).

If desired, you can also add the path to the Tesseract executable to your PATH. A simple google search for your operating system can help you with this.

Download the latest release of this plugin from the [releases page](https://github.com/VINXIS/obsidian-image-ocr/releases) and extract it to your vault's `.obsidian/plugins` directory.

## Usage

Make sure you add the installation folder of Tesseract to the plugin settings. This is the folder that contains the `tesseract` executable. If you added it to PATH, then you can just leave it as `tesseract` in the input box.

Either click the camera icon on the ribbon, or open the command palette and search for "OCR". You can then select the source of the image you want to OCR of either a local image, a URL to an image, or your screen.

The output will either be added to your clipboard, or appended to your current cursor position in the editor.