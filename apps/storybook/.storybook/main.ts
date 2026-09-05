import type { StorybookConfig } from '@storybook/vue3-vite'
import { mergeConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

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
        tsconfig: './tsconfig.json',
      },
    },
  },
  async viteFinal(config) {
    return mergeConfig(config, {
      plugins: [vue()],
      resolve: {
        conditions: ['source', 'import', 'module', 'browser', 'default'],
      },
      optimizeDeps: { exclude: ['@zupfnoter/core', '@zupfnoter/types'] },
    })
  },
}

export default config
