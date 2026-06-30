module.exports = {
  default: {
    requireModule: ['tsx/cjs'],
    require: ['support/world.ts'],
    format: [
      'progress',
      process.env['CUCUMBER_JSON_REPORT']
        ? `json:${process.env['CUCUMBER_JSON_REPORT']}`
        : 'json:report.json',
    ],
  },
};
