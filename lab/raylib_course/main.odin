package main

import "examples"

main :: proc() {
  examples.basic_window_loop()
  examples.delta_time_loop()
  examples.input_keys_loop()
  examples.input_mouse_loop()
}
