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

var SELECTOR = /[.#]-?[a-z_][\w-]*/gi;

var INVALID = /^\d|[+/=]/g;

var getUid = function (file, name, options) {
  var hash = crypto.createHash('md5');
  hash.end(file.path + ':' + name);
  var base64 = hash.read().toString('base64');
  var uid = base64.replace(INVALID, '_').slice(0, options.uidLength);
  return options.debug ? name + '-' + uid : uid;
};

module.exports = function (file, options, cb) {
  options = _.extend({}, DEFAULTS, options);
  try {
    var names = {};

    var source = postcss([function (css) {
      css.eachRule(function (rule) {
        rule.selector = rule.selector.replace(SELECTOR, function (selector) {
          var prefix = selector[0];
          var name = selector.slice(1);
          if (!names[name]) names[name] = getUid(file, name, options);
          return prefix + names[name];
        });
      });
    }]).process(file.buffer.toString()).css;

    var basename = path.basename(file.path);
    var ext = path.extname(basename);
    var target = path.join(
      options.target,
      path.relative(options.base, path.dirname(file.path)),
      (ext ? basename.slice(0, -ext.length) : basename) + '.json'
    );

    async.series([
      _.partial(mkdirp, path.dirname(target)),
      _.partial(fs.writeFile, target, JSON.stringify(names))
    ], function (er) {
      if (er) return cb(er);
      cb(null, {buffer: new Buffer(source), links: file.links.concat(target)});
    });
  } catch (er) { return cb(er); }
};
