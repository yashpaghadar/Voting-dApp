import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default ({ mode }) => {
  // Load environment variables
  const env = loadEnv(mode, process.cwd(), '');

  return defineConfig({
    base: '/',
    plugins: [react()],
    define: {
      'process.env': {
        ...Object.entries(env).reduce((prev, [key, val]) => {
          if (key.startsWith('VITE_')) {
            return {
              ...prev,
              [key]: JSON.stringify(val)
            };
          }
          return prev;
        }, {}),
        VITE_APP_ENV: JSON.stringify(env.VITE_APP_ENV || 'production')
      }
    },
    resolve: {
      alias: {
        buffer: 'buffer/'
      }
    },
    optimizeDeps: {
      esbuildOptions: {
        define: {
          global: 'globalThis',
        },
      },
    },
    build: {
      commonjsOptions: {
        transformMixedEsModules: true,
      },
      // Ensure environment variables are loaded at build time
      envPrefix: 'VITE_',
    },
    // For development server
    server: {
      port: 3000,
      open: true,
      // Enable CORS for development
      cors: true,
    },
  });
};
