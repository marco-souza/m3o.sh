package main

import "core:fmt"
import "game"

main :: proc() {
  fmt.println("Starting tamacat...")

  game.start()

  fmt.println("Exiting tamacat...")
}
