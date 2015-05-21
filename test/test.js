var helper = require('cogs-test-helper');

helper.run({
  'test/prod/config.json': {
    'test/prod/input.css': {
      path: 'test/prod/input.css',
      buffer: helper.getFileBuffer('test/prod/output.css'),
      hash: helper.getFileHash('test/prod/output.css'),
      requires: [{
        path: 'test/prod/input.css',
        hash: helper.getFileHash('test/prod/input.css')
      }],
      links: [{
        path: 'test/prod/input.json',
        hash: helper.getFileHash('test/prod/input.json')
      }],
      globs: []
    },
    'test/error.css': Error
  },
  'test/debug/config.json': {
    'test/debug/input': {
      path: 'test/debug/input',
      buffer: helper.getFileBuffer('test/debug/output.css'),
      hash: helper.getFileHash('test/debug/output.css'),
      requires: [{
        path: 'test/debug/input',
        hash: helper.getFileHash('test/debug/input')
      }],
      links: [{
        path: 'test/debug-target/input.json',
        hash: helper.getFileHash('test/debug-target/input.json')
      }],
      globs: []
    }
  }
});
