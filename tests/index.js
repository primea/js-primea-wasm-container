const tape = require('tape')
const fs = require('fs')
const Hypervisor = require('primea-hypervisor')
const Message = require('primea-message')
const WasmContainer = require('../index.js')
const testInterface = require('./testInterface.js')
const level = require('level')
const RadixTree = require('dfinity-radix-tree')
const db = level('./testdb')

const tree = new RadixTree({
  db: db
})

class ContainerTestInterface {
  constructor (wasmContainer) {
    this.wasmContainer = wasmContainer
  }

  readMem (offset) {
    return this.wasmContainer.getMemory(offset, 1)
  }

  writeMem (offset, val) {
    return this.wasmContainer.setMemory(offset, [val])
  }

  numOfReferances () {
    return this.wasmContainer.referanceMap.size
  }

  async callback (cb) {
    const promise = new Promise((resolve, reject) => {
      resolve()
    })
    await this.wasmContainer.pushOpsQueue(promise)
    this.wasmContainer.execute(cb)
  }
}

tape('wasm container - main', async t => {
  t.plan(1)
  const hypervisor = new Hypervisor(tree)
  const main = fs.readFileSync(`${__dirname}/wasm/run.wasm`)
  hypervisor.registerContainer(WasmContainer, {
    test: testInterface(t)
  })

  let cap = await hypervisor.createActor(WasmContainer.typeId, new Message({
    data: main
  }))
  hypervisor.send(cap, new Message())
})

tape('referances', async t => {
  t.plan(1)
  const hypervisor = new Hypervisor(tree)
  const main = fs.readFileSync(`${__dirname}/wasm/referances.wasm`)
  hypervisor.registerContainer(WasmContainer, {
    env: ContainerTestInterface,
    test: testInterface(t)
  })

  hypervisor.createActor(WasmContainer.typeId, new Message({
    data: main
  }))
})

tape('wasm container - mem', async t => {
  t.plan(1)
  const hypervisor = new Hypervisor(tree)
  const readMem = fs.readFileSync(`${__dirname}/wasm/readMem.wasm`)
  hypervisor.registerContainer(WasmContainer, {
    env: ContainerTestInterface,
    test: testInterface(t)
  })

  hypervisor.createActor(WasmContainer.typeId, new Message({
    data: readMem
  }))
})

tape('write mem', async t => {
  const hypervisor = new Hypervisor(tree)
  const readMem = fs.readFileSync(`${__dirname}/wasm/writeMem.wasm`)

  class WasmContainerNoIdle extends WasmContainer {
    onIdle () {}
  }

  hypervisor.registerContainer(WasmContainerNoIdle, {
    env: ContainerTestInterface,
    test: testInterface(t)
  })

  const cap = await hypervisor.createActor(WasmContainerNoIdle.typeId, new Message({
    data: readMem
  }))
  const actor = await hypervisor.getActor(cap.destId)
  const mem = actor.container.getMemory(0, 1)
  t.equals(mem[0], 9)
  t.end()
})

tape('wasm container - callbacks', async t => {
  t.plan(1)
  const hypervisor = new Hypervisor(tree)
  const callBackWasm = fs.readFileSync(`${__dirname}/wasm/callback.wasm`)
  hypervisor.registerContainer(WasmContainer, {
    env: ContainerTestInterface,
    test: testInterface(t)
  })

  await hypervisor.createActor(WasmContainer.typeId, new Message({
    data: callBackWasm
  }))
})

tape('wasm container - invalid', async t => {
  t.plan(1)
  const hypervisor = new Hypervisor(tree)
  hypervisor.registerContainer(WasmContainer, {
    env: ContainerTestInterface,
    test: testInterface(t)
  })

  const message = new Message({
    data: Buffer.from([0])
  })

  message.on('execution:error', (e) => {
    console.log(e)
    t.pass('should cature error')
  })

  await hypervisor.createActor(WasmContainer.typeId, message)
})

tape('initailize', async t => {
  t.plan(2)

  const callBackWasm = fs.readFileSync(`${__dirname}/wasm/callback.wasm`)

  class ContainerTestInterface {
    constructor (wasmContainer) {
      this.wasmContainer = wasmContainer
    }

    async callback (cb) {
      const promise = new Promise((resolve, reject) => {
        resolve()
      })
      await this.wasmContainer.pushOpsQueue(promise)
      this.wasmContainer.execute(cb)
    }

    static initialize (code) {
      t.deepEquals(code, callBackWasm)
      return code
    }
  }

  const hypervisor = new Hypervisor(tree)
  hypervisor.registerContainer(WasmContainer, {
    env: ContainerTestInterface,
    test: testInterface(t)
  })

  await hypervisor.createActor(WasmContainer.typeId, new Message({
    data: callBackWasm
  }))
})
