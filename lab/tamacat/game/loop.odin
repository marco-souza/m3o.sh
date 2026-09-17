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
    .WINDOW_UNDECORATED, .WINDOW_TOPMOST, .WINDOW_TRANSPARENT,
    // INFO : idea to have a full screen game and wall the cat
    // .WINDOW_MOUSE_PASSTHROUGH
  })

  raylib.InitWindow(w, h, title)
  defer raylib.CloseWindow()

  raylib.SetTargetFPS(FPS)

  loop()
}

@(private)
loop :: proc() {
  for !raylib.WindowShouldClose() {
    delta := raylib.GetFrameTime() * 2.0 // quickly starves over time
    hunger -= f64(delta)

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
    if i32(hunger) % 10 == 0 {
      fmt.println("hunger=", hunger)
      fmt.println("delta=", delta)
    }

    switch {
    case hunger <= 30:
      raylib.DrawRectangle(60, 60, 180, 180, raylib.RED)
      raylib.DrawText("Maaaaaaaaaaaw 🤬", 120, 140, 20, raylib.WHITE)
    case hunger <= 60:
      raylib.DrawRectangle(80, 80, 140, 140, raylib.ORANGE)
      raylib.DrawText("Maaaaaaw 😤", 120, 140, 20, raylib.WHITE)
    case:
      raylib.DrawRectangle(100, 100, 100, 100, raylib.ORANGE)
      raylib.DrawText("Maaw", 120, 140, 20, raylib.WHITE)
    }

    // HP bar
    raylib.DrawRectangle(100, 80, i32(hunger), 10, raylib.GREEN)

    raylib.EndDrawing()
  }
}
