const tape = require('tape')
const fs = require('fs')
const Hypervisor = require('primea-hypervisor')
const WasmContainer = require('../index.js')
const testInterface = require('./testInterface.js')
const IPFS = require('ipfs')
const ReferanceMap = require('../referanceMap.js')

const node = new IPFS({
  start: false
})

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
}

node.on('ready', () => {
  tape('referance mapping', t => {
    t.plan(6)
    const referanceMap = new ReferanceMap()
    const obj1 = {}
    const obj2 = {}
    const ref1 = referanceMap.add(obj1)
    const ref2 = referanceMap.add(obj2)
    t.equals(ref1, 0, 'should produce correct refs')
    t.equals(ref2, 1, 'should produce correct refs')

    const foundObj1 = referanceMap.get(ref1)
    const foundObj2 = referanceMap.get(ref2)

    t.equals(foundObj1, obj1, 'should get the correct object')
    t.equals(foundObj2, obj2, 'should get the correct object')

    referanceMap.delete(ref1)
    try {
      referanceMap.get(ref1)
    } catch (e) {
      t.true(true, 'should delete refances')
    }

    referanceMap.clear()
    try {
      referanceMap.get(ref2)
    } catch (e) {
      t.true(true, 'should clear refances')
    }
  })

  tape('wasm container - mem', async t => {
    t.plan(2)
    const hypervisor = new Hypervisor(node.dag)
    const readMem = fs.readFileSync(`${__dirname}/wasm/readMem.wasm`)
    hypervisor.registerContainer('wasm', WasmContainer, {
      env: ContainerTestInterface,
      test: testInterface(t)
    })
    const root = await hypervisor.createInstance('wasm', {
      '/': WasmContainer.createState(readMem)
    })
    const r = await root.run()
    t.deepEquals(r, {}, 'should have no return value')
  })

  tape('wasm container - callbacks', async t => {
    t.plan(2)
    const hypervisor = new Hypervisor(node.dag)
    const readMem = fs.readFileSync(`${__dirname}/wasm/callback.wasm`)
    hypervisor.registerContainer('wasm', WasmContainer, {
      env: ContainerTestInterface,
      test: testInterface(t)
    })
    const root = await hypervisor.createInstance('wasm', {
      '/': WasmContainer.createState(readMem)
    })
    const r = await root.run()
    t.deepEquals(r, {}, 'should have no return value')
  })

  tape('wasm container - invalid', async t => {
    t.plan(1)
    const hypervisor = new Hypervisor(node.dag)
    hypervisor.registerContainer('wasm', WasmContainer, {
      env: ContainerTestInterface,
      test: testInterface(t)
    })

    try {
      await hypervisor.createInstance('wasm', {
        '/': WasmContainer.createState(new Buffer([0x00]))
      })
    } catch (e) {
      console.log(e)
      t.true(true, 'should trap on invalid wasm')
    }
  })
})
