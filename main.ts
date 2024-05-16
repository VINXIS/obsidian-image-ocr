import { exec } from 'child_process';
import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

interface ImageOCRSettings {
	tesseractPath: string;
}

const DEFAULT_SETTINGS: ImageOCRSettings = {
	tesseractPath: 'tesseract',
}

export default class ImageOCRPlugin extends Plugin {
	settings: ImageOCRSettings;

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		this.addRibbonIcon('camera', 'Image OCR', (evt: MouseEvent) => {
			// Check if an editor instance is active
			if (this.app.workspace.getActiveViewOfType(MarkdownView))
				new ImageOCRModal(this.app, this.settings).open();
			else
				new Notice('No active Markdown editor');
		});

		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'image-ocr',
			name: 'Run OCR on Image',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				new ImageOCRModal(this.app, this.settings).open();
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new ImageOCRSettingTab(this.app, this));
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class ImageOCRModal extends Modal {
	settings: ImageOCRSettings;

	constructor(app: App, settings: ImageOCRSettings) {
		super(app);
		this.settings = settings;
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.style.display = 'flex';
		contentEl.style.flexDirection = 'column';
		contentEl.style.gap = '10px';

		contentEl.createEl('h2', { text: 'Image OCR' });
		const textDiv = contentEl.createEl('div');
		textDiv.innerHTML = 'Click the button below to capture an image and run OCR on it.<br>The text will be copied to your clipboard if there is no active Markdown editor.';
		contentEl.createEl('select', { attr: { id: 'capture-type' } });

		// Elements for local image upload
		contentEl.createEl('input', { attr: { type: 'file', id: 'file-upload', accept: 'image/*' } });

		// Elements for URL input
		contentEl.createEl('input', { attr: { type: 'url', id: 'url-input', placeholder: 'Enter URL here' } });
		contentEl.createEl('button', { text: 'Submit', attr: { id: 'url-submit' } });
		
		// Elements for camera/video capture
		contentEl.createEl('select', { attr: { id: 'source-select'} });
		contentEl.createEl('video', { attr: { id: 'video', width: '100%', height: '100%', autoplay: 'true' }});
		contentEl.createEl('button', { text: 'Capture', attr: { id: 'capture' }});

		const fileUpload: HTMLInputElement | null = contentEl.querySelector('#file-upload');
		const urlInput: HTMLInputElement | null = contentEl.querySelector('#url-input');
		const urlSubmit: HTMLButtonElement | null = contentEl.querySelector('#url-submit');
		const captureType: HTMLSelectElement | null = contentEl.querySelector('#capture-type');
		const sourceSelect: HTMLSelectElement | null = contentEl.querySelector('#source-select');
		const video: HTMLVideoElement | null = contentEl.querySelector('#video');
		const captureButton: HTMLButtonElement | null = contentEl.querySelector('#capture');
		if (!video || !captureButton || !sourceSelect || !captureType || !fileUpload || !urlInput || !urlSubmit)
			return;

		captureType.add(new Option('Local Image', 'local'));
		captureType.add(new Option('URL', 'url'));
		captureType.add(new Option('Camera/Screen', 'camera'));
		captureType.value = 'local';
		sourceSelect.style.display = 'none';
		captureButton.style.display = 'none';
		video.style.display = 'none';
		fileUpload.style.display = 'block';
		urlInput.style.display = 'none';
		urlSubmit.style.display = 'none';

		captureType.addEventListener('change', () => {
			if (captureType.value === 'camera') {
				sourceSelect.style.display = 'block';
				captureButton.style.display = 'block';
				console.log(sourceSelect.value);
				this.getVideoStream(video, sourceSelect.value);
				video.style.display = 'block';
			} else {
				sourceSelect.style.display = 'none';
				captureButton.style.display = 'none';
				this.closeVideoStream(video);
				video.style.display = 'none';
			}

			if (captureType.value === 'local')
				fileUpload.style.display = 'block';
			else
				fileUpload.style.display = 'none';

			if (captureType.value === 'url') {
				urlInput.style.display = 'block';
				urlSubmit.style.display = 'block';
			} else {
				urlInput.style.display = 'none';
				urlSubmit.style.display = 'none';
			}
		});

		// Image upload functionality
		fileUpload.addEventListener('change', async () => {
			if (!fileUpload.files || fileUpload.files.length === 0) {
				new Notice('No file selected');
				return;
			}

			const file = fileUpload.files[0];
			const reader = new FileReader();
			reader.onload = () => {
				const buffer = Buffer.from(reader.result as ArrayBuffer);
				this.processOCR(buffer, video);
			};
			reader.readAsArrayBuffer(file);
		});

		// URL functionality
		urlSubmit.addEventListener('click', async () => {
			if (!urlInput.value || urlInput.value === '') {
				new Notice('No URL entered');
				return;
			}

			const response = await fetch(urlInput.value);
			const buffer = Buffer.from(await response.arrayBuffer());
			this.processOCR(buffer, video);
		});

		// Camera/Screen functionality
		sourceSelect.add(new Option('Select a source', ''));
		navigator.mediaDevices.enumerateDevices().then((devices) => {
			devices.filter(device => device.kind === 'videoinput').forEach(device => {
				sourceSelect.add(new Option(device.label, device.deviceId));
			});
		});
		sourceSelect.value = '';

		navigator.mediaDevices.getDisplayMedia().then(console.log);

		sourceSelect.addEventListener('change', async () => {
			this.closeVideoStream(video);
			if (!sourceSelect.value || sourceSelect.value === '')
				return;

			this.getVideoStream(video, sourceSelect.value);
		});

		captureButton.addEventListener('click', async () => {
			const canvas = document.createElement('canvas');
			canvas.width = video.videoWidth;
			canvas.height = video.videoHeight;
			canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);

			const buffer = Buffer.from(canvas.toDataURL('image/png').replace('data:image/png;base64,', ''), 'base64');
			this.processOCR(buffer, video);
		});
	}

	onClose() {
		const {contentEl} = this;
		this.closeVideoStream(contentEl.querySelector('#video'));
		contentEl.empty();
	}

	getVideoStream(video: HTMLVideoElement | null, deviceId: string) {
		if (!video || !deviceId || deviceId === '')
			return;

		navigator.mediaDevices.getUserMedia({
			video: { 
				deviceId,
				width: { ideal: 1920 },
				height: { ideal: 1080 }
			}
		}).then(stream => {
			video.srcObject = stream;
		});
	}

	closeVideoStream(video: HTMLVideoElement | null) {
		if (video?.srcObject instanceof MediaStream)
			video.srcObject.getTracks().forEach(track => track.stop());
	}

	processOCR(buffer: Buffer, video: HTMLVideoElement | null) {
		const ocr = exec(`${this.settings.tesseractPath} - -`, (error, stdout, stderr) => {
			console.log(error, stdout, stderr);
			if (error) {
				console.error(error);
				new Notice('Error running tesseract, check the console for more information (Ctrl+Shift+I → Console)');
				return;
			}

			if (stderr)
				console.error(stderr);

			if (stdout === '') {
				new Notice('No text detected in image');
				return;
			}

			const leaf = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (!leaf) {
				navigator.clipboard.writeText(stdout).then(() => {
					console.log('Text copied to clipboard');
				});
				new Notice('No active Markdown editor. Please open a Markdown file before using this plugin. Text has been copied to clipboard.');
				return;
			}

			leaf.editor.replaceSelection(stdout);
			this.closeVideoStream(video);
			this.close();
		});

		ocr.stdin?.write(buffer);
		ocr.stdin?.end();
	}
}

class ImageOCRSettingTab extends PluginSettingTab {
	plugin: ImageOCRPlugin;

	constructor(app: App, plugin: ImageOCRPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();
		containerEl.createEl('h2', { text: 'Tesseract' });
		containerEl.createEl('p', { text: 'Tesseract is an open-source OCR engine that can be used to extract text from images. ' }).createEl('a', { text: 'If you do not currently have tesseract, download here.', href: 'https://tesseract-ocr.github.io/tessdoc/Installation.html' });

		new Setting(containerEl)
			.setName('Tesseract Path')
			.setDesc('The path to the tesseract executable. This will typically be in whichever folder you had installed it in. If you have added the installed folder to your PATH, you can leave this as "tesseract".')
			.addText(text => text
				.setPlaceholder('Enter tesseract path here')
				.setValue(this.plugin.settings.tesseractPath)
				.onChange(async (value) => {
					this.plugin.settings.tesseractPath = value;
					await this.plugin.saveSettings();
				}));
	}
}
