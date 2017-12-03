const helper = require('cogs-test-helper');

const test = env => {
  const prefix = `test/${env}/`;
  return ['a', 'b', 'c/c'].reduce(function (memo, l) {
    memo[`${prefix}${l}.css`] = helper.getFileBuffer(`${prefix}${l}.js`);
    return memo;
  }, {'test/error.css': Error});
};

helper.run({
  'test/debug/config.json': test('debug'),
  'test/prod/config.json': test('prod')
});
