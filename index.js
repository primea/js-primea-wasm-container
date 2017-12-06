const ReferanceMap = require('reference-map')
const AbstractContainer = require('primea-abstract-container')
const ContainerTable = require('primea-container-table')
const RadixTree = require('dfinity-radix-tree')

const CODEKEY = new RadixTree.ArrayConstructor([1])

module.exports = class WasmContainer extends AbstractContainer {
  /**
   * The wasm container runs wasm code and provides a basic API for wasm
   * interfaces for interacting with the actor
   * @param {object} actor - the actor instance
   * @param {object} interfaces - a map of interfaces to expose to the wasm binary
   */
  constructor (actor, interfaces) {
    super(actor)
    this.referanceMap = new ReferanceMap()

    // hold the interfaces `initailize` functions, if any
    this.initializeFuncs = []
    // Builds a import map with an array of given interfaces
    this.importMap = {}
    for (const name in interfaces) {
      this.importMap[name] = {}
      const Interface = interfaces[name]
      if (Interface.initialize) {
        this.initializeFuncs.push(Interface.initialize)
      }
      const newInterface = new Interface(this)
      const props = Object.getOwnPropertyNames(Interface.prototype)

      // bind the methods to the correct 'this'
      for (const prop of props) {
        if (prop !== 'constructor') {
          this.importMap[name][prop] = newInterface[prop].bind(newInterface)
        }
      }
    }
  }

  async onCreation (message) {
    let code = message.data
    if (!WebAssembly.validate(code)) {
      throw new Error('invalid wasm binary')
    } else {
      await Promise.all(this.initializeFuncs.map(initFunc => initFunc(code)))
      this.actor.state.set(CODEKEY, code)
    }
    return this._run(message, 'onCreation')
  }

  /**
   * Runs the wasm VM given a message
   * @param {object} message
   * @returns {Promise} a promise that resolves once the compuation is finished
   */
  onMessage (message, method = 'onMessage') {
    return this._run(message, method)
  }

  async _run (message, method) {
    const code = await this.actor.state.get(CODEKEY)
    const result = await WebAssembly.instantiate(code, this.importMap)
    this.instance = result.instance
    if (this.instance.exports[method]) {
      // add the message and ports to the refereance map
      const messageRef = this.referanceMap.add(message)

      // runs the wasm code
      this.instance.exports[method](messageRef)
      await this.onDone()
      this.referanceMap.clear()
    }
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
