const {wasm2json} = require('wasm-json-toolkit')
const customTypes = require('../customTypes')
const fs = require('fs')

function main () {
  const wasm = fs.readFileSync('./wasm/funcRef_caller.wasm')
  const json = wasm2json(wasm)
  const output = customTypes.mergeTypeSections(json)
  console.log(JSON.stringify(output, null, 2))
}

main()
