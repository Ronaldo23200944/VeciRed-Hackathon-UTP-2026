import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['vecired-192.png', 'vecired-512.png'],
      manifest: {
        name: 'VeciRed',
        short_name: 'VeciRed',
        description: 'Red comunitaria vecinal para comercio local, solidaridad y emergencias',
        theme_color: '#16a34a',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/vecired-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/vecired-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
})
