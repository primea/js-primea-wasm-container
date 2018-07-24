(module
  (import "elem" "externalize" (func $externalize (param i32 i32) (result i32)))
  (import "data" "externalize" (func $mem_externalize (param i32 i32) (result i32)))
  (import "elem" "internalize" (func $internalize (param i32 i32 i32 i32)))
  (memory (export "memory") 1)
  (data (i32.const 0) "test")
  (data (i32.const 16) "rest")
  (func $test
    (i32.store
      (i32.const 0)
      (call $mem_externalize (i32.const 0)  (i32.const 4)))
    (i32.store
      (i32.const 4)
      (call $mem_externalize (i32.const 0)  (i32.const 4)))

    (call $internalize
        (i32.const 8)
        (i32.const 100)
        (call $externalize
          (i32.const 0)
          (i32.const 2))
        (i32.const 0))
  )
  (export "test" (func $test)))
