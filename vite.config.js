import { defineConfig } from 'vite'

const githubPagesBase = '/gbti-test/'

export default defineConfig(({ command }) => ({
  base: command === 'build' ? githubPagesBase : '/',
  build: {
    outDir: 'dist',
  },
}))
