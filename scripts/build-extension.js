import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔧 Building Metadata Wizard Chrome Extension...');

// Copy popup.html directly from src
const srcPopupPath = path.join(__dirname, '../src/popup.html');
const destPopupPath = path.join(__dirname, '../dist/popup.html');

if (fs.existsSync(srcPopupPath)) {
	let popupContent = fs.readFileSync(srcPopupPath, 'utf8');
	fs.writeFileSync(destPopupPath, popupContent);
	console.log('✅ Copied popup.html to dist');
} else {
	console.log('❌ popup.html not found in src/');
}

// Copy manifest.json to dist
const manifestSrc = path.join(__dirname, '../manifest.json');
const manifestDest = path.join(__dirname, '../dist/manifest.json');

if (fs.existsSync(manifestSrc)) {
	fs.copyFileSync(manifestSrc, manifestDest);
	console.log('✅ Copied manifest.json to dist');
} else {
	console.log('❌ manifest.json not found');
}

// Copy icons to dist
const iconsDir = path.join(__dirname, '../icons');
const distIconsDir = path.join(__dirname, '../dist/icons');

if (fs.existsSync(iconsDir)) {
	if (!fs.existsSync(distIconsDir)) {
		fs.mkdirSync(distIconsDir, { recursive: true });
	}

	const iconFiles = fs.readdirSync(iconsDir);
	iconFiles.forEach((file) => {
		if (file.endsWith('.png') || file.endsWith('.svg')) {
			fs.copyFileSync(path.join(iconsDir, file), path.join(distIconsDir, file));
		}
	});
	console.log('✅ Copied icons to dist');
} else {
	console.log('❌ Icons directory not found');
}

console.log('');
console.log('🎉 Extension build complete!');
console.log('');
console.log('📦 To install the extension:');
console.log('1. Open Chrome and go to chrome://extensions/');
console.log('2. Enable "Developer mode" in the top right');
console.log('3. Click "Load unpacked" and select the "dist" folder');
console.log('');
console.log('🚀 Your Metadata Wizard extension is ready!');
