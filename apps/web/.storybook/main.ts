import type { StorybookConfig } from '@storybook/vue3-vite'
import { mergeConfig } from 'vite'
import viteConfig from '../vite.config.ts'

const config: StorybookConfig = {
  stories: [
    '../stories/**/*.stories.ts',
    '../stories/**/*.stories.tsx',
    '../stories/**/*.stories.js',
    '../stories/**/*.mdx',
  ],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  framework: {
    name: '@storybook/vue3-vite',
    options: {
      docgen: {
        plugin: 'vue-component-meta',
        tsconfig: 'tsconfig.app.json',
      },
    },
  },
  docs: {
    autodocs: 'tag',
  },
  async viteFinal(config) {
    return mergeConfig(config, {
      define: viteConfig.define,
      resolve: viteConfig.resolve,
      optimizeDeps: viteConfig.optimizeDeps,
      worker: viteConfig.worker,
    })
  },
}

export default config
