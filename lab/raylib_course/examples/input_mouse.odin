package examples

import "vendor:raylib"

input_mouse_loop :: proc() {
  raylib.InitWindow(SCREEN_WIDTH, SCREEN_HEIGHT, "raylib [core] example - input mouse")
  defer raylib.CloseWindow()

  ballPosition := Vector2{ -100.0, -100.0 }
  ballColor := raylib.DARKBLUE

  raylib.SetTargetFPS(60)

  for !raylib.WindowShouldClose() {
    // Update
    //--------------------------------------------------------------------------------
    if raylib.IsKeyPressed(.H) {
      if raylib.IsCursorHidden() { raylib.ShowCursor() }
      else { raylib.HideCursor() }
    }

    ballPosition = raylib.GetMousePosition()

    switch {
    case raylib.IsMouseButtonPressed(.LEFT): ballColor = raylib.MAROON
    case raylib.IsMouseButtonPressed(.MIDDLE): ballColor = raylib.LIME
    case raylib.IsMouseButtonPressed(.RIGHT): ballColor = raylib.DARKBLUE
    case raylib.IsMouseButtonPressed(.SIDE): ballColor = raylib.PURPLE
    case raylib.IsMouseButtonPressed(.EXTRA): ballColor = raylib.YELLOW
    case raylib.IsMouseButtonPressed(.FORWARD): ballColor = raylib.ORANGE
    case raylib.IsMouseButtonPressed(.BACK): ballColor = raylib.BEIGE
    }
    //--------------------------------------------------------------------------------


    // Draw
    //--------------------------------------------------------------------------------
    raylib.BeginDrawing()

    raylib.ClearBackground(raylib.WHITE)

    raylib.DrawCircleV(ballPosition, 40, ballColor)

    raylib.DrawText("move the ball with mouse and click mouse button to change color", 10, 10, 20, raylib.DARKGRAY)
    raylib.DrawText("Press 'H' to toggle cursor visibility", 10, 30, 20, raylib.DARKGRAY)

    if raylib.IsCursorHidden() {
      raylib.DrawText("CURSOR HIDDEN", 20, 60, 20, raylib.RED)
    } else {
      raylib.DrawText("CURSOR VISIBLE", 20, 60, 20, raylib.LIME)
    }

    raylib.EndDrawing()
    //--------------------------------------------------------------------------------
  }
}
