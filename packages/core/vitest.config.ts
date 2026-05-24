import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{spec,test}.ts'],
    exclude: process.env.ZUPFNOTER_GAP_REPORTS === '1'
      ? []
      : ['src/testing/__tests__/**/gap_report.spec.ts'],
  },
})
