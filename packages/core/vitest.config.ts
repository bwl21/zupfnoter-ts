export default {
  test: {
    environment: 'node',
    include: ['src/**/*.{spec,test}.ts'],
    exclude: process.env.ZUPFNOTER_GAP_REPORTS === '1'
      ? []
      : [
          'src/testing/__tests__/**/gap_report.spec.ts',
          ...(process.env.ZUPFNOTER_PDF_PARITY === '1' ? [] : ['src/testing/__tests__/pdf/**']),
        ],
  },
}
