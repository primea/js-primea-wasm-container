(module
  (import "test" "check" (func $check (param i32 i32)))
  (import "test" "print" (func $print (param i32)))
  (import "memory" "externalize" (func $mem.externalize (param i32 i32) (result i32)))
  (import "storage" "get" (func $storage.get (result i32)))
  (import "storage" "set" (func $storage.set (param i32))) 
  (import "elem" "externalize" (func $elem.externalize (param i32 i32) (result i32)))
  (import "elem" "internalize" (func $elem.internalize (param i32 i32 i32 i32)))
  (import "func" "internalize" (func $func.internalize (param i32 i32)))

  (memory (export "memory") 1)
  (data (i32.const 0) "hello world")
  (table (export "table") 1 1 anyfunc)
  (func $main
    (i32.store 
      (i32.const 0)
      (call $mem.externalize (i32.const 0) (i32.const 11)))

    (call $storage.set
      (call $elem.externalize (i32.const 0) (i32.const 1))))

   (func $load (param $egress i32)
     (call $elem.internalize
      (i32.const 0)   
      (i32.const 1)   
      (call $storage.get)
      (i32.const 0))

    (call $func.internalize
      (i32.const 0)
      (get_local $egress))

    (call_indirect (param i32)
      (i32.load (i32.const 0))
      (i32.const 0)))

  (export "main" (func $main))
  (export "load" (func $load)))
