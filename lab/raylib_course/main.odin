package main

import "core:fmt"
import "core:os"
import "examples"

main :: proc() {
  example := "basic"
  if len(os.args) > 1 {
    fmt.printf("args=%v\n", os.args)
    example = os.args[1]
  }

  switch example {
  case "basic":
    examples.basic_window_loop()
  case "delta_time":
    examples.delta_time_loop()
  case "keys":
    examples.input_keys_loop()
  case "mouse":
    examples.input_mouse_loop()
  case "wheel":
    examples.input_mouse_wheel_loop()
  }
}
