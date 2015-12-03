var helper = require('cogs-test-helper');

var test = function (env) {
  var prefix = 'test/' + env + '/';
  return ['a', 'b', 'c'].reduce(function (memo, l) {
    memo[prefix + l + '.css'] = {
      path: prefix + l + '.css',
      buffer: helper.getFileBuffer(prefix + l + '-out.css'),
      hash: helper.getFileHash(prefix + l + '-out.css'),
      requires: [{
        path: prefix + l + '.css',
        hash: helper.getFileHash(prefix + l + '.css')
      }],
      links: [],
      globs: []
    };
    return memo;
  }, {'test/error.css': Error});
};

helper.run({
  'test/debug/config.json': test('debug'),
  'test/prod/config.json': test('prod')
});
