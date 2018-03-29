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
    checkCode.push(i32_const(typeCode))
    if (baseType === 'i64') {
      importType.push('i32')

      // splits an i64 into 2 i32
      const spliti64 = [
        get_local(index),
        i64_const(32),
        shr_u(),
        wrap_i64(),
        get_local(index),
        wrap_i64()]

      checkCode = checkCode.concat(spliti64)

      const i32wrapCode = [
        get_local(invokeIndex), {
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
        get_local(++invokeIndex), {
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
      checkCode.push(get_local(index))
      invokeCode.push(get_local(invokeIndex))
    }
    invokerType.push('i32')
    // check export
    checkType.push(baseType)
    // invoke
    invokeType.push(baseType)
    invokeIndex++
  })

  module[7].entries[0].code = checkCode.concat(setGlobals, [call(0), end()])
  invokeCode.push(i32_const(0))
  invokeCode.push(call_indirect(3))
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

function call_indirect (index) {
  return {
    'name': 'call_indirect',
    'immediates': {
      'index': index,
      'reserved': 0
    }
  }
}

function typeEntry (params = []) {
  return {
    form: 'func',
    params: params
  }
}

function end () {
  return {
    name: 'end'
  }
}

function get_local (index) {
  return {
    name: 'get_local',
    immediates: index
  }
}

function get_global (index) {
  return {
    name: 'get_global',
    immediates: index
  }
}

function set_global (index) {
  return {
    name: 'set_global',
    immediates: index
  }
}

function i32_const (num) {
  return {
    'return_type': 'i32',
    'name': 'const',
    'immediates': num
  }
}

function i64_const (num) {
  return {
    'return_type': 'i64',
    'name': 'const',
    'immediates': num
  }
}

function i32_store () {
  return {
    'return_type': 'i32',
    'name': 'store',
    'immediates': {
      'flags': 2,
      'offset': 0
    }
  }
}

function shr_u() {
  return {
    'return_type': 'i64',
    'name': 'shr_u'
  }
}

function wrap_i64() {
  return {
    'return_type': 'i32',
    'name': 'wrap/i64'
  }
}
