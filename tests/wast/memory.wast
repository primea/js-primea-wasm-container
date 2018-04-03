(module
  (import "memory" "externalize" (func $externalize (param i32 i32) (result i32)))
  (import "memory" "internalize" (func $internalize (param i32 i32 i32 i32)))
  (import "memory" "length" (func $length (param i32) (result i32)))
  (memory (export "memory") 1)
  (data (i32.const 0) "test")
  (func $test
    (local $dataRef i32)
    (call $internalize
      (tee_local $dataRef
        (call $externalize
          (i32.const 0)
          (i32.const 4)))
      (i32.const 0) 
      (i32.const 5)
      (call $length (get_local $dataRef)))
  )
  (export "test" (func $test)))
