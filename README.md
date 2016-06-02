# cogs-transformer-local-css

A local CSS transformer for [Cogs] inspired by [this blog post] and works
similarly to [this webpack loader].

If you haven't read [this blog post], you'll want to do that first. It's a quick
read and it explains the benefits of freeing yourself from the grips of global,
collision-prone CSS class names.

This transformer takes CSS files in, inspects the contained class/id
references, renames them uniquely and stores a map of your human-readable names
in a simple JSON file.

Here's what you'll want to add to your Cogs config...

**cogs.js**

```js
module.exports = {
  ...
  pipe: [
    ...
    {
      name: 'local-css',
      only: 'src/my/css/**/*.css',

      // All of the following options are...optional.
      options: {

        // The base directory to store CSS file paths relative to. Default: '.'
        base: "src/my/css",

        // In debug mode, classes will be prepended with their path and
        // human-readable class name. This is highly recommended for development
        // but should be disabled in production. Default: false
        debug: true,

        // The location to store the JSON class name map.
        // Default: class-names.json
        target: "build/my-class-names-map.json",

        // Should not be necessary, but in the case of multiple projects with
        // identical relative CSS file paths being used on the same page, simply
        // insert a unique salt here to break the hash collision. Default: ''
        salt: 'my-unique-salt',

        // The length of the unique class identifier. The higher the number, the
        // lower the chance for a hash collision. Default: 5
        uidLength: 12,

        // How long to wait (in milliseconds) after a change is made before
        // saving the JSON class name map. Default: 500
        debounce: 1000
      }
    }
    ...
  ]
  ...
}
```

So after this is set up and I run cogs, and assuming I have I'll have a
`build/my-class-names-map.json` file that looks something like...

```json
{
  "one/of/my/css/files": {
    "one-of-my-classes": "abcdef123456",
    "another-class": "zyx123abc456"
  }
}
```

Now we can load/parse this file with anything that supports JSON (everything)
and access the local-css-ified names while references the human-readable class
names we want, **all** without having to sweat global collisions.

[![Build Status]](http://travis-ci.org/caseywebdev/cogs-transformer-local-css)

[Cogs]: https://github.com/caseywebdev/cogs
[Build Status]: https://secure.travis-ci.org/caseywebdev/cogs-transformer-local-css.png
[this webpack loader]: https://github.com/webpack/css-loader
[this blog post]: https://medium.com/seek-ui-engineering/the-end-of-global-css-90d2a4a06284
