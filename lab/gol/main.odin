package main

import "game"

main :: proc() {
  overview()

  game.game_loop()

  fetch()
}
