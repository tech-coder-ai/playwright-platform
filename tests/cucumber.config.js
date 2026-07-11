module.exports = {
  default: {
    requireModule: ['tsx/cjs'],
    require: ['support/world.ts'],
    format: [
      'progress',
      // Quote the path: Windows report paths contain a drive-letter colon
      // (C:\...) which is ambiguous in cucumber's format descriptor syntax.
      process.env['CUCUMBER_JSON_REPORT']
        ? `json:"${process.env['CUCUMBER_JSON_REPORT']}"`
        : 'json:report.json',
    ],
  },
};
