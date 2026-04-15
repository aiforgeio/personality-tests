import { defineConfig } from 'vite'

const githubPagesBase = '/personality-tests/'

export default defineConfig(({ command }) => ({
  base: command === 'build' ? githubPagesBase : '/',
  build: {
    outDir: 'dist',
  },
}))
