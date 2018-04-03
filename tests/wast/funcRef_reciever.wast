(module
  (import "func" "internalize" (func $internalize (param i32 i32)))
  (import "func" "set_gas_budget" (func $set_gas_budget (param i32 i32) (result i32)))
  (table (export "table") 1 1 anyfunc)
  (func $receive (param $funcRef i32)
    (call $internalize
      (i32.const 0)
      (call $set_gas_budget 
            (get_local $funcRef)
            (i32.const 10500)))

    (call_indirect (param i32)
      (i32.const 5)
      (i32.const 0))
  )
  (export "receive" (func $receive)))
