package main

import "vendor:curl"
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

fetch :: proc() {
  // Initialize libCURL
  curl.global_init(curl.GLOBAL_ALL)
  defer curl.global_cleanup()

  handle := curl.easy_init()
  if handle != nil {
    defer curl.easy_cleanup(handle)

    // Set the target URL
    curl.easy_setopt(handle, .URL, "https://api.github.com/users/marco-souza")

    // Follow redirects if necessary
    curl.easy_setopt(handle, .FOLLOWLOCATION, i64(1))

    // Headers
    headers: ^curl.slist = nil

    headers = curl.slist_append(headers, "User-Agent: Odin-Curl-Client/1.0")
    headers = curl.slist_append(headers, "Content-Type: application/json")

    defer curl.slist_free_all(headers)

    curl.easy_setopt(handle, .HTTPHEADER, headers)

    // Perform the request
    res := curl.easy_perform(handle)
    if res != .E_OK {
      fmt.printf("CURL Error: %s\n", curl.easy_strerror(res))
    }
  }
}
