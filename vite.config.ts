import { defineConfig } from 'vite'
import { resolve } from 'node:path'
import { copyFileSync } from 'node:fs'

export default defineConfig({
  base: './',
  plugins: [{
    name: 'copy-runtime-assets',
    writeBundle() {
      copyFileSync(resolve(__dirname, 'support.js'), resolve(__dirname, 'dist/support.js'))
      copyFileSync(resolve(__dirname, 'map.html'), resolve(__dirname, 'dist/map.html'))
      copyFileSync(resolve(__dirname, 'public/favicon.svg'), resolve(__dirname, 'dist/favicon.svg'))
      copyFileSync(resolve(__dirname, 'public/manifest.webmanifest'), resolve(__dirname, 'dist/manifest.webmanifest'))
      copyFileSync(resolve(__dirname, 'public/sw.js'), resolve(__dirname, 'dist/sw.js'))
    },
  }],
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        app: resolve(__dirname, 'Voltua ERP.dc.html'),
      },
    },
  },
})
