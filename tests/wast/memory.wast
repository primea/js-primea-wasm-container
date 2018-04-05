(module
  (import "memory" "externalize" (func $externalize (param i32 i32) (result i32)))
  (import "memory" "internalize" (func $internalize (param i32 i32 i32 i32)))
  (import "memory" "length" (func $length (param i32) (result i32)))
  (memory (export "memory") 1)
  (data (i32.const 0) "test")
  (func $test
    (local $dataRef i32)
    (call $internalize
      (i32.const 5) 
      (call $length 
        (tee_local $dataRef
          (call $externalize
            (i32.const 0)
            (i32.const 4))))
      (get_local $dataRef)
      (i32.const 0))
  )
  (export "test" (func $test)))
