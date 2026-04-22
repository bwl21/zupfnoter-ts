// CommonJS loader for abc2svg-1.js
// abc2svg uses `typeof module=='object'&&typeof exports=='object'` to detect
// CJS environment. We use vm.runInNewContext to provide a fresh module/exports
// context so the check passes regardless of the calling module system.
'use strict'
const vm = require('vm')
const fs = require('fs')
const path = require('path')

const src = fs.readFileSync(path.join(__dirname, 'abc2svg-1.js'), 'utf8')
const ctx = { module: { exports: {} }, exports: {}, require, console }
ctx.module.exports = ctx.exports
vm.runInNewContext(src, ctx)

module.exports = ctx.exports
