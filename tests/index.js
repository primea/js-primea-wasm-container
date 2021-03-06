const tape = require('tape')
const fs = require('fs')
const path = require('path')
const Buffer = require('safe-buffer').Buffer
const {Message, FunctionRef} = require('primea-objects')
const Hypervisor = require('primea-hypervisor')
const EgressDriver = require('primea-hypervisor/egressDriver')
const WasmContainer = require('../')

const level = require('level-browserify')
const RadixTree = require('dfinity-radix-tree')

const db = level(`${__dirname}/testdb`)
const WASM_PATH = path.join(__dirname, 'wasm')

let tester

class TestWasmModule extends WasmContainer {
  constructor (actor) {
    super(actor)
    this._storage = new Map()
    const self = this
    const inter = {
      test: {
        check: (a, b) => {
          tester.equals(a, b)
        },
        print: (dataRef) => {
          let buf = self.refs.get(dataRef, 'data')
          console.log(buf.toString())
        }
      }
    }
    this.interface = Object.assign(this.interface, inter)
  }
}

tape('i64', async t => {
  t.plan(1)
  tester = t
  const tree = new RadixTree({db})
  let wasm = fs.readFileSync(WASM_PATH + '/i64.wasm')

  const hypervisor = new Hypervisor({
    tree,
    modules: [TestWasmModule]
  })

  const actorRef = await hypervisor.newActor(TestWasmModule, wasm)
  const funcRef = actorRef.getFuncRef('main')
  funcRef.gas = 322000

  const message = new Message({
    funcRef
  })
  hypervisor.send(message)
})

tape('get_gas_budget', async t => {
  t.plan(2)
  tester = t
  const tree = new RadixTree({db})
  let wasm = fs.readFileSync(WASM_PATH + '/get_gas_budget.wasm')

  const hypervisor = new Hypervisor({
    tree,
    modules: [TestWasmModule]
  })

  const actorRef = await hypervisor.newActor(TestWasmModule, wasm)
  const funcRef = actorRef.getFuncRef('main')
  funcRef.gas = 322000

  const message = new Message({
    funcRef
  })
  hypervisor.send(message)
})

tape('reinternalizing', async t => {
  t.plan(1)
  tester = t
  const tree = new RadixTree({db})
  let wasm = fs.readFileSync(WASM_PATH + '/reinternalize.wasm')

  const hypervisor = new Hypervisor({
    tree,
    modules: [TestWasmModule]
  })

  const actorRef = await hypervisor.newActor(TestWasmModule, wasm)
  const funcRef = actorRef.getFuncRef('main')
  funcRef.gas = 322000

  const message = new Message({
    funcRef
  })
  hypervisor.send(message)
})

tape('basic', async t => {
  t.plan(1)
  tester = t

  const tree = new RadixTree({
    db
  })

  const wasm = fs.readFileSync(WASM_PATH + '/reciever.wasm')

  const hypervisor = new Hypervisor({
    tree,
    modules: [TestWasmModule]
  })

  const actorRef = await hypervisor.newActor(TestWasmModule, wasm)
  const funcRef = actorRef.getFuncRef('receive')
  funcRef.gas = 3000

  const message = new Message({
    funcRef,
    funcArguments: [5]
  })
  hypervisor.send(message)
})

tape('two communicating actors', async t => {
  t.plan(1)
  tester = t

  const tree = new RadixTree({db})

  const recieverWasm = fs.readFileSync(WASM_PATH + '/reciever.wasm')
  const callerWasm = fs.readFileSync(WASM_PATH + '/caller.wasm')

  const hypervisor = new Hypervisor({
    tree,
    modules: [TestWasmModule]
  })

  const receiverActorRef = await hypervisor.newActor(TestWasmModule, recieverWasm)
  const callerActorRef = await hypervisor.newActor(TestWasmModule, callerWasm)
  const callFuncRef = callerActorRef.getFuncRef('call')
  const recvFuncRef = receiverActorRef.getFuncRef('receive')
  callFuncRef.gas = 100000
  recvFuncRef.gas = 1000
  const message = new Message({
    funcRef: callFuncRef,
    funcArguments: [recvFuncRef]
  })

  hypervisor.send(message)
})

tape('two communicating actors with callback', async t => {
  t.plan(1)
  tester = t

  const tree = new RadixTree({
    db
  })

  const recieverWasm = fs.readFileSync(WASM_PATH + '/funcRef_reciever.wasm')
  const callerWasm = fs.readFileSync(WASM_PATH + '/funcRef_caller.wasm')

  const hypervisor = new Hypervisor({
    tree,
    modules: [TestWasmModule]
  })

  const callerActorRef = await hypervisor.newActor(TestWasmModule, callerWasm)
  const receiverActorRef = await hypervisor.newActor(TestWasmModule, recieverWasm)

  const callFuncRef = callerActorRef.getFuncRef('call')
  const recvFuncRef = receiverActorRef.getFuncRef('receive')
  callFuncRef.gas = 1000000
  recvFuncRef.gas = 100000

  const message = new Message({
    funcRef: callFuncRef,
    funcArguments: [recvFuncRef]
  })

  hypervisor.send(message)
})

tape('two communicating actors with private callback', async t => {
  t.plan(1)
  tester = t

  const tree = new RadixTree({
    db
  })

  const recieverWasm = fs.readFileSync(WASM_PATH + '/funcRef_reciever.wasm')
  const callerWasm = fs.readFileSync(WASM_PATH + '/private_caller.wasm')

  const hypervisor = new Hypervisor({
    tree,
    modules: [TestWasmModule]
  })

  const callerActorRef = await hypervisor.newActor(TestWasmModule, callerWasm)
  const receiverActorRef = await hypervisor.newActor(TestWasmModule, recieverWasm)

  const callFuncRef = callerActorRef.getFuncRef('call')
  const recvFuncRef = receiverActorRef.getFuncRef('receive')
  callFuncRef.gas = 1000000
  recvFuncRef.gas = 100000

  const message = new Message({
    funcRef: callFuncRef,
    funcArguments: [recvFuncRef]
  })

  hypervisor.send(message)
})

tape('externalize/internalize memory', async t => {
  t.plan(1)
  tester = t
  const tree = new RadixTree({
    db
  })

  const wasm = fs.readFileSync(WASM_PATH + '/memory.wasm')

  const hypervisor = new Hypervisor({
    tree,
    modules: [TestWasmModule]
  })

  const actorRef = await hypervisor.newActor(TestWasmModule, wasm)
  const funcRef = actorRef.getFuncRef('test')
  funcRef.gas = 10000

  const message = new Message({funcRef}).on('done', actor => {
    const a = actor.container.get8Memory(0, 5)
    const b = actor.container.get8Memory(5, 5)
    t.deepEquals(a, b, 'should copy memory correctly')
  })
  hypervisor.send(message)
})

tape('externalize/internalize table', async t => {
  t.plan(1)
  tester = t
  const tree = new RadixTree({
    db
  })

  const wasm = fs.readFileSync(WASM_PATH + '/table.wasm')
  const hypervisor = new Hypervisor({
    tree,
    modules: [TestWasmModule]
  })

  const actorRef = await hypervisor.newActor(TestWasmModule, wasm)

  const funcRef = actorRef.getFuncRef('test')
  funcRef.gas = 10000

  const message = new Message({funcRef}).on('done', actor => {
    const a = actor.container.get8Memory(0, 8)
    const b = actor.container.get8Memory(8, 8)
    t.deepEquals(a, b, 'should copy memory correctly')
  })
  hypervisor.send(message)
})

tape('creation', async t => {
  t.plan(1)
  tester = t
  const tree = new RadixTree({db})
  let wasm = fs.readFileSync(WASM_PATH + '/creation.wasm')
  let receiver = fs.readFileSync(WASM_PATH + '/reciever.wasm')

  const hypervisor = new Hypervisor({
    tree,
    modules: [TestWasmModule]
  })

  const actorRef = await hypervisor.newActor(TestWasmModule, wasm)
  const funcRef = actorRef.getFuncRef('main')
  funcRef.gas = 322000

  const message = new Message({
    funcRef,
    funcArguments: [receiver]
  })
  hypervisor.send(message)
})

tape('is instance', async t => {
  // t.plan(1)
  tester = t
  const tree = new RadixTree({db})
  let wasm = fs.readFileSync(WASM_PATH + '/is_instance.wasm')
  let receiver = fs.readFileSync(WASM_PATH + '/reciever.wasm')

  const egress = new EgressDriver()

  egress.on('message', msg => {
    t.equals(msg.funcArguments[0].toString(), 'hello world')
    t.end()
  })

  const hypervisor = new Hypervisor({
    tree,
    drivers: [egress],
    modules: [TestWasmModule]
  })

  const actorRef = await hypervisor.newActor(TestWasmModule, wasm)
  const funcRef = actorRef.getFuncRef('main')
  funcRef.gas = 322000

  const message = new Message({
    funcRef,
    funcArguments: [receiver, new FunctionRef({
      actorId: egress.id,
      params: ['data']
    })]
  })

  hypervisor.send(message)
  t.end()
})

tape('link', async t => {
  tester = t
  const tree = new RadixTree({db})
  let wasm = fs.readFileSync(WASM_PATH + '/link.wasm')

  const egress = new EgressDriver()

  egress.on('message', msg => {
    t.equals(msg.funcArguments[0].toString(), 'hello world')
    t.end()
  })

  const hypervisor = new Hypervisor({
    tree,
    modules: [TestWasmModule],
    drivers: [egress]
  })

  const actorRef = await hypervisor.newActor(TestWasmModule, wasm)
  const funcRef = actorRef.getFuncRef('main')
  funcRef.gas = 322000

  const message = new Message({
    funcRef
  })

  hypervisor.send(message)

  const funcRef2 = actorRef.getFuncRef('load')
  funcRef2.gas = 322000

  await hypervisor.createStateRoot()

  const message2 = new Message({
    funcRef: funcRef2,
    funcArguments: [new FunctionRef({
      actorId: egress.id,
      params: ['data']
    })]
  })

  hypervisor.send(message2)
})

tape('invalid binary', async t => {
  t.plan(1)
  tester = t
  const tree = new RadixTree({db})
  const wasm = Buffer.from([0])

  const hypervisor = new Hypervisor({
    tree,
    modules: [TestWasmModule]
  })

  try {
    await hypervisor.newActor(TestWasmModule, wasm)
  } catch (e) {
    t.pass()
  }
})

tape('out of gas', async t => {
  tester = t
  const tree = new RadixTree({db})
  let wasm = fs.readFileSync(WASM_PATH + '/i64.wasm')

  const hypervisor = new Hypervisor({
    tree,
    modules: [TestWasmModule]
  })

  const actorRef = await hypervisor.newActor(TestWasmModule, wasm)
  const funcRef = actorRef.getFuncRef('main')

  const message = new Message({
    funcRef
  }).on('execution:error', e => {
    t.end()
  })
  hypervisor.send(message)
})

tape('negative gas', async t => {
  t.plan(1)
  const tree = new RadixTree({db})
  let wasm = fs.readFileSync(WASM_PATH + '/negative_gas.wasm')

  const hypervisor = new Hypervisor({
    tree,
    modules: [TestWasmModule]
  })

  try {
    await hypervisor.newActor(TestWasmModule, wasm)
  } catch (e) {
    t.pass(e.message)
  }
})

tape('persistent globals', async t => {
  tester = t
  const tree = new RadixTree({db})
  let wasm = fs.readFileSync(WASM_PATH + '/persistantGlobals.wasm')

  const hypervisor = new Hypervisor({
    tree,
    modules: [TestWasmModule]
  })

  const actorRef = await hypervisor.newActor(TestWasmModule, wasm)
  const funcRef = actorRef.getFuncRef('e')
  funcRef.gas = 322000

  const message = new Message({
    funcRef
  })

  hypervisor.send(message)
  hypervisor.scheduler.on('idle', async () => {
    const actor = await hypervisor.loadActor(actorRef.id)
    t.deepEquals(actor.storage, [[], 5, [0, 3]])
  })
  await hypervisor.createStateRoot()
  hypervisor.send(message)

  hypervisor.scheduler.on('idle', async () => {
    const actor = await hypervisor.loadActor(actorRef.id)
    t.deepEquals(actor.storage, [[], 5, [0, 3]])
  })

  t.end()
})

tape('ref passing', async t => {
  tester = t
  const tree = new RadixTree({db})
  const wasm = fs.readFileSync(WASM_PATH + '/ref_passing.wasm')

  const egress = new EgressDriver()

  egress.on('message', msg => {
    t.equals(msg.funcArguments[0].toString(), 'hello world')
    t.end()
  })

  const hypervisor = new Hypervisor({
    tree,
    meter: false,
    drivers: [egress],
    modules: [TestWasmModule]
  })

  const actorRef1 = await hypervisor.newActor(TestWasmModule, wasm)
  const actorRef2 = await hypervisor.newActor(TestWasmModule, wasm)
  const funcRef = actorRef1.getFuncRef('main')

  const message = new Message({
    funcRef,
    funcArguments: [new FunctionRef({
      actorId: egress.id,
      params: ['data']
    }), actorRef2]
  })

  hypervisor.send(message)
  await hypervisor.createStateRoot()
})
