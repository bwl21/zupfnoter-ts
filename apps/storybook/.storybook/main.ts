import type { StorybookConfig } from '@storybook/vue3-vite'
import { mergeConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import viteConfig from '../../web/vite.config.ts'

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
      tsconfig: '../web/tsconfig.app.json',
      },
    },
  },
  async viteFinal(config) {
    return mergeConfig(config, {
      plugins: [vue()],
      define: viteConfig.define,
      resolve: viteConfig.resolve,
      optimizeDeps: viteConfig.optimizeDeps,
      worker: viteConfig.worker,
    })
  },
}

export default config
