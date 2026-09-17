package main

import "core:fmt"
import "game"

main :: proc() {
  fmt.println("Starting tamacat...")

  game.loop()

  fmt.println("Exiting tamacat...")
}
