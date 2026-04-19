import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vite'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig(() => ({
  base: '/',
  plugins: [
    {
      name: 'examples-gallery-hint',
      configureServer(server) {
        server.httpServer?.once('listening', () => {
          const address = server.httpServer?.address()
          if (!address || typeof address === 'string') return
          const host = address.address === '::' ? 'localhost' : address.address
          console.log(`Examples gallery ready at http://${host}:${address.port}/examples/`)
        })
      },
    },
  ],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        gbti: path.resolve(__dirname, 'gbti/index.html'),
        sbti: path.resolve(__dirname, 'sbti/index.html'),
        abti: path.resolve(__dirname, 'abti/index.html'),
        mpti: path.resolve(__dirname, 'mpti/index.html'),
        poster: path.resolve(__dirname, 'poster/index.html'),
        examples: path.resolve(__dirname, 'examples/index.html'),
        examplesGbti: path.resolve(__dirname, 'examples/gbti/index.html'),
        examplesSbti: path.resolve(__dirname, 'examples/sbti/index.html'),
        examplesAbti: path.resolve(__dirname, 'examples/abti/index.html'),
        examplesMpti: path.resolve(__dirname, 'examples/mpti/index.html'),
      },
    },
  },
}))
