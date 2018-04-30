const { ID, Message, FunctionRef, ModuleRef, ActorRef, getType } = require('primea-objects')
const { wasm2json, json2wasm } = require('wasm-json-toolkit')
const annotations = require('primea-annotations')
const persist = require('wasm-persist')
const wasmMetering = require('wasm-metering')
const ReferenceMap = require('reference-map')
const typeCheckWrapper = require('./typeCheckWrapper.js')

const nativeTypes = new Set(['i32', 'i64', 'f32', 'f64'])
const FUNC_INDEX_OFFSET = 1

function getWasmExports (json) {
  const exports = {}
  for (const ex in json.exports) {
    const type = json.types[json.indexes[json.exports[ex].toString()]].params
    exports[ex] = type
  }
  return exports
}

function generateWrapper (funcRef, container) {
  // check if the wrapper has been generated
  if (funcRef.wrapper) {
    return funcRef.wrapper
  }
  if (funcRef.params == null) {
    throw new Error('invalid funcRef')
  }
  let wrapper = typeCheckWrapper(funcRef.params)
  const wasm = json2wasm(wrapper)
  const mod = WebAssembly.Module(wasm)
  const self = funcRef
  wrapper = WebAssembly.Instance(mod, {
    'env': {
      'checkTypes': function () {
        const args = [...arguments]
        const checkedArgs = []
        while (args.length) {
          const type = annotations.LANGUAGE_TYPES_BIN[args.shift()]
          let arg = args.shift()
          if (!nativeTypes.has(type)) {
            arg = container.refs.get(arg)
            checkedArgs.push(arg)
          } else if (type === 'i64') {
            checkedArgs.push(arg)
            checkedArgs.push(args.shift())
          } else {
            checkedArgs.push(arg)
          }
        }
        const message = new Message({
          funcRef: self,
          funcArguments: checkedArgs
        })
        container.actor.send(message)
      }
    }
  })
  // cache the wrapper
  funcRef.wrapper = wrapper
  wrapper.exports.check.object = funcRef
  return wrapper
}

module.exports = class WasmContainer {
  constructor (actor) {
    this.actor = actor
    this.refs = new ReferenceMap()
    this._opsQueue = Promise.resolve()
    const self = this
    this.interface = {
      func: {
        externalize: index => {
          if (!self.instance.exports.table) {
            throw new Error('no table exported')
          }

          const func = self.instance.exports.table.get(index)
          const object = func.object
          if (object) {
            // externalize a pervously internalized function
            return self.refs.add(object)
          } else {
            const params = self.json.types[self.json.indexes[func.name - FUNC_INDEX_OFFSET]].params
            const ref = new FunctionRef({
              identifier: [true, func.tableIndex],
              params,
              actorID: self.actor.id
            })
            return self.refs.add(ref, 'func')
          }
        },
        internalize: (index, ref) => {
          const funcRef = self.refs.get(ref, 'func')
          const wrapper = generateWrapper(funcRef, self)
          self.instance.exports.table.set(index, wrapper.exports.check)
        },
        get_gas_budget: funcRef => {
          const func = self.refs.get(funcRef, 'func')
          return func.gas
        },
        set_gas_budget: (funcRef, amount) => {
          const func = self.refs.get(funcRef, 'func').copy()
          func.gas = amount
          return self.refs.add(func, 'func')
        }
      },
      link: {
        wrap: ref => {
          const obj = self.refs.get(ref)
          const link = {'/': obj}
          return self.refs.add(link, 'link')
        },
        unwrap: async (ref, cb) => {
          const link = self.refs.get(ref, 'link')
          const promise = self.actor.tree.graph.tree(link)
          await self.pushOpsQueue(promise)
          const obj = link['/']
          const linkRef = self.refs.add(obj, getType(obj))
          self.instance.exports.table.get(cb)(linkRef)
        }
      },
      module: {
        new: dataRef => {
          const bin = self.refs.get(dataRef, 'data')
          const mod = self.actor.createModule(WasmContainer, bin)
          return self.refs.add(mod, 'mod')
        }
      },
      actor: {
        new: modRef => {
          const module = self.refs.get(modRef, 'mod')
          const actor = self.actor.createActor(module)
          return self.refs.add(actor, 'actor')
        },
        export: (actorRef, dataRef) => {
          const actor = self.refs.get(actorRef, 'actor')
          let name = self.refs.get(dataRef, 'data')
          name = Buffer.from(name).toString()
          const funcRef = actor.getFuncRef(name)
          return self.refs.add(funcRef, 'func')
        },
        is_instance: (actorRef, modRef) => {
          const actor = self.refs.get(actorRef, 'actor')
          const module = self.refs.get(modRef, 'mod')
          return actor.modRef.id.id.equals(module.id.id)
        },
        self: () => {
          return self.refs.add(this.actorSelf, 'actor')
        }
      },
      data: {
        externalize: (index, length) => {
          const data = Buffer.from(this.get8Memory(index, length))
          return self.refs.add(data, 'data')
        },
        internalize: (sinkOffset, length, dataRef, srcOffset) => {
          let data = self.refs.get(dataRef, 'data')
          data = data.subarray(srcOffset, length)
          const mem = self.get8Memory(sinkOffset, data.length)
          mem.set(data)
        },
        length (dataRef) {
          let data = self.refs.get(dataRef, 'data')
          return data.length
        }
      },
      elem: {
        externalize: (index, length) => {
          const mem = Buffer.from(this.get8Memory(index, length * 4))
          const objects = []
          while (length--) {
            const ref = mem.readUInt32LE(length * 4)
            const obj = self.refs.get(ref)
            objects.unshift(obj)
          }
          return this.refs.add(objects, 'elem')
        },
        internalize: (sinkOffset, length, elemRef, srcOffset) => {
          let table = self.refs.get(elemRef, 'elem')
          const buf = table.slice(srcOffset, srcOffset + length).map(obj => self.refs.add(obj, getType(obj)))
          const mem = self.get32Memory(sinkOffset, length)
          mem.set(buf)
        },
        length (elemRef) {
          let elem = self.refs.get(elemRef, 'elem')
          return elem.length
        }
      },
      metering: {
        usegas: amount => {
          self.actor.incrementTicks(amount)
        }
      }
    }
  }

  static createModule (wasm) {
    if (!WebAssembly.validate(wasm)) {
      throw new Error('invalid wasm binary')
    }

    let moduleJSON = wasm2json(wasm)
    const json = annotations.mergeTypeSections(moduleJSON)
    moduleJSON = wasmMetering.meterJSON(moduleJSON, {
      meterType: 'i32'
    })

    // recompile the wasm
    wasm = json2wasm(moduleJSON)
    const globals = []
    json.persist.map(global => global.index).forEach(index => {
      globals[index] = true
    })

    wasm = persist.prepare(wasm, {
      memory: false,
      table: false,
      globals
    })
    const exports = getWasmExports(json)
    return {
      wasm,
      json,
      exports,
      state: json.persist.map(entry => {
        if (entry.type === 'anyref') {
          return []
        }
      })
    }
  }

  static onCreation (unverifiedWasm) {
    return this.createModule(unverifiedWasm)
  }

  async onMessage (message) {
    this.funcRef = message.funcRef
    this.instance = WebAssembly.Instance(this.mod, this.interface)
    const state = this.json.persist.map((entry, index) => {
      const obj = this.actor.storage[index]
      if (entry.type === 'anyref') {
        return this.refs.add(obj, getType(obj))
      } else {
        return obj
      }
    })
    persist.resume(this.instance, {globals: state, symbol: '_'})
    // map table indexes
    const table = this.instance.exports.table
    if (table) {
      let length = table.length
      while (length--) {
        const func = table.get(length)
        if (func) {
          func.tableIndex = length
        }
      }
    }
    // import references
    let index = 0
    const args = []

    if (this.funcRef.params == null) {
      throw new Error(`function "${this.funcRef.identifier[1]}" not found`)
    }
    if (this.funcRef.params.length > message.funcArguments) {
      throw new Error(`argument mismatch, want: [${this.funcRef.params}]`)
    }
    this.funcRef.params.forEach(type => {
      const arg = message.funcArguments[index]
      if (nativeTypes.has(type)) {
        args.push(arg)
        if (type === 'i64') {
          args.push(message.funcArguments[++index])
        }
      } else {
        args.push(this.refs.add(arg, getType(arg)))
      }
      index++
    })

    // call entrypoint function
    let wasmFunc
    if (this.funcRef.identifier[0]) {
      wasmFunc = this.instance.exports.table.get(this.funcRef.identifier[1])
    } else {
      wasmFunc = this.instance.exports[this.funcRef.identifier[1]]
    }

    const wrapper = generateWrapper(this.funcRef)
    wrapper.exports.table.set(0, wasmFunc)
    wrapper.exports.invoke(...args)
    await this.onDone()
    // hibernate the wasm instance
    let postState = persist.hibernate(this.instance)
    // map the ints to objects
    this.actor.storage = this.json.persist.map((entry, index) => {
      const i = postState.globals[index]
      if (entry.type === 'anyref') {
        return this.refs.get(i)
      } else {
        return i
      }
    })
    this.refs.clear()
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

  async onStartup () {
    const module = this.actor.module
    const code = module[1][1]['/']
    const {json, wasm, exports, state} = WasmContainer.createModule(code)
    this.mod = WebAssembly.Module(wasm)
    this.json = json
    const moduleID = new ID(module[1][0])
    const modRef = new ModuleRef(moduleID, WasmContainer.typeId, exports, state, code)
    this.actorSelf = new ActorRef(this.actor.id, modRef)
  }

  get8Memory (offset, length) {
    if (!this.instance.exports.memory) {
      throw new Error('no memory exported')
    }
    try {
      return new Uint8Array(this.instance.exports.memory.buffer, offset, length)
    } catch (e) {
      throw new Error(`invalid memory range (offset=${offset}, length=${length})`)
    }
  }

  get32Memory (offset, length) {
    if (!this.instance.exports.memory) {
      throw new Error('no memory exported')
    }
    try {
      return new Uint32Array(this.instance.exports.memory.buffer, offset, length)
    } catch (e) {
      throw new Error(`invalid memory range (offset=${offset}, length=${length})`)
    }
  }

  static get typeId () {
    return 9
  }
}
