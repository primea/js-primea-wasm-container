(module
  (import "func" "internalize" (func $func.internalize (param i32 i32)))
  (import "test" "check" (func $check (param i32 i32)))
  (import "test" "print" (func $print (param i32)))
  (import "module" "self" (func $self (result i32)))
  (import "module" "export" (func $exports (param i32 i32) (result i32)))
  (import "memory" "externalize" (func $mem.externalize (param i32 i32) (result i32)))
  (import "memory" "internalize" (func $mem.internalize (param i32 i32) (result i32)))
  (memory (export "memory") 1)
  (data (i32.const 0) "callback")
  (table (export "table") 1 1 anyfunc)
  (func $main
   (local i32)
   (call $func.internalize
     (i32.const 0)
      (call $exports
        (call $self)
        (tee_local 0
          (call $mem.externalize (i32.const 0) (i32.const 8)))))
   (call_indirect (param i64 i32)
     (i64.const 8)
     (get_local 0)
     (i32.const 0)))

  (func $callback (param i64) (param i32)
    (call $check
      (i32.const 8)
      (i32.wrap/i64 (get_local 0)))
    (call $print (get_local 1)))
  (export "main" (func $main))
  (export "callback" (func $callback)))
