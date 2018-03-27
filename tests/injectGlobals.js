const fs = require('fs')
const {wasm2json, json2wasm} = require('wasm-json-toolkit')
const injectGlobals = require('../injectGlobals.js')
const customTypes = require('../customTypes')

const testWasm = fs.readFileSync('./wasm/globals.wasm')
const json = wasm2json(testWasm)
const globals = customTypes.decodeGlobals(json[1].payload)
console.log(globals)

const r = injectGlobals(json, globals)
const rWasm = json2wasm(r)
const mod = WebAssembly.Module(rWasm)
const inst = WebAssembly.Instance(mod)
inst.exports.setter_globals(5, 6)
inst.exports.getter_globals()

const mem = new Uint8Array(inst.exports.memory.buffer, 0, 8)
console.log(mem)
