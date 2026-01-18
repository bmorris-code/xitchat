import path from 'path';
import { defineConfig, loadEnv, type UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import legacy from '@vitejs/plugin-legacy'; // ADD THIS

export default defineConfig(({ mode }: { mode: string }): UserConfig => {
    const env = loadEnv(mode, process.cwd(), '');
    const isMobile = process.env.IS_MOBILE === 'true';

    return {
      base: isMobile ? './' : '/',

      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        
        // ADD THIS - Generates legacy bundles for older browsers
        legacy({
          targets: ['defaults', 'iOS >= 10'],
          modernPolyfills: true,
          renderLegacyChunks: true
        }),
        
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
          
          workbox: {
            cleanupOutdatedCaches: true,
            clientsClaim: true,
            skipWaiting: true,
            globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'], // Added fonts
            
            // ADD THIS - Prevent caching issues
            runtimeCaching: [
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
            background_color: '#020202', // ADDED
            display: 'standalone',        // ADDED
            start_url: '/',               // ADDED
            scope: '/',                   // ADDED
            orientation: 'portrait',      // ADDED
            icons: [
              {
                src: 'pwa-192x192.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'any maskable'
              },
              {
                src: 'pwa-512x512.png',
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
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      },
      
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './src'),
        }
      },
      
      build: {
        target: 'es2015', // CHANGED from es2020
        outDir: 'dist',
        assetsDir: 'assets',
        sourcemap: false,
        emptyOutDir: true,
        chunkSizeWarningLimit: 1000,
        rollupOptions: {
          output: {
            manualChunks: {
              vendor: ['react', 'react-dom'],
              nostr: ['nostr-tools', '@noble/secp256k1'], 
              ably: ['ably'],
              capacitor: ['@capacitor/core']
            }
          }
        }
      }
    };
});