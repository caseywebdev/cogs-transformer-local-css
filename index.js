const _ = require('underscore');
const CleanCSS = require('clean-css');
const crypto = require('crypto');
const cssEscape = require('css.escape');
const path = require('npath');
const postcss = require('postcss');

const DEFAULTS = {
  base: '.',
  debug: false,
  rename: true,
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
  const key = `${getKey(filePath, options)}:${name}`;
  const hash = crypto.createHash('md5');
  hash.end(key + options.salt);
  const uid = hash.read().toString('base64').slice(0, options.uidLength);
  return options.debug ? `${key}-${uid}` : uid;
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

const rename = (replace, css) =>
  css.walkRules(rule =>
    rule.selector = rule.selector.replace(SELECTOR, replace)
  );

const getKey = (filePath, options) => {
  const basename = path.basename(filePath);
  const ext = path.extname(basename);
  return path.join(
    path.relative(options.base, path.dirname(filePath)),
    ext ? basename.slice(0, -ext.length) : basename
  );
};

module.exports = ({file, options}) => {
  options = _.extend({}, DEFAULTS, options);
  const names = {};
  let source = file.buffer.toString();

  if (options.rename) {
    try {
      source = postcss([
        _.partial(rename, _.partial(replace, file, options, names))
      ]).process(source).css;
    } catch (er) {
      throw er instanceof Error ? er : _.extend(new Error(), er);
    }
  }

  if (!options.debug) {
    const minified = (new CleanCSS(options)).minify(source);
    const errorMessage = minified.errors.concat(minified.warnings).join('\n');
    if (errorMessage) throw new Error(errorMessage);

    source = minified.styles;
  }

  return {
    buffer: Buffer.from(
      'const style = document.createElement("style");\n' +
      `style.innerHTML = ${JSON.stringify(source)};\n` +
      'document.head.appendChild(style);\n' +
      `export default ${JSON.stringify(sortKeys(names))};\n`
    )
  };
};
