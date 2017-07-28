(module
  (type $FUNCSIG$ii (func (param i32) (result i32)))
  (type $FUNCSIG$vii (func (param i32 i32)))
  (import "test" "equals" (func $equals (param i32 i32)))
  (import "env" "readMem" (func $readMem (param i32) (result i32)))
  (table 0 anyfunc)
  (memory $0 1)
  (data (i32.const 16) "asm\01\00")
  (export "memory" (memory $0))
  (export "onCreation" (func $onCreation))
  (func $onCreation (param $0 i32) (result i32)
    (local $1 i32)
    (call $equals
      (call $readMem
        (i32.const 16)
      )
      (i32.const 97)
    )
    (get_local $1)
  )
)
