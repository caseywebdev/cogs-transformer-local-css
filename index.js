var _ = require('underscore');
var async = require('async');
var crypto = require('crypto');
var fs = require('fs');
var mkdirp = require('mkdirp');
var path = require('path');
var postcss = require('postcss');

var CACHE = {};

var DEFAULTS = {
  base: '.',
  debug: false,
  target: 'class-names.json',
  uidLength: 5
};

var SELECTOR = /([.#])(-?[a-z_][\w-]*)(?::from\((?:'(.+?)'|"(.+?)"|.*?)\))?/gi;

var INVALID = /^\d|[+/=]/g;

var getUid = function (filePath, options, name) {
  var hash = crypto.createHash('md5');
  hash.end(filePath + ':' + name);
  var base64 = hash.read().toString('base64');
  var uid = base64.replace(INVALID, '_').slice(0, options.uidLength);
  return options.debug ? name + '-' + uid : uid;
};

var replace = function (file, options, names, __, prefix, name, pathA, pathB) {
  var remote = pathA || pathB;
  if (remote) {
    var base = remote[0] === '.' ? path.dirname(file.path) : '';
    remote = path.relative('.', path.resolve(base, remote));
    return prefix + getUid(remote, options, name);
  }
  if (!names[name]) names[name] = getUid(file.path, options, name);
  return prefix + names[name];
};

var rename = function (replace, css) {
  css.eachRule(function (rule) {
    rule.selector = rule.selector.replace(SELECTOR, replace);
  });
};

var getSourceAndNames = function (file, options) {
  var names = {};
  return {
    source: postcss([
      _.partial(rename, _.partial(replace, file, options, names))
    ]).process(file.buffer.toString()).css,
    names: names
  };
};

var getKey = function (file, options) {
  var basename = path.basename(file.path);
  var ext = path.extname(basename);
  return path.join(
    path.relative(options.base, path.dirname(file.path)),
    ext ? basename.slice(0, -ext.length) : basename
  );
};

var saveTarget = function (target, json, cb) {
  fs.readFile(target, 'utf8', function (er, data) {
    if (data === json) return cb();
    async.series([
      _.partial(mkdirp, path.dirname(target)),
      _.partial(fs.writeFile, target, json)
    ], cb);
  });
};

module.exports = function (file, options, cb) {
  try {
    options = _.extend({}, DEFAULTS, options);
    var sourceAndNames = getSourceAndNames(file, options);
    var target = options.target;
    var cache = CACHE[target];
    if (!cache) cache = CACHE[target] = {};
    cache[getKey(file, options)] = sourceAndNames.names;
    saveTarget(target, JSON.stringify(cache), function (er) {
      if (er) return cb(er);
      cb(null, {buffer: new Buffer(sourceAndNames.source)});
    });
  } catch (er) { return cb(er); }
};
