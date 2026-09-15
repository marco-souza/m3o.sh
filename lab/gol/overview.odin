package main

import "core:fmt"

vars :: proc() {
  i := 10
  // x := 20 // Redeclaration
  j, q := 20, 30

  v: int

  fmt.println("v", v)

  x, y := 1, "hello"
  y, x = "bye", 5

  fmt.println(x, y)
}

literals :: proc() {
  fmt.println("This is a string")
  fmt.println('A')
  fmt.println('\n')
  fmt.println("C:\\Windows\\notepad.exe")
  fmt.println(`C:\Windows\notepad.exe`)
  fmt.println('\a') // bell (BEL)
  fmt.println('\b') // backspace (BS)
  fmt.println('\e') // escape (ESC)
}

main :: proc() {
  fmt.println("Hellope!")

  vars()
  literals()
}
