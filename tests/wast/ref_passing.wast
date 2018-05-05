(module
  (import "func" "internalize" (func $func.internalize (param i32 i32)))
  (import "func" "externalize" (func $func.externalize (param i32) (result i32)))
  (import "test" "print" (func $print (param i32)))
  (import "actor" "export" (func $actor.export (param i32 i32) (result i32)))
  (import "data" "externalize" (func $mem.externalize (param i32 i32) (result i32)))
  (memory (export "memory") 1)
  (data (i32.const 0) "call")
  (data (i32.const 4) "hello world")
  (table (export "table") 2 2 anyfunc)

  (func $call (param $func i32)
    (call $func.internalize
      (i32.const 0)
      (get_local $func))

    (call_indirect (param i32)
      (call $mem.externalize (i32.const 4) (i32.const 11))
      (i32.const 0)))

  (func $main (param $egress i32) (param $actor2 i32)
    (call $func.internalize
      (i32.const 0)
      (get_local $egress))

    (call $func.internalize
      (i32.const 1)
      (call $actor.export
        (get_local $actor2)
        (call $mem.externalize (i32.const 0) (i32.const 4))))

    (call_indirect (param i32)
      (i32.const 0)
      (i32.const 1)))

  (export "main" (func $main))
  (export "call" (func $call)))
