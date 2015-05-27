var _ = require('underscore');
var async = require('async');
var crypto = require('crypto');
var fs = require('fs');
var mkdirp = require('mkdirp');
var path = require('path');
var postcss = require('postcss');

var DEFAULTS = {
  base: '.',
  debug: false,
  target: '.',
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
    remote = path.join(options.base, remote);
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

var getTarget = function (file, options) {
  var basename = path.basename(file.path);
  var ext = path.extname(basename);
  return path.join(
    options.target,
    path.relative(options.base, path.dirname(file.path)),
    (ext ? basename.slice(0, -ext.length) : basename) + '.json'
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
    var target = getTarget(file, options);
    saveTarget(target, JSON.stringify(sourceAndNames.names), function (er) {
      if (er) return cb(er);
      cb(null, {
        buffer: new Buffer(sourceAndNames.source),
        links: file.links.concat(target)
      });
    });
  } catch (er) { return cb(er); }
};
