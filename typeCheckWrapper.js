const {LANGUAGE_TYPES_STRG} = require('primea-annotations')

module.exports = function (params) {
  const module = [{
    'name': 'preramble',
    'magic': [
      0,
      97,
      115,
      109
    ],
    'version': [
      1,
      0,
      0,
      0
    ]
  }, {
    'name': 'type',
    'entries': [{
      'form': 'func',
      'params': [
      ]
    }, {
      'form': 'func',
      'params': [
        // imported check
      ]
    }, {
      'form': 'func',
      'params': [
        // exported check
      ]
    }, {
      'form': 'func',
      'params': [
        // invoke
      ]
    }]
  }, {
    'name': 'import',
    'entries': [{
      'moduleStr': 'env',
      'fieldStr': 'checkTypes',
      'kind': 'function',
      'type': 0
    }]
  }, {
    'name': 'function',
    'entries': [
      1,
      2
    ]
  }, {
    'name': 'table',
    'entries': [{
      'elementType': 'anyFunc',
      'limits': {
        'flags': 1,
        'intial': 1,
        'maximum': 1
      }
    }]
  }, {
    'name': 'global',
    'entries': []
  }, {
    'name': 'export',
    'entries': [{
      'field_str': 'table',
      'kind': 'table',
      'index': 0
    }, {
      'field_str': 'invoke',
      'kind': 'function',
      'index': 2
    }, {
      'field_str': 'check',
      'kind': 'function',
      'index': 1
    }]
  }, {
    'name': 'code',
    'entries': [{
      'locals': [],
      'code': []
    }, {
      'locals': [],
      'code': []
    }]
  }]

  const definedTypes = new Set(['anyref', 'module', 'func', 'data', 'elem', 'link', 'id'])
  const setGlobals = []
  const importType = module[1].entries[0].params
  const checkType = module[1].entries[1].params
  const invokerType = module[1].entries[2].params
  const invokeType = module[1].entries[3].params
  let checkCode = module[7].entries[0].code
  let invokeCode = module[7].entries[1].code

  let invokeIndex = 0
  params.forEach((param, index) => {
    let baseType = param
    const typeCode = LANGUAGE_TYPES_STRG[param]
    // import type
    if (definedTypes.has(param)) {
      baseType = 'i32'
    } else {
      baseType = param
    }

    // check import
    importType.push('i32')
    importType.push('i32')
    checkCode.push(i32Const(typeCode))
    if (baseType === 'i64') {
      importType.push('i32')

      // splits an i64 into 2 i32
      const spliti64 = [
        getLocal(index),
        i64Const(32),
        shrU(),
        wrapI64(),
        getLocal(index),
        wrapI64()]

      checkCode = checkCode.concat(spliti64)

      const i32wrapCode = [
        getLocal(invokeIndex), {
          'return_type': 'i64',
          'name': 'extend_u/i32'
        }, {
          'return_type': 'i64',
          'name': 'const',
          'immediates': '32'
        }, {
          'return_type': 'i64',
          'name': 'shl'
        },
        getLocal(++invokeIndex), {
          'return_type': 'i64',
          'name': 'extend_u/i32'
        }, {
          'return_type': 'i64',
          'name': 'add'
        }
      ]

      invokeCode = invokeCode.concat(i32wrapCode)
      invokerType.push('i32')
    } else {
      checkCode.push(getLocal(index))
      invokeCode.push(getLocal(invokeIndex))
    }
    invokerType.push('i32')
    // check export
    checkType.push(baseType)
    // invoke
    invokeType.push(baseType)
    invokeIndex++
  })

  module[7].entries[0].code = checkCode.concat(setGlobals, [call(0), end()])
  invokeCode.push(i32Const(0))
  invokeCode.push(callIndirect(3))
  invokeCode.push(end())
  module[7].entries[1].code = invokeCode
  return module
}

function call (index) {
  return {
    'name': 'call',
    'immediates': index
  }
}

function callIndirect (index) {
  return {
    'name': 'call_indirect',
    'immediates': {
      'index': index,
      'reserved': 0
    }
  }
}

function end () {
  return {
    name: 'end'
  }
}

function getLocal (index) {
  return {
    name: 'get_local',
    immediates: index
  }
}

function i32Const (num) {
  return {
    'return_type': 'i32',
    'name': 'const',
    'immediates': num
  }
}

function i64Const (num) {
  return {
    'return_type': 'i64',
    'name': 'const',
    'immediates': num
  }
}

function shrU () {
  return {
    'return_type': 'i64',
    'name': 'shr_u'
  }
}

function wrapI64 () {
  return {
    'return_type': 'i32',
    'name': 'wrap/i64'
  }
}
