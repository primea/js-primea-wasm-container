(module
  (import "module" "new" (func $mod.new (param i32) (result i32)))
  (import "actor" "new" (func $actor.new (param i32) (result i32)))
  (import "actor" "export" (func $actor.exports (param i32 i32) (result i32)))
  (import "data" "externalize" (func $mem.externalize (param i32 i32) (result i32)))
  (import "func" "internalize" (func $func.internalize (param i32 i32)))
  (import "func" "set_gas_budget" (func $set_gas_budget (param i32 i32) (result i32)))
  (memory (export "memory") 1)
  (data (i32.const 0) "receive")
  (table (export "table") 1 1 anyfunc)
  (func $main (param $bin i32)
    (call $func.internalize
      (i32.const 0)
      (call $set_gas_budget
        (call $actor.exports
          (call $actor.new
            (call $mod.new
              (get_local $bin)))
          (call $mem.externalize (i32.const 0) (i32.const 7)))
        (i32.const 10500)))

   (call_indirect (param i32)
     (i32.const 5)
     (i32.const 0)))

  (export "main" (func $main)))
