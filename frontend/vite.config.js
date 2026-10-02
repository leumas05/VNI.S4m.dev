import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'

const packageJson = JSON.parse(fs.readFileSync('../package.json', 'utf-8'))

export default defineConfig({
  base: './',
  define: {
    '__APP_VERSION__': JSON.stringify(packageJson.version)
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
})
