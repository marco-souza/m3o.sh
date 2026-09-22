package examples

import "vendor:raylib"

input_mouse_wheel_loop :: proc() {
  raylib.InitWindow(SCREEN_WIDTH, SCREEN_HEIGHT, "raylib [core] example - input mouse wheel")
  defer raylib.CloseWindow()

  boxPosition := Vector2{ SCREEN_WIDTH / 2 - 40, SCREEN_HEIGHT / 2 - 40 }
  scrollSpeed := f32(4)

  raylib.SetTargetFPS(60)

  for !raylib.WindowShouldClose() {
    // Update
    //--------------------------------------------------------------------------------
    wheelMove := raylib.GetMouseWheelMoveV()
    boxPosition.y -= wheelMove.y * scrollSpeed
    boxPosition.x -= wheelMove.x * scrollSpeed
    //--------------------------------------------------------------------------------

    // Draw
    //--------------------------------------------------------------------------------
    raylib.BeginDrawing()

    raylib.ClearBackground(raylib.WHITE)

    raylib.DrawRectangle(i32(boxPosition.x), i32(boxPosition.y), 80, 80, raylib.MAROON)

    raylib.DrawText("Use the mouse wheel to move the cube!", 10, 10, 20, raylib.GRAY)
    text := raylib.TextFormat("boxPosition: x=%0.2f, y=%0.2f", boxPosition.x, boxPosition.y)
    raylib.DrawText(text, 10, 30, 20, raylib.GRAY)


    raylib.EndDrawing()
    //--------------------------------------------------------------------------------
  }
}
