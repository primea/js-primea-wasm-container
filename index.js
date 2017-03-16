module.exports = class WasmContainer {
  /**
   * The interface API is the api the exposed to interfaces. All queries about
   * the enviroment and call to the kernel go through this API
   */
  constructor (code) {
    this._module = WebAssembly.Module(code)
  }

  static get name () {
    return 'wasm'
  }
  /**
   * Runs the core VM with a given environment and imports
   */
  async run (message, kernel, imports = []) {
    const responses = {}
    /**
     * Builds a import map with an array of given interfaces
     */
    function buildImports (opts, imports) {
      const importMap = {}
      for (const Import of imports) {
        const name = Import.name
        opts.response = responses[name] = {}
        const newInterface = new Import(opts)
        const props = Object.getOwnPropertyNames(Import.prototype)

        // bind the methods to the correct 'this'
        for (const prop of props) {
          newInterface[prop] = newInterface[prop].bind(newInterface)
        }
        importMap[name] = newInterface
      }
      return importMap
    }

    let instance

    const opts = {
      vm: {
        /**
         * adds an aync operation to the operations queue
         */
        pushOpsQueue: (promise, callbackIndex, intefaceCallback) => {
          this._opsQueue = Promise.all([this._opsQueue, promise]).then(values => {
            const result = intefaceCallback(values.pop())
            instance.exports.callback.get(callbackIndex)(result)
          })
        },
        memory: () => {
          return instance.exports.memory.buffer
        }
      },
      kernel: kernel,
      message: message
    }
    const initializedImports = buildImports(opts, imports)
    instance = WebAssembly.Instance(this._module, initializedImports)

    if (instance.exports.main) {
      instance.exports.main()
    }
    await this.onDone()
    return responses
  }

  /**
   * returns a promise that resolves when the wasm instance is done running
   */
  async onDone () {
    let prevOps
    while (prevOps !== this._opsQueue) {
      prevOps = this._opsQueue
      await this._opsQueue
    }
  }
}
