package main

import "core:fmt"

/*
 * Overview function to showcase Odin language
 *
 * It calls vars, literals, numbers, constants
 */
@(private)
overview :: proc() {
  fmt.println("Hellope!")

  vars()
  literals()
  numbers()
  constants()
}

@(private="package") // equivalent to @(private)
FRAME_RATE :: 60

@(private="file")
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

@(private="file")
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

@(private="file")
numbers :: proc() {
  x: int
  x = 1

  y := 1.0

  // a comment
  my_integer_variable: int
  one_million := 1.0e9

  fmt.printf("%d, %0.9f, %f\n", x, y, 0.2 + 0.1)
}

@(private="file")
constants :: proc() {
  y : int : 123
  z :: (y + 7) * 2

  fmt.println(y, z)
}
