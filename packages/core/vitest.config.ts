import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{spec,test}.ts'],
    exclude: ['src/testing/__tests__/**/gap_report.spec.ts'],
  },
})
