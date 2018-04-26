(module
  (import "memory" "externalize" (func $mem.externalize (param i32 i32) (result i32)))
  (import "elem" "externalize" (func $elem.externalize (param i32 i32) (result i32)))
  (import "elem" "internalize" (func $elem.internalize (param i32 i32 i32 i32)))
  (import "elem" "length" (func $elem.length (param i32) (result i32)))
  (import "func" "internalize" (func $func.internalize (param i32 i32)))
  (import "link" "wrap" (func $link.wrap (param i32) (result i32)))
  (import "link" "unwrap" (func $link.unwrap (param i32 i32)))
  (global $storage (mut i32) (i32.const 9))

  (memory (export "memory") 1)
  (data (i32.const 0) "hello world")
  (table (export "table") 1 1 anyfunc)
  (elem (i32.const 0) $callback)
  (global $egressRef (mut  i32) (i32.const 0))

  (func $main
    (i32.store 
      (i32.const 0)
      (call $link.wrap
        (call $mem.externalize (i32.const 0) (i32.const 11))))

    (set_global $storage
      (call $elem.externalize (i32.const 0) (i32.const 1))))

   (func $load (param $egress i32)
      (set_global $egressRef (get_local $egress))

     (call $elem.internalize
      (i32.const 0)   
      (call $elem.length (get_global $storage))
      (get_global $storage)  
      (i32.const 0))

     (call $link.unwrap
       (i32.load (i32.const 0)) 
       (i32.const 0)))

  (func $callback (param $ref i32)
    (call $func.internalize
      (i32.const 0)
      (get_global $egressRef))

    (call_indirect (param i32)
      (get_local $ref)
      (i32.const 0))
  )

  (export "main" (func $main))
  (export "load" (func $load)))
