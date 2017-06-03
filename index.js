const ReferanceMap = require('./referanceMap.js')

module.exports = class WasmContainer {
  /**
   * The interface API is the api the exposed to interfaces. All queries about
   * the enviroment and call to the kernel go through this API
   */
  constructor (exoInterface, imports) {
    this.exoInterface = exoInterface
    this.imports = imports
    this.referanceMap = new ReferanceMap()
  }

  /**
   * Runs the core VM with a given environment and imports
   */
  async run (message) {
    /**
     * Builds a import map with an array of given interfaces
     */
    const importMap = {}
    for (const name in this.imports) {
      importMap[name] = {}
      const Import = this.imports[name]
      const newInterface = new Import(this)
      const props = Object.getOwnPropertyNames(Import.prototype)

      // bind the methods to the correct 'this'
      for (const prop of props) {
        if (prop !== 'constructor') {
          importMap[name][prop] = newInterface[prop].bind(newInterface)
        }
      }
    }

    const result = await WebAssembly.instantiate(this.exoInterface.state['/'].code, importMap)
    this.instance = result.instance
    if (this.instance.exports.main) {
      this.instance.exports.main()
    }
    return this.onDone()
  }

  /**
   * returns a promise that resolves when the wasm instance is done running
   */
  async onDone () {
    let prevOps
    while (prevOps !== this._opsQueue) {
      prevOps = this._opsQueue
      await prevOps
    }
    this.referanceMap.clear()
  }

  pushOpsQueue (promise) {
    this._opsQueue = Promise.all([this._opsQueue, promise])
    return this._opsQueue
  }

  get memory () {
    return this.instance.exports.memory.buffer
  }

  getMemory (offset, length) {
    return new Uint8Array(this.memory, offset, length)
  }

  static createState (wasm) {
    return {
      nonce: [0],
      ports: {},
      code: wasm
    }
  }
}
