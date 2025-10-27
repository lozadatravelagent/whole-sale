import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    proxy: {
      '/api/hotel': {
        target: 'https://test.eurovips.itraffic.com.ar',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/hotel/, '/WSBridge_EuroTest/BridgeService.asmx'),
        configure: (proxy, _options) => {
          proxy.on('error', (err, req, res) => {
            console.log('🚨 Proxy error:', err.message);
            console.log('🚨 Request URL:', req.url);
            console.log('🚨 Request method:', req.method);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('📤 Sending Request to Target:', req.method, req.url);
            console.log('📤 Target URL:', proxyReq.getHeader('host'));
            console.log('📤 Headers:', JSON.stringify(req.headers, null, 2));
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('📥 Response from Target:', proxyRes.statusCode, req.url);
            console.log('📥 Response headers:', JSON.stringify(proxyRes.headers, null, 2));
          });
        },
      },
      '/api/airfare': {
        target: 'https://test.eurovips.itraffic.com.ar',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/airfare/, '/WSBridge_EuroTest/BridgeService.asmx'),
        configure: (proxy, _options) => {
          proxy.on('error', (err, req, res) => {
            console.log('🚨 Proxy error:', err.message);
            console.log('🚨 Request URL:', req.url);
            console.log('🚨 Request method:', req.method);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('📤 Sending Request to Target:', req.method, req.url);
            console.log('📤 Target URL:', proxyReq.getHeader('host'));
            console.log('📤 Headers:', JSON.stringify(req.headers, null, 2));
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('📥 Response from Target:', proxyRes.statusCode, req.url);
            console.log('📥 Response headers:', JSON.stringify(proxyRes.headers, null, 2));
          });
        },
      },
      '/api/package': {
        target: 'https://test.eurovips.itraffic.com.ar',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/package/, '/WSBridge_EuroTest/BridgeService.asmx'),
        configure: (proxy, _options) => {
          proxy.on('error', (err, req, res) => {
            console.log('🚨 Proxy error:', err.message);
            console.log('🚨 Request URL:', req.url);
            console.log('🚨 Request method:', req.method);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('📤 Sending Request to Target:', req.method, req.url);
            console.log('📤 Target URL:', proxyReq.getHeader('host'));
            console.log('📤 Headers:', JSON.stringify(req.headers, null, 2));
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('📥 Response from Target:', proxyRes.statusCode, req.url);
            console.log('📥 Response headers:', JSON.stringify(proxyRes.headers, null, 2));
          });
        },
      }
    }
  },
  preview: {
    host: "0.0.0.0",
    port: process.env.PORT ? parseInt(process.env.PORT) : 5173,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor: React ecosystem
          'vendor-react': [
            'react',
            'react-dom',
            'react-router-dom',
          ],
          // Vendor: Radix UI components
          'vendor-radix': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast',
            '@radix-ui/react-label',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-switch',
            '@radix-ui/react-avatar',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-slot',
            '@radix-ui/react-popover',
            '@radix-ui/react-accordion',
            '@radix-ui/react-progress',
            '@radix-ui/react-separator',
          ],
          // Vendor: Data management
          'vendor-data': [
            '@tanstack/react-query',
            '@supabase/supabase-js',
          ],
          // Vendor: Charts (heavy!)
          'vendor-charts': [
            'recharts',
          ],
          // Vendor: Forms & Validation
          'vendor-forms': [
            'react-hook-form',
            '@hookform/resolvers',
            'zod',
          ],
          // Vendor: Utilities
          'vendor-utils': [
            'date-fns',
            'lucide-react',
            'clsx',
            'tailwind-merge',
            'class-variance-authority',
          ],
        },
      },
    },
    // Aumentar límite de advertencia de chunk size
    chunkSizeWarningLimit: 600,
  },
}));
