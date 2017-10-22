[![NPM Package](https://img.shields.io/npm/v/primea-wasm-container.svg?style=flat-square)](https://www.npmjs.org/package/primea-wasm-container)
[![Build Status](https://img.shields.io/travis/primea/js-primea-wasm-container.svg?branch=master&style=flat-square)](https://travis-ci.org/primea/js-primea-wasm-container)
[![Coverage Status](https://img.shields.io/coveralls/primea/js-primea-wasm-container.svg?style=flat-square)](https://coveralls.io/primea/js-primea-wasm-container)

[![js-standard-style](https://cdn.rawgit.com/feross/standard/master/badge.svg)](https://github.com/feross/standard)  

# SYNOPSIS 
This implements a wasm container for the ewasm-kernel

# INSTALL
`npm install primea-wasm-container`

# USAGE
```
const WasmContainer = require('primea-wasm-container')

// this class with get instantiated when a new wasm container instance is created
// its methods with be exposed to the wasm binary as `imports`
class HelloWorld {
  test () {
    console.log('hello world!')
  }
}

// regester the container with the a hypervisor instance
hypervisor.registerContainer(WasmContainer, {
  env: HelloWorld 
})

```

# LICENSE
[MPL-2.0](https://tldrlegal.com/license/mozilla-public-license-2.0-(mpl-2))
