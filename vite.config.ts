import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
	plugins: [react()],
	base: './',

	build: {
		outDir: 'dist',
		sourcemap: true,
		rollupOptions: {
			input: {
				popup: resolve(__dirname, 'src/popup.tsx'),
				background: resolve(__dirname, 'src/background.ts'),
				content: resolve(__dirname, 'src/content.ts'),
			},
			output: {
				entryFileNames: '[name].js',
				chunkFileNames: '[name].js',
				assetFileNames: (assetInfo) => {
					if (assetInfo.name === 'popup.html') {
						return '[name].[ext]';
					}
					return '[name].[ext]';
				},
			},
		},
	},
	resolve: {
		alias: {
			'@': resolve(__dirname, 'src'),
		},
	},
	worker: {
		format: 'es',
	},
});
