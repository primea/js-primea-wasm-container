(module
  (import "test" "async" (func $async (param i32)))
  (import "test" "done" (func $done))
  (table
    (export "callback")
    anyfunc
    (elem
      $callback
    )
  )
  (func $callback
    call $done
  )
  (func $main
    (call $async (i32.const 0))
  )
  (export "main" (func $main)))
