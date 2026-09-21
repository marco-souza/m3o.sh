package examples

import "vendor:raylib"

basic_window_loop :: proc() {
  raylib.InitWindow(SCREEN_WIDTH, SCREEN_HEIGHT, "raylib [code] example - basic window")
  defer raylib.CloseWindow()

  raylib.SetTargetFPS(TARGET_FPS)

  for !raylib.WindowShouldClose() {
    // TODO: update your game variables here

    // INFO: Draw screen
    raylib.BeginDrawing()

      raylib.ClearBackground(raylib.RAYWHITE)
      raylib.DrawText("Congrats! You created your first window!", 129, 200, 20, raylib.LIGHTGRAY)

    raylib.EndDrawing()
  }
}

