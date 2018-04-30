(module
  (import "module" "new" (func $mod.new (param i32) (result i32)))
  (import "actor" "new" (func $actor.new (param i32) (result i32)))
  (import "actor" "export" (func $actor.exports (param i32 i32) (result i32)))
  (import "actor" "is_instance" (func $actor.is_instance (param i32 i32) (result i32)))
  (import "actor" "self" (func $actor.self (result i32)))
  (import "func" "internalize" (func $func.internalize (param i32 i32)))
  (import "test" "check" (func $check (param i32 i32)))
  (memory (export "memory") 1)
  (data (i32.const 0) "receive")
  (table (export "table") 1 1 anyfunc)
  (func $main (param $bin i32 )
    (local $actor i32)
    (local $mod i32)
    (call $check
      (call $actor.is_instance
        (call $actor.new
          (tee_local $mod
            (call $mod.new
            (get_local $bin))))
        (get_local $mod))
      (i32.const 1)
    )
    (call $check
      (call $actor.is_instance
        (call $actor.self) 
        (get_local $mod))
      (i32.const 0)
    ))
 

  (export "main" (func $main)))
