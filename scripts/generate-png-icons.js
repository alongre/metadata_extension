import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create minimal PNG files (Base64 encoded)
// These are very simple 1x1 transparent PNGs that will work as placeholders
const minimalPNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const sizes = [16, 32, 48, 128];
const iconsDir = path.join(__dirname, '../icons');

sizes.forEach((size) => {
	const filename = `wizard-${size}.png`;
	const filepath = path.join(iconsDir, filename);

	// Write the minimal PNG data
	fs.writeFileSync(filepath, Buffer.from(minimalPNG, 'base64'));
	console.log(`Created ${filename}`);
});

console.log('Placeholder PNG icons created successfully!');
console.log('Note: These are minimal transparent PNGs. Replace with proper wizard icons for production.');
