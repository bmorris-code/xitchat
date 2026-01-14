import path from 'path';
import { defineConfig, loadEnv, type UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }: { mode: string }): UserConfig => {
    // Load env variables
    const env = loadEnv(mode, process.cwd(), '');

    // CHECK: You must run "cross-env IS_MOBILE=true vite build" for this to work
    const isMobile = process.env.IS_MOBILE === 'true';

    return {
      // 1. BASE PATH FIX
      // If mobile, use './' (relative) so files load from phone storage.
      // If web, use '/' so it works on your domain.
      base: isMobile ? './' : '/',

      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
          
          // 2. CRITICAL FIX FOR PWA UPDATES
          // This section was missing. You need this to delete old cache errors.
          workbox: {
            cleanupOutdatedCaches: true, // Deletes the old "white screen" files
            clientsClaim: true,          // Takes control immediately
            skipWaiting: true,           // Activates new version immediately
            globPatterns: ['**/*.{js,css,html,ico,png,svg}'] // What to cache
          },
          
          manifest: {
            name: 'XitChat',
            short_name: 'XitChat',
            description: 'Mesh Networking Chat App',
            theme_color: '#000000',
            icons: [
              {
                src: 'pwa-192x192.png',
                sizes: '192x192',
                type: 'image/png'
              },
              {
                src: 'pwa-512x512.png',
                sizes: '512x512',
                type: 'image/png'
              }
            ]
          }
        })
      ] as any, // 'any' casts are fine here
      
      define: {
        // Polyfill process for libs like Nostr-tools that might expect Node env
        'process.env': {}, 
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      },
      
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './src'), // Pointing to './src' is safer than just '.'
        }
      },
      
      build: {
        target: 'es2020', // PERFECT. Needed for BigInt in crypto libs.
        outDir: 'dist',
        assetsDir: 'assets',
        sourcemap: false, 
        emptyOutDir: true,
        chunkSizeWarningLimit: 1000,
        rollupOptions: {
          output: {
            // This is why you see those specific filenames. This is good!
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