package game

import "core:fmt"
import "vendor:raylib"

FPS :: 60

w :: 300
h :: 300
title :: "Tamacats"

hunger := 100.0

start :: proc() {
  raylib.SetConfigFlags({
    .WINDOW_UNDECORATED, .WINDOW_TOPMOST, .WINDOW_TRANSPARENT
  })

  raylib.InitWindow(w, h, title)
  defer raylib.CloseWindow()

  raylib.SetTargetFPS(FPS)

  loop()
}

@(private)
loop :: proc() {
  for !raylib.WindowShouldClose() {
    hunger -= f64(raylib.GetFrameTime() * 0.5) // slowly starves over time

    // interactions
    if raylib.IsMouseButtonPressed(.LEFT) {
      if raylib.CheckCollisionPointRec(raylib.GetMousePosition(), {100,100,100,100}) {
        hunger = min(100.0, hunger + 20.0)
        fmt.println("Fed the cat! Hunger:", hunger)
      }
    }

    // Drawing block
    raylib.BeginDrawing()
    raylib.ClearBackground(raylib.BLANK)

    // Draw pet (placeholder)
    raylib.DrawRectangle(100, 100, 100, 100, raylib.ORANGE)
    raylib.DrawText("Maaw", 120, 140, 20, raylib.WHITE)

    // HP bar
    raylib.DrawRectangle(100, 80, i32(hunger), 10, raylib.GREEN)

    raylib.EndDrawing()
  }
}
