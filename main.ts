import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, moment } from 'obsidian';
import * as path from 'path';

interface BetterPasteSettings {
	replaceFile: boolean;
}

const DEFAULT_SETTINGS: BetterPasteSettings = {
	replaceFile: false
}

const PASTED_IMAGE_DEFAULT = 'Pasted image'

export default class BetterPaste extends Plugin {
	settings: BetterPasteSettings;
	appLoaded: boolean = false;

	async onload() {
		await this.loadSettings();

		// Once the app is loaded, it will set the variable
		this.app.workspace.onLayoutReady(() => {
			this.appLoaded = true;
		})

		this.app.vault.on('create', async (f) => {
			// This event gets fired when obsidian is being loaded
			// I don't know why this happens, but this is a way to prevent it
			if (!this.appLoaded) {
				return;
			}
			// Check if it's a file
			if (!(f instanceof TFile)) {
				return;
			}
			// Create a new file variable with the correct type
			const file: TFile = f as TFile;
			if (file.name.startsWith(PASTED_IMAGE_DEFAULT)) {
				// Open the renaming model
				new RenameModal(this.app, file, this.settings).open();
			}
		})

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new BetterPasteSettingTab(this.app, this));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class RenameModal extends Modal {
	file: TFile;
	name: string;
	settings: BetterPasteSettings;
	constructor(app: App, file: TFile, settings: BetterPasteSettings) {
		super(app);
		this.file = file;
		this.settings = settings;
	}

	onOpen() {
		const {contentEl, titleEl} = this;
		titleEl.setText('Renaming Pasted Image');
		
		// Enter a new name
		const nameField = new Setting(contentEl)
			.setName('Rename to')
			.setDesc('Enter the new filename you would like')
			.addText((text) => {
				text.onChange((value: string) => {
					this.name = value;
				})
			});

		// Setup error display
		const errorDisplay = contentEl.createDiv({cls: 'error-container'});
		errorDisplay.style.color = 'red';
		errorDisplay.style.display = 'none';
		errorDisplay.style.marginBottom = '10px';
			
		// Rename button
		const renameButton = new Setting(contentEl)
			.addButton((btn) => {
				btn.setButtonText('Rename')
				.setCta()
				.onClick(async () => {
					const parent = this.file.parent?.path! == '/' ? '' : this.file.parent?.path!;
					const newPath = path.join(parent, this.name + '.' + this.file.extension);
					// Attempt to rename the file
					try {
						this.rename(newPath);
						this.close();
					} catch {
						// File exists, check if we replace it
						if (this.settings.replaceFile) {
							// Grab the existing file and delete it
							const existingFile = this.app.vault.getAbstractFileByPath(newPath);
							await this.app.vault.delete(existingFile!);

							// Reattempt rename
							this.rename(newPath);

							this.close();
						} else {
							errorDisplay.textContent = 'File already exists!';
							errorDisplay.style.display = 'block';
						}
					}
				})
			});
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
	// NOTE: I will likely add more logic here to make sure file links get replaced.
	async rename(newPath: string) {
		// Rename the file
		await this.app.fileManager.renameFile(this.file, newPath);
	}
}

class BetterPasteSettingTab extends PluginSettingTab {
	plugin: BetterPaste;

	constructor(app: App, plugin: BetterPaste) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Replace file')
			.setDesc('Replace the file if it exists')
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.replaceFile)
					.onChange(async (value) => {
						this.plugin.settings.replaceFile = value;
						await this.plugin.saveSettings();
					})

			});
	}
}