import path from 'path';
import { defineConfig, loadEnv, type UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }: { mode: string }): UserConfig => {
  const env = loadEnv(mode, process.cwd(), '');
  const isMobile = process.env.IS_MOBILE === 'true';

  return {
    esbuild: {
      drop: [],
    },
    base: env.VITE_BASE_URL || (isMobile ? './' : '/'),

    server: {
      port: 3000,
      host: '0.0.0.0',
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    },
    plugins: [
      react(),

      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],

        workbox: {
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'], // Added fonts
          navigateFallbackDenylist: [
            // Removed APK denylist to allow downloads
          ],

          // ADD THIS - Prevent caching issues
          runtimeCaching: [
            {
              urlPattern: /\/.*\.apk(\?.*)?$/i,
              handler: 'NetworkOnly'
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            }
          ]
        },

        manifest: {
          name: 'XitChat',
          short_name: 'XitChat',
          description: 'Mesh Networking Chat App',
          theme_color: '#020202',
          background_color: '#020202',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          orientation: 'portrait',
          icons: [
            {
              src: 'icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any maskable'
            },
            {
              src: 'icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        },

        // ADD THIS - Better dev experience
        devOptions: {
          enabled: false // Disable SW in dev to avoid confusion
        }
      })
    ] as any,

    define: {
      'process.env': {},
    },

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      }
    },

    build: {
      target: 'es2020',
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: false,
      emptyOutDir: true,
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            nostr: ['nostr-tools', '@noble/secp256k1'],
            ably: ['ably'],
            capacitor: ['@capacitor/core'],
            ai: ['groq-sdk', '@google/genai']
          }
        }
      }
    }
  };
});
