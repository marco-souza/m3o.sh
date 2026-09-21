package examples

import "vendor:raylib"

Vector2 :: [2]f32

delta_time_loop :: proc() {
  raylib.InitWindow(SCREEN_WIDTH, SCREEN_HEIGHT, "raylib [code] example - basic window")
  defer raylib.CloseWindow()

  deltaCircle := Vector2{0, SCREEN_HEIGHT / 3.0}
  frameCircle := Vector2{0, SCREEN_HEIGHT / (3.0 / 2.0)}

  currentFps := i32(TARGET_FPS)
  speed := f32(10.0)
  circleRadius := f32(32.0)

  raylib.SetTargetFPS(currentFps)

  for !raylib.WindowShouldClose() {
    // INFO: Update
    //----------------------------------------------------------------------------------

    // Adjust FPS with mouse wheel
    mouseWheel := raylib.GetMouseWheelMove()
    if (mouseWheel != 0.0) {
      currentFps += i32(mouseWheel)
      if (currentFps < 0) {
        currentFps = 0
      }

      raylib.SetTargetFPS(currentFps)
    }

    deltaCircle.x += raylib.GetFrameTime() * 6.0 * speed
    frameCircle.x += 0.1 * speed

    if deltaCircle.x > SCREEN_WIDTH { deltaCircle.x = 0 }
    if frameCircle.x > SCREEN_WIDTH { frameCircle.x = 0 }

    if raylib.IsKeyPressed(.R) {
      deltaCircle.x = 0
      frameCircle.x = 0
    }

    // INFO: Draw
    //----------------------------------------------------------------------------------
    raylib.BeginDrawing()

    raylib.ClearBackground(raylib.RAYWHITE)

    raylib.DrawCircleV(deltaCircle, circleRadius, raylib.RED)
    raylib.DrawCircleV(frameCircle, circleRadius, raylib.BLUE)

    // draw a help text
    text := currentFps <= 0 ? (
      raylib.TextFormat("FPS: unlimited (%i)", raylib.GetFPS())
    ) : (
      raylib.TextFormat("FPS: %i, (target: %i)", raylib.GetFPS(), currentFps)
    )
    raylib.DrawText(text, 10, 10, 20, raylib.DARKGRAY)

    raylib.DrawText(raylib.TextFormat("Frame time; %02.02f ms", raylib.GetFrameTime()), 10, 30, 20, raylib.DARKGRAY)
    raylib.DrawText("Use the scroll wheel to change the fps limit, r to reset", 10, 50, 20, raylib.DARKGRAY)

    // Draw the text above the circles
    raylib.DrawText("FUNC: x += GetFrameTime() * speed", 10, 90, 20, raylib.RED)
    raylib.DrawText("FUNC: x += speed", 10, 240, 20, raylib.BLUE)

    raylib.EndDrawing()
  }
}

