(module
  (import "test" "memory" (func $mem))
  (memory (export "memory") 1)
  (func $main
    (call $mem)
  )
  
  (export "main" (func $main)))
