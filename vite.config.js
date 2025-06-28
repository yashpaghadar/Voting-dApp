import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default ({ mode }) => {
  // Load environment variables
  const env = loadEnv(mode, process.cwd(), '');

  return defineConfig({
    plugins: [react()],
    define: {
      'process.env': {
        VITE_VOTE_TOKEN_ADDRESS: JSON.stringify(env.VITE_VOTE_TOKEN_ADDRESS),
        VITE_VOTING_CONTRACT_ADDRESS: JSON.stringify(env.VITE_VOTING_CONTRACT_ADDRESS),
        VITE_ALCHEMY_API_KEY: JSON.stringify(env.ALCHEMY_API_KEY),
        VITE_ALCHEMY_URL: JSON.stringify(env.VITE_ALCHEMY_URL),
        VITE_APP_ENV: JSON.stringify(env.VITE_APP_ENV || 'development')
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
