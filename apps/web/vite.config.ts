import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { federation } from '@module-federation/vite';

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'web_shell',
      remotes: {
        mfe_alerts: {
          type: 'var',
          name: 'mfe_alerts',
          entry: 'http://localhost:4004/remoteEntry.js',
        }
      },
      shared: {
        react: { singleton: true },
        'react-dom': { singleton: true }
      }
    })
  ],
  server: {
    port: 3000
  }
})
