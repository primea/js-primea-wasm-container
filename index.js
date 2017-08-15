const ReferanceMap = require('reference-map')
const AbstractContainer = require('primea-abstract-container')
const ContainerTable = require('primea-container-table')

module.exports = class WasmContainer extends AbstractContainer {
  /**
   * The wasm container runs wasm code and provides a basic API for wasm
   * interfaces for interacting with the kernel
   * @param {object} kernel - the kernel instance
   * @param {object} interfaces - a map of interfaces to expose to the wasm binary
   */
  constructor (kernel, interfaces) {
    super()
    this.kernel = kernel
    this.imports = interfaces
    this.referanceMap = new ReferanceMap()
  }

  async onCreation (message) {
    let code = message.data
    if (!WebAssembly.validate(code)) {
      throw new Error('invalid wasm binary')
    } else {
      for (const name in this.imports) {
        const interf = this.imports[name]
        if (interf.initialize) {
          code = await interf.initialize(code)
        }
      }
      this.kernel.state.code = code
    }
    return this._run(message, 'onCreation')
  }

  /**
   * Runs the wasm VM given a message
   * @param {object} message
   * @returns {Promise} a promise that resolves once the compuation is finished
   */
  onMessage (message) {
    return this._run(message, 'onMessage')
  }

  async _run (message, method) {
    // Builds a import map with an array of given interfaces
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

    const result = await WebAssembly.instantiate(this.kernel.state.code, importMap)
    this.instance = result.instance

    // add the message and ports to the refereance map
    const messageRef = this.referanceMap.add(message)

    // runs the wasm code
    this.instance.exports[method](messageRef)
    return this.onDone()
  }

  /**
   * returns a promise that resolves when the wasm instance is done running
   * @returns {Promise}
   */
  async onDone () {
    let prevOps
    while (prevOps !== this._opsQueue) {
      prevOps = this._opsQueue
      await prevOps
    }
    this.referanceMap.clear()
  }

  /**
   * Pushed an async operation to the a promise queue that
   * @returns {Promise} the returned promise resolves in the order the intail
   * operation was pushed to the queue
   */
  pushOpsQueue (promise) {
    this._opsQueue = Promise.all([this._opsQueue, promise])
    return this._opsQueue
  }

  /**
   * executes a callback given an index in the exported callback container
   * @param {integer} cb
   * @param {*} val - a value to return to the callback function
   */
  execute (cb, val) {
    this.instance.exports.callbacks.get(cb)(val)
  }

  /**
   * returns a section of memory from the wasm instance
   * @param {integer} offset
   * @param {integer} length
   * @returns {Uint8Array}
   */
  getMemory (offset, length) {
    return new Uint8Array(this.instance.exports.memory.buffer, offset, length)
  }

  setMemory (offset, val) {
    const mem = this.getMemory(offset, val.length)
    mem.set(val)
  }

  static get typeId () {
    return ContainerTable.WebAssembly
  }
}
