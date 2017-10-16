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

  const port = hypervisor.creationService.getPort()

  let instance = await hypervisor.send(port, new Message({
    data: {
      type: WasmContainer.typeId,
      code: main
    }
  }))
  instance.message(instance.createMessage())
})

tape('referances', async t => {
  t.plan(1)
  const hypervisor = new Hypervisor(tree)
  const main = fs.readFileSync(`${__dirname}/wasm/referances.wasm`)
  hypervisor.registerContainer(WasmContainer, {
    env: ContainerTestInterface,
    test: testInterface(t)
  })
  const ports = hypervisor.createChannel()
  const port = hypervisor.creationService.getPort()

  hypervisor.send(port, new Message({
    data: {
      type: WasmContainer.typeId,
      code: main
    },
    ports: ports
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

  const port = hypervisor.creationService.getPort()

  hypervisor.send(port, new Message({
    data: {
      type: WasmContainer.typeId,
      code: readMem
    }
  }))
})

tape('write mem', async t => {
  const hypervisor = new Hypervisor(tree)
  const readMem = fs.readFileSync(`${__dirname}/wasm/writeMem.wasm`)
  hypervisor.registerContainer(WasmContainer, {
    env: ContainerTestInterface,
    test: testInterface(t)
  })

  const port = hypervisor.creationService.getPort()
  const root = await hypervisor.send(port, new Message({
    data: {
      type: WasmContainer.typeId,
      code: readMem
    }
  }))
  const mem = root.container.getMemory(0, 1)
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

  const port = hypervisor.creationService.getPort()
  await hypervisor.send(port, new Message({
    data: {
      type: WasmContainer.typeId,
      code: callBackWasm
    }
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
    data: {
      type: WasmContainer.typeId,
      code: Buffer.from([0x00])
    }
  })

  const rp = message.responsePort = {destPort: {messages: []}}

  const port = hypervisor.creationService.getPort()
  await hypervisor.send(port, message)

  t.equals(rp.destPort.messages[0].data.exception, true)
})

tape('initailize', async t => {
  t.plan(2)

  const callBackWasm = fs.readFileSync(`${__dirname}/wasm/callback.wasm`)

  class ContainerTestInterface {
    constructor (wasmContainer) {
      this.wasmContainer = wasmContainer
    }

    readMem (offset) {
      return this.wasmContainer.getMemory(offset, 1)
    }

    async callback (cb) {
      const promise = new Promise((resolve, reject) => {
        resolve()
      })
      await this.wasmContainer.pushOpsQueue(promise)
      this.wasmContainer.execute(cb)
    }

    static initialize (code) {
      t.equals(code, callBackWasm)
      return code
    }
  }

  const hypervisor = new Hypervisor(tree)
  hypervisor.registerContainer(WasmContainer, {
    env: ContainerTestInterface,
    test: testInterface(t)
  })

  const port = hypervisor.creationService.getPort()
  hypervisor.send(port, new Message({
    data: {
      type: WasmContainer.typeId,
      code: callBackWasm
    }
  }))
})
