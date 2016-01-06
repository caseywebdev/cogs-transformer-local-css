var _ = require('underscore');
var async = require('async');
var crypto = require('crypto');
var cssEscape = require('css.escape');
var fs = require('fs');
var mkdirp = require('mkdirp');
var path = require('path');
var postcss = require('postcss');

var CACHE = {};
var QUEUES = {};

var DEFAULTS = {
  base: '.',
  debug: false,
  salt: '',
  target: 'class-names.json',
  uidLength: 5
};

var SELECTOR = /([.#])(-?[a-z_][\w-]*)(?::from\((.*?)\))?/gi;
var QUOTE = /['"]/;

var sortKeys = function (obj) {
  return _.reduce(_.keys(obj).sort(), function (memo, key) {
    memo[key] = obj[key];
    return memo;
  }, {});
};

var getUid = function (filePath, options, name) {
  var key = getKey(filePath, options) + ':' + name;
  var hash = crypto.createHash('md5');
  hash.end(key + options.salt);
  var uid = hash.read().toString('base64').slice(0, options.uidLength);
  return options.debug ? key + '-' + uid : uid;
};

var replace = function (file, options, names, __, prefix, name, from) {
  if (from === 'global') return prefix + name;
  if (from && QUOTE.test(from[0])) from = from.slice(1, from.length - 2);
  if (from) {
    var base = from[0] === '.' ? path.dirname(file.path) : '';
    from = path.relative('.', path.resolve(base, from));
    return prefix + cssEscape(getUid(from, options, name));
  }
  if (!names[name]) names[name] = getUid(file.path, options, name);
  return prefix + cssEscape(names[name]);
};

var rename = function (replace, css) {
  css.walkRules(function (rule) {
    rule.selector = rule.selector.replace(SELECTOR, replace);
  });
};

var getSourceAndNames = function (file, options) {
  var names = {};
  return {
    source: postcss([
      _.partial(rename, _.partial(replace, file, options, names))
    ]).process(file.buffer.toString()).css,
    names: sortKeys(names)
  };
};

var getKey = function (filePath, options) {
  var basename = path.basename(filePath);
  var ext = path.extname(basename);
  return path.join(
    path.relative(options.base, path.dirname(filePath)),
    ext ? basename.slice(0, -ext.length) : basename
  );
};

var saveTarget = function (target, cb, last) {
  if (!QUEUES[target]) QUEUES[target] = [];
  var queue = QUEUES[target];
  if ((cb && queue.push(cb) > 1) || !queue.length) return;

  var next = JSON.stringify(CACHE[target]);
  var done = function (er) {
    queue.shift()(er);
    saveTarget(target, null, next);
  };
  if (last === next) return done();

  fs.readFile(target, 'utf8', function (er, current) {
    if (current === next) return done();

    async.series([
      _.partial(mkdirp, path.dirname(target)),
      _.partial(fs.writeFile, target, next)
    ], done);
  });
};

var cacheNames = function (file, options, names) {
  var target = options.target;
  var cache = CACHE[target];
  if (!cache) cache = CACHE[target] = {};
  cache[getKey(file.path, options)] = _.isEmpty(names) ? undefined : names;
  CACHE[target] = sortKeys(cache);
};

module.exports = function (file, options, cb) {
  try {
    options = _.extend({}, DEFAULTS, options);

    var sourceAndNames = getSourceAndNames(file, options);

    var done = function (er) {
      if (er) return cb(er);
      cb(null, {buffer: new Buffer(sourceAndNames.source)});
    };

    cacheNames(file, options, sourceAndNames.names);
    saveTarget(options.target, done);
  } catch (er) {
    if (er instanceof Error) return cb(er);

    // CssSyntaxError doesn't inherit SyntaxError or Error so transfer the
    // pseudo-error's properties onto an actual error.
    return cb(_.extend(new Error(), er));
  }
};
