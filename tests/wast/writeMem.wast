(module
  (type $FUNCSIG$iii (func (param i32 i32) (result i32)))
  (import "env" "writeMem" (func $writeMem (param i32 i32) (result i32)))
  (table 0 anyfunc)
  (memory $0 1)
  (export "memory" (memory $0))
  (export "onCreation" (func $onCreation))
  (func $onCreation (result i32)
    (local $0 i32)
    (drop
      (call $writeMem
        (i32.const 0)
        (i32.const 9)
      )
    )
    (get_local $0)
  )
)
