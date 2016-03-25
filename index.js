'use strict';

const _ = require('underscore');
const async = require('async');
const crypto = require('crypto');
const cssEscape = require('css.escape');
const fs = require('fs');
const mkdirp = require('mkdirp');
const path = require('path');
const postcss = require('postcss');

const CACHE = {};
const QUEUES = {};

const DEFAULTS = {
  base: '.',
  debug: false,
  salt: '',
  target: 'class-names.json',
  uidLength: 5,
  debounce: 500
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

const saveTarget = target =>
  fs.readFile(target, 'utf8', (er, currentJson) => {
    const queue = QUEUES[target];
    const cbs = queue.cbs;
    queue.cbs = [];
    const done = er => _.each(cbs, cb => cb(er));

    if (currentJson) {
      const current = JSON.parse(currentJson);
      CACHE[target] = sortKeys(_.extend(current, CACHE[target]));
    }

    const nextJson = JSON.stringify(CACHE[target]);

    if (nextJson === currentJson) return done();

    async.series([
      _.partial(mkdirp, path.dirname(target)),
      _.partial(fs.writeFile, target, nextJson)
    ], done);
  });

const queueSave = (options, cb) => {
  const target = options.target;
  const debounce = options.debounce;
  let queue = QUEUES[target];
  if (!queue) {
    queue = QUEUES[target] = {
      save: _.debounce(_.partial(saveTarget, target), debounce),
      cbs: []
    };
  }
  queue.cbs.push(cb);
  queue.save();
};

const cacheNames = (file, options, names) => {
  const target = options.target;
  let cache = CACHE[target];
  if (!cache) cache = CACHE[target] = {};
  cache[getKey(file.path, options)] = _.isEmpty(names) ? undefined : names;
  CACHE[target] = sortKeys(cache);
};

module.exports = (file, options, cb) => {
  try {
    options = _.extend({}, DEFAULTS, options);

    const sourceAndNames = getSourceAndNames(file, options);

    cacheNames(file, options, sourceAndNames.names);

    const buffer = new Buffer(sourceAndNames.source);
    queueSave(options, _.partial(cb, _, {buffer}));
  } catch (er) {
    if (er instanceof Error) return cb(er);

    // CssSyntaxError doesn't inherit SyntaxError or Error so transfer the
    // pseudo-error's properties onto an actual error.
    return cb(_.extend(new Error(), er));
  }
};
