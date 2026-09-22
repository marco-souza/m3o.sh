package examples

import "vendor:raylib"

input_keys_loop :: proc() {
  raylib.InitWindow(SCREEN_WIDTH, SCREEN_HEIGHT, "raylib [core] example - input keys")
  defer raylib.CloseWindow()

  ballPosition := Vector2{ SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 }

  for !raylib.WindowShouldClose() {
    // Update
    //--------------------------------------------------------------------------------
    if raylib.IsKeyDown(.RIGHT) { ballPosition.x += 2.0 }
    if raylib.IsKeyDown(.LEFT) { ballPosition.x -= 2.0 }
    if raylib.IsKeyDown(.UP) { ballPosition.y -= 2.0 }
    if raylib.IsKeyDown(.DOWN) { ballPosition.y += 2.0 }

    // Draw
    //--------------------------------------------------------------------------------
    raylib.BeginDrawing()

    raylib.ClearBackground(raylib.WHITE)

    raylib.DrawText("move the ball with arrow keys", 10, 10, 20, raylib.DARKGRAY)

    raylib.DrawCircleV(ballPosition, 50, raylib.MAROON)

    raylib.EndDrawing()
  }
}
