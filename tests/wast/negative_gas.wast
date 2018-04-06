(module
 (type $v (func))
 (type $iv (func (param i32)))
 (import "metering" "usegas" (func $usegas (param i32)))
 (memory $0 1)
 (export "main" (func $main))
 (func $main (type $v)
  (call $usegas
   (i32.const -1000)
  )
 )
)
