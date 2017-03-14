const tape = require('tape')
const fs = require('fs')
const WasmContainer = require('../index.js')

const dir = `${__dirname}/wasm/`

tape('interface tests', async t => {
  const code = fs.readFileSync(`${dir}testCode.wasm`)
  class TestInterface {
    constructor (opts) {
      opts.response.test = 'response!'
    }

    static get name () {
      return 'test'
    }
  }

  t.equals(WasmContainer.name, 'wasm', 'container should have a name')

  const container = new WasmContainer(code)
  t.ok(container instanceof WasmContainer, 'should be instance of a container class')

  const promise = container.run()
  await promise
  t.ok(promise instanceof Promise, 'run should return instance of promise')

  const results = await container.run(null, null, [TestInterface])
  t.deepEquals(results, {
    'test': {
      'test': 'response!'
    }
  })

  t.end()
})

tape('wasm interface test', async t => {
  t.plan(1)
  const code = fs.readFileSync(`${dir}testMem.wasm`)
  class TestInterfaceMem {
    constructor (opts) {
      this.opts = opts
    }

    static get name () {
      return 'test'
    }

    memory () {
      const memory = this.opts.vm.memory()
      t.ok(memory instanceof ArrayBuffer, 'should have access to memory')
    }
  }
  const container = new WasmContainer(code)
  await container.run(null, null, [TestInterfaceMem])
})

tape('async wasm interface test', async t => {
  t.plan(1)
  const code = fs.readFileSync(`${dir}asyncTest.wasm`)
  class TestInterfaceMem {
    constructor (opts) {
      this.opts = opts
    }

    static get name () {
      return 'test'
    }

    async (cbOffset) {
      const opPromise = new Promise((resolve, reject) => {
        resolve()
      })
      this.opts.vm.pushOpsQueue(opPromise, cbOffset)
    }

    done () {
      t.ok(true)
    }
  }
  const container = new WasmContainer(code)
  await container.run(null, null, [TestInterfaceMem])
})
