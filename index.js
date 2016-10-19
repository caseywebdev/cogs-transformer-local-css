const _ = require('underscore');
const crypto = require('crypto');
const cssEscape = require('css.escape');
const path = require('npath');
const postcss = require('postcss');

const DEFAULTS = {
  base: '.',
  debug: false,
  export: false,
  salt: '',
  uidLength: 5
};

const SELECTOR = /([.#])(-?[a-z_][\w-]*)(?::from\((.*?)\))?/gi;
const QUOTE = /['"]/;

const sortKeys = obj =>
  _.reduce(_.keys(obj).sort(), (memo, key) => {
    memo[key] = obj[key];
    return memo;
  }, {});

const getUid = (filePath, options, name) => {
  const key = getKey(filePath, options) + ':' + name;
  const hash = crypto.createHash('md5');
  hash.end(key + options.salt);
  const uid = hash.read().toString('base64').slice(0, options.uidLength);
  return options.debug ? key + '-' + uid : uid;
};

const replace = (file, options, names, __, prefix, name, from) => {
  if (from === 'global') return prefix + name;
  if (from && QUOTE.test(from[0])) from = from.slice(1, from.length - 2);
  if (from) {
    const base = from[0] === '.' ? path.dirname(file.path) : options.base;
    from = path.resolve(base, from);
    return prefix + cssEscape(getUid(from, options, name));
  }
  if (!names[name]) names[name] = getUid(file.path, options, name);
  return prefix + cssEscape(names[name]);
};

const rename = (replace, css) => {
  css.walkRules(rule =>
    rule.selector = rule.selector.replace(SELECTOR, replace)
  );
};

const getSourceAndNames = (file, options) => {
  const names = {};
  return {
    source: postcss([
      _.partial(rename, _.partial(replace, file, options, names))
    ]).process(file.buffer.toString()).css,
    names: sortKeys(names)
  };
};

const getKey = (filePath, options) => {
  const basename = path.basename(filePath);
  const ext = path.extname(basename);
  return path.join(
    path.relative(options.base, path.dirname(filePath)),
    ext ? basename.slice(0, -ext.length) : basename
  );
};

module.exports = ({file, options}) => {
  try {
    options = _.extend({}, DEFAULTS, options);
    const {names, source} = getSourceAndNames(file, options);
    return {
      buffer: Buffer.from(options.export ? JSON.stringify(names) : source)
    };
  } catch (er) {
    throw er instanceof Error ? er : _.extend(new Error(), er);
  }
};
