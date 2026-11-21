import path from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  // ES2019 keeps the build readable by smart TV browsers (LG webOS 6 and later, Samsung Tizen 6 and later).
  build: { target: 'es2019', cssTarget: 'chrome76' },
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: false,
      manifest: {
        name: 'Graveyard Finder',
        short_name: 'Graveyard Finder',
        description: 'Offline-first grave records, Family Cards, and caretaker visits.',
        theme_color: '#123d34',
        background_color: '#f7f3ea',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          { src: './icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: './icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: './icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,png,svg,webp,woff2}'],
        maximumFileSizeToCacheInBytes: 4_000_000,
      },
    }),
  ],
  server: { port: 3000 },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  test: {
    environment: 'node',
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.test.ts'],
  },
})
