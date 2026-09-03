import { defineConfig } from 'vite'
import { resolve } from 'node:path'
import { copyFileSync } from 'node:fs'

export default defineConfig({
  base: './',
  plugins: [
    {
      name: 'copy-runtime-assets',
      writeBundle() {
        for (const file of ['favicon.svg', 'manifest.webmanifest', 'sw.js']) {
          copyFileSync(resolve(__dirname, 'public', file), resolve(__dirname, 'dist', file))
        }
      },
    },
  ],
  build: {
    rollupOptions: {
      input: { index: resolve(__dirname, 'index.html') },
    },
  },
})
