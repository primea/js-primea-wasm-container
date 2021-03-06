const { ID, Message, FunctionRef, ModuleRef, ActorRef, getType } = require('primea-objects')
const { toJSON } = require('primea-objects/utils')
const { wasm2json, json2wasm } = require('wasm-json-toolkit')
const annotations = require('primea-annotations')
const persist = require('wasm-persist')
const wasmMetering = require('wasm-metering')
const ReferenceMap = require('reference-map')
const typeCheckWrapper = require('./typeCheckWrapper.js')

const Debug = require('debug')
const debug = [
  'lifecycle:createModule',
  'api:call internalized',
  'api:func.externalize',
  'api:func.internalize',
  'api:link.wrap',
  'api:link.unwrap',
  'api:module.new',
  'api:actor.new',
  'api:actor.export',
  'api:actor.is_instance',
  'api:actor.self',
  'api:data.externalize',
  'api:data.internalize',
  'api:data.length',
  'api:elem.externalize',
  'api:elem.internalize',
  'api:elem.length'
].reduce((acc, curr) => {
  acc[curr] = Debug(curr)
  return acc
}, {})

const nativeTypes = new Set(['i32', 'i64', 'f32', 'f64'])
const METERING_FUNC_INDEX_OFFSET = 1

function getWasmExports (json) {
  const exports = {}
  for (const ex in json.exports) {
    const type = json.types[json.indexes[json.exports[ex].toString()]].params
    exports[ex] = type
  }
  return exports
}

function generateWrapper (funcRef, container) {
  // if wrapper is cached, this saves the container context
  funcRef.getContainer = () => container

  // check if the wrapper has been generated
  if (funcRef.wrapper) {
    return funcRef.wrapper
  }
  if (funcRef.params == null) {
    throw new Error('invalid funcRef')
  }
  let wrapper = typeCheckWrapper(funcRef.params)
  const wasm = json2wasm(wrapper)
  const mod = new WebAssembly.Module(wasm)
  const self = funcRef
  wrapper = new WebAssembly.Instance(mod, {
    'env': {
      'checkTypes': function () {
        const container = funcRef.getContainer()

        debug['api:call internalized'](`by ${container.actorSelf.id}`)
        debug['api:call internalized'](self.toJSON())

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
          debug['api:func.externalize'](`by ${self.actorSelf.id.toJSON()} (index=${index})`)
          if (!self.instance.exports.table) {
            throw new Error('no table exported')
          }

          const func = self.instance.exports.table.get(index)
          debug['api:func.externalize'](func)
          const object = func.object
          if (object) {
            // externalize a previously internalized function
            return self.refs.add(object)
          } else {
            // if metering, indexes are offset by 1
            const offset = this.actor.hypervisor.meter ? METERING_FUNC_INDEX_OFFSET : 0
            const params = self.json.types[self.json.indexes[func.name - offset]].params
            const ref = new FunctionRef({
              identifier: [true, func.tableIndex],
              params,
              actorId: self.actor.id
            })
            debug['api:func.externalize'](ref.toJSON())
            return self.refs.add(ref, 'func')
          }
        },
        internalize: (index, ref) => {
          debug['api:func.internalize'](`by ${self.actorSelf.id.toJSON()} (index=${index}, ref=${ref})`)
          const funcRef = self.refs.get(ref, 'func')
          debug['api:func.internalize'](funcRef.toJSON())
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
          debug['api:link.wrap'](`by ${self.actorSelf.id.toJSON()} (ref=${ref})`)
          const obj = self.refs.get(ref)
          const link = {'/': obj}
          debug['api:link.wrap'](link)
          return self.refs.add(link, 'link')
        },
        unwrap: async (ref, cb) => {
          debug['api:link.unwrap'](`by ${self.actorSelf.id.toJSON()} (ref=${ref})`)
          const link = self.refs.get(ref, 'link')
          const promise = self.actor.tree.graph.tree(link)
          await self.pushOpsQueue(promise)
          debug['api:link.unwrap'](`by ${self.actorSelf.id.toJSON()}`)
          debug['api:link.unwrap'](link)
          const obj = link['/']
          const linkRef = self.refs.add(obj, getType(obj))
          self.instance.exports.table.get(cb)(linkRef)
        }
      },
      module: {
        new: dataRef => {
          debug['api:module.new'](`by ${self.actorSelf.id.toJSON()} (dataRef=${dataRef})`)
          const bin = self.refs.get(dataRef, 'data')
          const mod = self.actor.createModule(WasmContainer, bin)
          debug['api:module.new'](mod.toJSON(false))
          return self.refs.add(mod, 'mod')
        }
      },
      actor: {
        new: modRef => {
          debug['api:actor.new'](`by ${self.actorSelf.id.toJSON()} (modRef=${modRef})`)
          const module = self.refs.get(modRef, 'mod')
          debug['api:actor.new'](module.toJSON(false))
          const actor = self.actor.createActor(module)
          debug['api:actor.new'](actor.toJSON(false))
          return self.refs.add(actor, 'actor')
        },
        export: (actorRef, dataRef) => {
          debug['api:actor.export'](`by ${self.actorSelf.id.toJSON()} (actorRef=${actorRef}, dataRef=${dataRef})`)
          const actor = self.refs.get(actorRef, 'actor')
          let name = self.refs.get(dataRef, 'data')
          name = Buffer.from(name).toString()
          const funcRef = actor.getFuncRef(name)
          debug['api:actor.export'](funcRef.toJSON())
          return self.refs.add(funcRef, 'func')
        },
        is_instance: (actorRef, modRef) => {
          debug['api:actor.is_instance'](`by ${self.actorSelf.id.toJSON()} (actorRef=${actorRef}, modRef=${modRef})`)
          const actor = self.refs.get(actorRef, 'actor')
          debug['api:actor.is_instance'](actor.toJSON(false))
          const module = self.refs.get(modRef, 'mod')
          debug['api:actor.is_instance'](module.toJSON(false))
          return actor.modRef.id.id.equals(module.id.id)
        },
        self: () => {
          debug['api:actor.self'](this.actorSelf.toJSON(false))
          return self.refs.add(this.actorSelf, 'actor')
        }
      },
      data: {
        externalize: (index, length) => {
          debug['api:data.externalize'](`by ${self.actorSelf.id.toJSON()} (index=${index}, length=${length})`)
          length = Math.max(0, length)
          const data = Buffer.from(this.get8Memory(index, length))
          debug['api:data.externalize'](toJSON(data))
          return self.refs.add(data, 'data')
        },
        internalize: (sinkOffset, length, dataRef, srcOffset) => {
          debug['api:data.internalize'](`by ${self.actorSelf.id.toJSON()} (sinkOffset=${sinkOffset}, length=${length}, dataRef=${dataRef}, srcOffset=${srcOffset})`)
          let data = self.refs.get(dataRef, 'data')
          debug['api:data.internalize'](toJSON(data))
          length = Math.min(Math.max(0, length), data.length)
          data = data.subarray(srcOffset, srcOffset + length)
          const mem = self.get8Memory(sinkOffset, data.length)
          mem.set(data)
        },
        length (dataRef) {
          debug['api:data.length'](`by ${self.actorSelf.id.toJSON()} (dataRef=${dataRef})`)
          let data = self.refs.get(dataRef, 'data')
          debug['api:data.length'](toJSON(data))
          return data.length
        }
      },
      elem: {
        externalize: (index, length) => {
          debug['api:elem.externalize'](`by ${self.actorSelf.id.toJSON()} (index=${index}, length=${length})`)
          const mem = Buffer.from(this.get8Memory(index, length * 4))
          const objects = []
          while (length--) {
            const ref = mem.readUInt32LE(length * 4)
            const obj = self.refs.get(ref)
            objects.unshift(obj)
          }
          debug['api:elem.externalize'](toJSON(objects, false))
          return this.refs.add(objects, 'elem')
        },
        internalize: (sinkOffset, length, elemRef, srcOffset) => {
          debug['api:elem.internalize'](`by ${self.actorSelf.id.toJSON()} (sinkOffset=${sinkOffset}, length=${length}, elemRef=${elemRef}, srcOffset=${srcOffset})`)
          let table = self.refs.get(elemRef, 'elem')
          length = Math.min(Math.max(0, length), table.length)
          const buf = table.slice(srcOffset, srcOffset + length).map(obj => self.refs.add(obj, getType(obj)))
          debug['api:elem.internalize'](toJSON(buf, false))
          const mem = self.get32Memory(sinkOffset, length)
          mem.set(buf)
        },
        length (elemRef) {
          debug['api:elem.length'](`by ${self.actorSelf.id.toJSON()} (elemRef=${elemRef})`)
          let elem = self.refs.get(elemRef, 'elem')
          debug['api:elem.length'](toJSON(elem, false))
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

  static createModule (wasm, meter = true) {
    if (!WebAssembly.validate(wasm)) {
      throw new Error('invalid wasm binary')
    }

    let moduleJSON = wasm2json(wasm)
    const json = annotations.mergeTypeSections(moduleJSON)

    if (meter) {
      moduleJSON = wasmMetering.meterJSON(moduleJSON, {
        meterType: 'i32'
      })
      // recompile the wasm
      wasm = json2wasm(moduleJSON)
    }

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
        if (!nativeTypes.has(entry.type)) {
          return []
        }
      })
    }
  }

  static onCreation (...args) {
    return this.createModule(...args)
  }

  async onMessage (message) {
    this.funcRef = message.funcRef
    this.instance = new WebAssembly.Instance(this.mod, this.interface)
    const state = this.json.persist.map((entry, index) => {
      const obj = this.actor.storage[index]
      if (!nativeTypes.has(entry.type)) {
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

    if (this.funcRef.params == null) {
      throw new Error(`function "${this.funcRef.identifier[1]}" not found`)
    }
    if (this.funcRef.params.length > message.funcArguments.length) {
      throw new Error(`argument mismatch, want: [${this.funcRef.params}]`)
    }

    // import references
    let index = 0
    const args = []

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
      if (!nativeTypes.has(entry.type)) {
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
    const {json, wasm, exports, state} = WasmContainer.createModule(code, this.actor.hypervisor.meter)
    this.mod = new WebAssembly.Module(wasm)
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
