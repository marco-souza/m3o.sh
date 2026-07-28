#!/usr/bin/env bash
#
# m3o.sh/install — one-shot dev environment bootstrapper.
#
# Usage: curl -sSL m3o.sh/install | sh
#
# Turns a fresh macOS or Manjaro Linux machine into a fully-configured dev
# environment: bootstraps the package manager and 1Password, pulls the SSH key
# from 1Password, configures git, clones the private dotfiles repo, and runs
# the existing interactive post-install scripts. Idempotent — re-run for
# updates. One-shot or fail.
#
# Architectural decisions:
#   - ADR-0001 (docs/adr/0001-inline-os-detection.md): carry inline OS
#     detection; let post-install own the dotfiles Helpers. The bootstrapper
#     never sources useful-functions.sh directly.
#   - ADR-0002 (docs/adr/0002-pin-github-host-key.md): pin GitHub's published
#     ed25519 host key in ~/.ssh/known_hosts before the first clone, rather
#     than TOFU via ssh-keyscan/accept-new.
#
# License: GPL v3 (see LICENSE in the source repository).
# Copyright (C) marco souza. See LICENSE for details.
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
# GNU General Public License for more details.

# shellcheck shell=bash disable=SC1010,SC2329
# ShellCheck notes (all acceptable, see T013 validation):
#   - SC1010 on `<var>=done`: false positive — `done`/`skipped`/`failed`/
#     `pending` are string VALUES of the step-outcome vars, not the loop
#     keyword (current ShellCheck 0.11 flags the reserved word in assignment
#     position; newer releases do not). No semantic effect.
#   - SC2329 on stop_sudo_refresh / on_exit / sudo_refresh_kill_sleep: these
#     are wired indirectly via `trap ... EXIT`/`trap ... TERM` and a backgrounded
#     subshell, which ShellCheck's static call-graph cannot follow.
set -euo pipefail

# Verbose mode: opt in with M3O_INSTALL_VERBOSE=1 to trace every command
# (set -x) for debugging this bootstrapper. Disabled again on exit so the
# trace never outlives the run. Note: set -x may print operand values, so
# only opt in when you accept that — never set this for a run that handles
# secrets on a shared terminal. (US-9)
if [ "${M3O_INSTALL_VERBOSE:-0}" = "1" ]; then
  M3O_INSTALL_VERBOSE_ON=1
  set -x
else
  M3O_INSTALL_VERBOSE_ON=""
fi

# === Globals ===

# Set to non-empty before the script exits so the EXIT trap can tell a clean
# exit from an abort() failure path. Any abort() sets this first. NOT readonly —
# abort() must be able to reassign it so the EXIT trap can tell abort from clean.
M3O_INSTALL_FAILED=""

# 1Password account email — baked in (FR-5). Used as the suggested default for
# `git config --global user.email` (FR-6) and as the `op signin` email later.
M3O_OP_ACCOUNT_EMAIL="ma.souza.junior@gmail.com"
readonly M3O_OP_ACCOUNT_EMAIL

# 1Password account shorthand — baked in (FR-5). The local nickname for the
# account; used to detect a re-run (Account already in `op account list`) and
# to re-authenticate it (`op signin my`).
M3O_OP_ACCOUNT_SHORTHAND="my"
readonly M3O_OP_ACCOUNT_SHORTHAND

# 1Password sign-in address — baked in (FR-5). The 1Password.com tenant URL
# for the account. Shown to the user as the address to enter during the
# first-run `op signin add` flow.
M3O_OP_SIGNIN_ADDRESS="my.1password.com"
readonly M3O_OP_SIGNIN_ADDRESS

# GitHub SSH private key path — baked in (FR-7). The single key this
# bootstrapper provisions for GitHub auth, pulled from 1Password.
M3O_SSH_KEY_PATH="${HOME}/.ssh/id_ed25519"
readonly M3O_SSH_KEY_PATH

# 1Password item reference for the GitHub private key — baked in (FR-7).
# Passed verbatim to `op read`; the `ssh-format=openssh` query returns the
# key in OpenSSH PEM form ready to drop into ~/.ssh/id_ed25519.
M3O_SSH_KEY_OP_REF="op://Personal/adg7byn6uoyddbgrixkywym6ra/private key?ssh-format=openssh"
readonly M3O_SSH_KEY_OP_REF

# Expected SHA256 fingerprint of the GitHub private key — baked in (FR-7).
# Used to verify a key freshly fetched from 1Password and to detect a stale /
# wrong key already on disk (mismatch → abort with actionable remediation).
M3O_SSH_KEY_FINGERPRINT="SHA256:5IuiYHayj6HHg2Ra5hM49GCRWJflx2DZcwTTkw5dF/Q"
readonly M3O_SSH_KEY_FINGERPRINT

# GitHub's officially published SSH ed25519 host key (ADR-0002). Baked in so
# the bootstrapper can append it to ~/.ssh/known_hosts BEFORE the first clone
# over SSH executes — there is no TTY under `curl | sh`, so the usual
# accept-on-first-use prompt would fail the clone with "Host key verification
# failed". MITM-proof and verifiable against docs.github.com by any reader
# before piping. If GitHub rotates the key the bootstrapper breaks loudly and
# needs an update — an acceptable, low-frequency event GitHub announces ahead.
M3O_GITHUB_HOST_KEY="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl github.com"
readonly M3O_GITHUB_HOST_KEY

# Workspace parent dir for cloned repos. The dotfiles work tree lives under
# here at a predictable path the post-install phase can target.
M3O_WORKSPACE_DIR="${HOME}/w/marco-souza"
readonly M3O_WORKSPACE_DIR

# The dotfiles work tree itself — the private repo we clone over SSH using the
# provisioned key, then keep up to date on re-runs with `git pull --ff-only`.
M3O_DOTFILES_DIR="${M3O_WORKSPACE_DIR}/dotfiles"
readonly M3O_DOTFILES_DIR

# dotfiles SSH clone URL (private repo — requires the provisioned SSH key).
M3O_DOTFILES_GIT_URL="git@github.com:marco-souza/dotfiles.git"
readonly M3O_DOTFILES_GIT_URL

# PID of the background sudo timestamp refresh loop (see start_sudo_refresh).
# Empty when no loop is running. NOT readonly — on_exit must be able to clear it.
SUDO_REFRESH_PID=""

# Post-install script name + captured exit code, recorded by run_post_install
# for the final summary (FR-10). Empty before that phase runs. NOT readonly —
# run_post_install assigns them, and the summary reads them.
M3O_POST_INSTALL_SCRIPT=""
M3O_POST_INSTALL_EXIT=""

# === Step outcome tracking (FR-10) ===
#
# Per-step outcomes recorded as the narrative progresses so the final
# summary can list each step as done/skipped/failed. "pending" is the
# pre-run default; a step that never runs (e.g. an abort before it) stays
# pending and is rendered as such. Bash 3.2 (macOS) has no associative
# arrays, so each step gets its own scalar var. NOT readonly — the phases
# assign them, the summary reads them.
M3O_STEP_PM="pending"            # Package manager bootstrap
M3O_STEP_1PASSWORD="pending"     # 1Password GUI + CLI install
M3O_STEP_OP_SIGNIN="pending"     # 1Password sign-in
M3O_STEP_SSH_KEY="pending"       # SSH key setup
M3O_STEP_GH_HOST="pending"       # GitHub SSH host block
M3O_STEP_GH_HOSTKEY="pending"    # GitHub host key pinning
M3O_STEP_GIT="pending"           # Git global config
M3O_STEP_DOTFILES="pending"      # Dotfiles clone / update
M3O_STEP_POST_INSTALL="pending"  # Post-install script

# Sub-outcomes for 1Password (GUI + CLI) so bootstrap_1password can compute
# a single step outcome: skipped only when BOTH were skipped, done otherwise.
M3O_1P_GUI_OUT="pending"
M3O_1P_CLI_OUT="pending"

# === Section Banner ===

# Print a section banner. Usage: banner "Step name"
# Renders as: === Step name === on its own line, between blank lines.
banner() {
  printf '\n=== %s ===\n' "${1:?banner: section name required}"
}

# === Output Helpers ===

# Colored output helpers. Colors are disabled when output is not a TTY so the
# piped `curl | sh` path stays clean and log-greppable. ANSI codes are only
# emitted on an interactive terminal.
if [ -t 1 ]; then
  M3O_INFO_COLOR=$'\033[1;34m' # bold blue
  M3O_FAIL_COLOR=$'\033[1;31m' # bold red
  M3O_RESET_COLOR=$'\033[0m'
else
  M3O_INFO_COLOR=""
  M3O_FAIL_COLOR=""
  M3O_RESET_COLOR=""
fi
readonly M3O_INFO_COLOR M3O_FAIL_COLOR M3O_RESET_COLOR

# info: a normal, informational message.
info() {
  printf '%s[INFO]%s %s\n' "${M3O_INFO_COLOR}" "${M3O_RESET_COLOR}" "${1:?info: message required}"
}

# fail: a failure message. Does NOT exit — use abort() when you want to stop.
fail() {
  printf '%s[FAIL]%s %s\n' "${M3O_FAIL_COLOR}" "${M3O_RESET_COLOR}" "${1:?fail: message required}" >&2
}

# abort: print a failure message with actionable remediation, then exit 1.
# Marks the run as failed so the EXIT trap knows it was an abort path.
abort() {
  M3O_INSTALL_FAILED=1
  fail "${1:?abort: message required}"
  exit 1
}

# === Exit Trap ===

# stop_sudo_refresh — tear down the background sudo timestamp refresh loop.
# Idempotent: safe to call when no loop is running. We pkill direct children
# (e.g. a running `sudo`) then SIGTERM the loop subshell. The subshell also has
# its own EXIT trap that kills its active `sleep`, so the race where a `sleep`
# spawns between the two kills never leaves an orphan. FR-2.
stop_sudo_refresh() {
  if [ -n "${SUDO_REFRESH_PID:-}" ]; then
    pkill -P "$SUDO_REFRESH_PID" 2>/dev/null || true
    kill "$SUDO_REFRESH_PID" 2>/dev/null || true
    SUDO_REFRESH_PID=""
  fi
}

# Cleanup trap. Fires on every exit — clean or otherwise. Kills the sudo
# refresh loop so re-runs never leave orphan `sudo -v`/`sleep` loops behind,
# then surfaces whether the run failed. FR-2.
on_exit() {
  stop_sudo_refresh
  # Turn off tracing on exit so any trailing shell output (e.g. from the trap
  # itself) isn't traced, and so a sourced/parent shell isn't affected.
  [ -n "${M3O_INSTALL_VERBOSE_ON:-}" ] && set +x
  if [ -n "${M3O_INSTALL_FAILED}" ]; then
    printf '\n[aborted] m3o.sh install did not complete.\n' >&2
  fi
}
trap on_exit EXIT

# === System Info ===

# Print OS, arch, user, home, and shell at the start so a reader (piping to a
# terminal or reading a log) can see what machine this ran on. FR-1.
print_system_info() {
  banner "System Info"
  info "OS:   ${OSTYPE:-unknown}"
  info "Arch: $(uname -m)"
  info "User: ${USER:-$(id -un)}"
  info "HOME: ${HOME:-unknown}"
  info "Shell: ${SHELL:-unknown}"
}

# === OS Detection ===

# Inline detect_os — same 3-line $OSTYPE logic as the private
# useful-functions.sh Helper, which is unavailable here because the dotfiles
# repo is not cloned yet (ADR-0001). Prints linux/macos/unknown to stdout.
# Duplicated by design; see ADR-0001.
detect_os() {
  case "${OSTYPE:-}" in
    linux*)  echo "linux"  ;;
    darwin*) echo "macos"  ;;
    *)       echo "unknown" ;;
  esac
}

# assert_supported_os — gate the run on a supported platform.
#   macos          → proceed (no further checks).
#   unknown OS     → abort with a clear message.
#   linux          → source /etc/os-release and require ID=manjaro AND
#                    ID_LIKE=arch; otherwise abort, naming PRETTY_NAME.
# Reads only the fields it needs and keeps them local so they never leak
# into the bootstrapper. FR-1 (see ADR-0001).
assert_supported_os() {
  local os os_release ID ID_LIKE PRETTY_NAME
  os="$(detect_os)"

  case "$os" in
    macos)
      info "Detected macOS — proceeding."
      return 0
      ;;
    unknown)
      abort "Unsupported OS (OSTYPE=\"${OSTYPE:-}\"). m3o.sh install supports macOS or Manjaro Linux only."
      ;;
    linux)
      # Defaults to /etc/os-release; M3O_OS_RELEASE exists only so the gate is
      # testable with a fake os-release (production never sets it).
      os_release="${M3O_OS_RELEASE:-/etc/os-release}"
      if [ ! -r "$os_release" ]; then
        abort "Linux detected but /etc/os-release is missing or unreadable; cannot confirm Manjaro."
      fi
      # Parse only the fields we need; they're local so they never leak.
      eval "$(grep -E '^(ID|ID_LIKE|PRETTY_NAME)=' "$os_release")"
      if [ "${ID:-}" = "manjaro" ] && [ "${ID_LIKE:-}" = "arch" ]; then
        info "Detected Manjaro Linux (arch-based) — proceeding."
        return 0
      fi
      abort "Unsupported Linux: \"${PRETTY_NAME:-${ID:-unknown}}\". m3o.sh install requires Manjaro (ID=manjaro, ID_LIKE=arch)."
      ;;
  esac
}

# === Sudo Validation + Background Refresh ===

# Cache the sudo timestamp up front, then keep it warm for the lifetime of the
# script with a background refresh loop. On macOS this is mostly a no-op-ish
# convenience ( Homebrew calls don't elevate ), but on Manjaro it is required so
# pacman/yay prompts don't interrupt the run. FR-2.
#
# We run `sudo -v` synchronously first so a password prompt happens on the
# user's real TTY before any background work starts. The loop then calls
# `sudo -v` every 60s to extend the cached timestamp.
#
# stdin of the loop is wired to /dev/null and its output silenced so it never
# prompts or clutters the log; if the timestamp ever lapses the loop's
# `sudo -v` simply fails fast and tries again next cycle rather than hanging.
start_sudo_refresh() {
  info "Caching sudo timestamp…"
  if ! sudo -v; then
    abort "sudo authentication failed — password required to continue."
  fi

  # Background refresh loop. The subshell backgrounds `sleep` and `wait`s on
  # it; its traps kill that sleep when the loop is terminated. We trap both EXIT
  # and TERM because an EXIT trap alone does NOT run when the shell is killed by
  # SIGTERM — trapping TERM and calling `exit` makes the EXIT trap fire too.
  # This closes the race where killing the loop would otherwise orphan a
  # `sleep` spawned a moment later. `|| true` keeps a transient `sudo -v`
  # hiccup from tripping `set -e` and killing the loop; it just retries next
  # cycle. stdin is wired to /dev/null and output silenced so it never prompts
  # or clutters the log.
  (
    sudo_refresh_kill_sleep() { kill "${SLEEP_PID:-}" 2>/dev/null || true; }
    trap sudo_refresh_kill_sleep EXIT
    trap 'sudo_refresh_kill_sleep; exit' TERM
    while true; do
      sudo -v || true
      sleep 60 &
      SLEEP_PID=$!
      wait "$SLEEP_PID" 2>/dev/null || true
    done
  ) </dev/null >/dev/null 2>&1 &
  SUDO_REFRESH_PID=$!
  info "Sudo refresh loop started (pid ${SUDO_REFRESH_PID})."
}

# === Package Manager Bootstrap ===

# install_homebrew — install Homebrew on macOS via the official install
# script when `brew` is not on PATH. Idempotent: skipped if present. FR-3.
# `NONINTERACTIVE=1` keeps the installer from prompting or pausing for the
# press-RETURN gate, so the piped `curl | sh` path never blocks.
install_homebrew() {
  if command -v brew >/dev/null 2>&1; then
    info "brew already installed — skipping."
    M3O_STEP_PM=skipped
    return 0
  fi

  info "Installing Homebrew via the official install script…"
  # Download the installer first so a curl/network failure is caught here
  # rather than swallowed by `bash -c "$(...)"` (an empty script body exits 0).
  # NB: `local x="$(cmd)"` masks cmd's exit status, so we split the declare
  # from the assignment and test the command's status explicitly.
  local hb_install_script
  if ! hb_install_script="$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"; then
    abort "Homebrew download failed — check network and re-run."
  fi
  if ! NONINTERACTIVE=1 /bin/bash -c "$hb_install_script"; then
    abort "Homebrew install failed — see output above and re-run."
  fi

  # The installer drops brew under /opt/homebrew (Apple Silicon) or
  # /usr/local (Intel). Source its shellenv so `command -v brew` works in this
  # run without forcing a fresh login shell.
  if [ -x /opt/homebrew/bin/brew ]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [ -x /usr/local/bin/brew ]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi
  if ! command -v brew >/dev/null 2>&1; then
    abort "Homebrew installed but brew not on PATH — open a new shell and re-run."
  fi
  M3O_STEP_PM=done
  info "Homebrew installed."
}

# install_yay — install yay on Manjaro by pulling `git` + `base-devel` via
# pacman, then building yay from the AUR. Idempotent: skipped if present. FR-3.
# makepkg refuses to run as root, so the AUR build runs as the invoking user
# (the script already validated sudo up front for the pacman step).
install_yay() {
  if command -v yay >/dev/null 2>&1; then
    info "yay already installed — skipping."
    M3O_STEP_PM=skipped
    return 0
  fi

  info "Installing build dependencies (git, base-devel) via pacman…"
  if ! sudo pacman -S --needed --noconfirm git base-devel; then
    abort "pacman failed to install git + base-devel — check network/repos and re-run."
  fi

  local yay_build yay_url
  yay_build="$(mktemp -d -t m3o-yay-build.XXXXXX)"
  yay_url="https://aur.archlinux.org/yay.git"
  info "Cloning yay from AUR (${yay_url}) into ${yay_build}/yay…"
  if ! git clone --depth 1 "$yay_url" "$yay_build/yay"; then
    rm -rf "$yay_build"
    abort "Failed to clone yay from AUR — check network and re-run."
  fi

  info "Building and installing yay (makepkg -si --noconfirm)…"
  if ! (cd "$yay_build/yay" && makepkg -si --noconfirm); then
    rm -rf "$yay_build"
    abort "yay build/install failed — see makepkg output above and re-run."
  fi

  rm -rf "$yay_build"
  if ! command -v yay >/dev/null 2>&1; then
    abort "yay installed but not on PATH — open a new shell and re-run."
  fi
  M3O_STEP_PM=done
  info "yay installed."
}

# bootstrap_package_manager — ensure the platform package manager is on PATH.
# Dispatches by detected OS; idempotent. assert_supported_os has already gated
# the run to macos or Manjaro, so the unknown branch is defensive only. FR-3.
bootstrap_package_manager() {
  banner "Package Manager"
  local os
  os="$(detect_os)"
  case "$os" in
    macos) install_homebrew ;;
    linux) install_yay ;;
    *)     abort "Cannot bootstrap package manager on unsupported OS \"${os}\"." ;;
  esac
}

# === 1Password (GUI + CLI) ===

# install_1password_gui — install the 1Password desktop app. Idempotent,
# gated on `command -v` of the platform binary (not `brew list`/`pacman -Q`),
# so a non-brew install (e.g. downloaded from the website) is respected. FR-4.
# Installs independently of the CLI: the GUI is optional and only needed for
# interactive sign-in, while the CLI (`op`) is what the bootstrapper requires.
install_1password_gui() {
  local os
  os="$(detect_os)"
  case "$os" in
    macos)
      # The cask installs /Applications/1Password.app. `command -v` can't see an
      # .app bundle, so check the path the cask owns instead.
      if [ -x "/Applications/1Password.app/Contents/MacOS/2P-beta" ] || [ -d "/Applications/1Password.app" ]; then
        info "1Password GUI already installed — skipping."
        M3O_1P_GUI_OUT=skipped
        return 0
      fi
      info "Installing 1Password GUI via brew --cask 1password…"
      if ! brew install --cask 1password; then
        abort "Failed to install 1Password GUI — see brew output above and re-run."
      fi
      M3O_1P_GUI_OUT=done
      info "1Password GUI installed."
      ;;
    linux)
      # yay resolves `1password` from the AUR. `command -v` checks the binary
      # the package ships, so a manual/Discord-dmg install is also accepted.
      if command -v 1password >/dev/null 2>&1; then
        info "1Password GUI already installed — skipping."
        M3O_1P_GUI_OUT=skipped
        return 0
      fi
      info "Installing 1Password GUI via yay -S 1password…"
      if ! yay -S --needed --noconfirm 1password; then
        abort "Failed to install 1Password GUI — see yay output above and re-run."
      fi
      M3O_1P_GUI_OUT=done
      info "1Password GUI installed."
      ;;
    *)
      abort "Cannot install 1Password GUI on unsupported OS \"${os}\"."
      ;;
  esac
}

# install_1password_cli — install the 1Password CLI (`op`). Idempotent,
# gated on `command -v op` (not `brew list`), so a manual install is honored.
# Does NOT auto-upgrade an existing op: an installed op is left as-is, even if
# it's too old (that's caught later when the SSH key read is attempted; OQ-2).
# FR-4.
install_1password_cli() {
  local os
  os="$(detect_os)"
  case "$os" in
    macos)
      if command -v op >/dev/null 2>&1; then
        info "op (1Password CLI) already installed — skipping."
        M3O_1P_CLI_OUT=skipped
        return 0
      fi
      info "Installing 1Password CLI via brew --cask 1password-cli…"
      if ! brew install --cask 1password-cli; then
        abort "Failed to install 1Password CLI — see brew output above and re-run."
      fi
      ;;
    linux)
      if command -v op >/dev/null 2>&1; then
        info "op (1Password CLI) already installed — skipping."
        M3O_1P_CLI_OUT=skipped
        return 0
      fi
      info "Installing 1Password CLI via yay -S 1password-cli…"
      if ! yay -S --needed --noconfirm 1password-cli; then
        abort "Failed to install 1Password CLI — see yay output above and re-run."
      fi
      ;;
    *)
      abort "Cannot install 1Password CLI on unsupported OS \"${os}\"."
      ;;
  esac

  # Verify the CLI is now on PATH. The cask/AUR package owns `op`, so a missing
  # command after a reported-success install means PATH isn't wired yet (e.g.
  # a fresh cask install before a new login shell). Actionable abort per FR-4.
  if ! command -v op >/dev/null 2>&1; then
    abort "1Password CLI (op) not installed; cannot continue. Install manually and re-run."
  fi
  M3O_1P_CLI_OUT=done
  info "1Password CLI (op) installed."
}

# bootstrap_1password — install the GUI and CLI independently, then verify op.
# Each item is gated on `command -v` (or the platform binary path) so a re-run
# is a near no-op, and so a manual install is honored. The CLI is verified at
# the end because every later phase (sign-in, SSH key fetch) depends on it.
# FR-4. Does NOT upgrade an existing op (OQ-2).
bootstrap_1password() {
  banner "1Password"
  install_1password_gui
  install_1password_cli
  # Aggregate GUI + CLI sub-outcomes into the single 1Password step: skipped
  # only when both were skipped, done otherwise (FR-10).
  if [ "${M3O_1P_GUI_OUT}" = "skipped" ] && [ "${M3O_1P_CLI_OUT}" = "skipped" ]; then
    M3O_STEP_1PASSWORD=skipped
  elif [ "${M3O_1P_GUI_OUT}" = "failed" ] || [ "${M3O_1P_CLI_OUT}" = "failed" ]; then
    M3O_STEP_1PASSWORD=failed
  else
    M3O_STEP_1PASSWORD=done
  fi
}

# === 1Password Sign-In ===

# op_account_has_shorthand <shorthand> — true (exit 0) when `op account list`
# already knows an Account with the given shorthand (a re-run), false
# otherwise (first-run / empty account list). Exits non-zero (treated as
# "absent") if `op account list` itself fails — safe, because the caller
# then falls through to `op signin add`, which surfaces any real op problem.
# The JSON is parsed with grep (no jq dependency): `op account list --format=json`
# emits `[..., {"shorthand": "my", ...}, ...]`.
op_account_has_shorthand() {
  local list
  if ! list="$(op account list --format=json 2>/dev/null)"; then
    return 1
  fi
  [ -n "$list" ] || return 1
  printf '%s' "$list" | grep -Eq "\"shorthand\"[[:space:]]*:[[:space:]]*\"${1:?shorthand required}\""
}

# sign_in_1password — establish an active `op` session. Idempotent: skips
# when an authenticated session already exists (`op vault list` exits 0).
# Otherwise distinguishes first-run from re-run by whether `op account list`
# already contains the baked-in shorthand `my`, and runs the matching
# interactive `op signin` flow (FR-5):
#   - First-run (no Account): `op signin add` (prompts: sign-in address
#     my.1password.com, email ma.souza.junior@gmail.com, Secret Key, password)
#   - Re-run (Account present): `op signin my` (prompts: password only)
# On any `op signin` failure, aborts with the op error verbatim (edge case).
# Reads/writes via the user's real terminal (op owns the TTY prompts) so the
# piped `curl | sh` path still reaches the keyboard.
sign_in_1password() {
  banner "1Password Sign-In"

  # Active session — nothing to do.
  if op vault list >/dev/null 2>&1; then
    info "1Password session active — skipping sign-in."
    M3O_STEP_OP_SIGNIN=skipped
    return 0
  fi

  info "No active 1Password session — signing in."

  # Capture op's stderr verbatim so a failed signin can be re-emitted
  # unchanged (FR-5 edge case). Redirect stdout to /dev/null only — op writes
  # its interactive password/Secret-Key prompts to the TTY directly, so they
  # still reach the user's keyboard while only the real error text is kept.
  local op_err
  if op_account_has_shorthand "${M3O_OP_ACCOUNT_SHORTHAND}"; then
    info "Account \"${M3O_OP_ACCOUNT_SHORTHAND}\" already registered — running: op signin ${M3O_OP_ACCOUNT_SHORTHAND}"
    if ! op_err="$(op signin "${M3O_OP_ACCOUNT_SHORTHAND}" 2>&1 >/dev/null)"; then
      abort "op signin failed — resolve the error below and re-run:"$'\n'"${op_err}"
    fi
  else
    info "No registered 1Password account — running: op signin add"
    info "  sign-in address: ${M3O_OP_SIGNIN_ADDRESS}"
    info "  email:           ${M3O_OP_ACCOUNT_EMAIL}"
    info "  shorthand:       ${M3O_OP_ACCOUNT_SHORTHAND}"
    if ! op_err="$(op signin add 2>&1 >/dev/null)"; then
      abort "op signin add failed — resolve the error below and re-run:"$'\n'"${op_err}"
    fi
  fi

  info "1Password signed in."
  M3O_STEP_OP_SIGNIN=done
}

# === SSH Key Setup ===

# parse_ssh_fingerprint <ssh-keygen -lf output> — print just the SHA256:...
# token from an `ssh-keygen -lf <path>` line. `ssh-keygen -lf` prints:
#   "<path> <bits> SHA256:<b64> <comment>"
# (the leading <path> may be absent when the key has no comment). We extract
# the first SHA256: token and print it; empty output means the line had none
# (caller treats that as unparseable → abort). No jq; just grep -oE.
parse_ssh_fingerprint() {
  # `grep -oE ... | head -n1` can exit non-zero in two cases: grep finds no
  # SHA256 token (exit 1) — the empty-output case the caller handles — or head
  # closes the pipe after the first match and grep gets SIGPIPE (141) when the
  # input had >1 token. `|| true` keeps both from tripping `set -e`/`pipefail`
  # so the caller's "could not parse" abort gets to run, and the first match
  # is still what's printed.
  printf '%s' "${1:?parse_ssh_fingerprint: input required}" \
    | grep -oE 'SHA256:[A-Za-z0-9+/]+={0,2}' | head -n1 || true
}

# setup_ssh_key — ensure the GitHub SSH private key lives at ~/.ssh/id_ed25519,
# pulled from 1Password, and verified by fingerprint. Idempotent (FR-7):
#   - ~/.ssh created chmod 700 if missing (chmod is re-applied each run so a
#     pre-existing ~/.ssh with wrong perms is also fixed).
#   - key missing → `op read` the 1Password item → write chmod 600.
#   - key present → compare `ssh-keygen -lf` fingerprint to expected:
#       match   → skip (idempotent re-run)
#       mismatch → abort with actionable `rm ~/.ssh/id_ed25519` remediation
# Aborts if `op read` fails (e.g. op too old for the SSH key item type —
# OQ-2: tells the user to upgrade op manually, then re-run). Requires an
# active op session (sign_in_1password runs first).
setup_ssh_key() {
  banner "SSH Key"

  # ssh-keygen is what verifies the key later; gate up front with an
  # actionable message so a missing OpenSSH fails here, not deep in op read.
  if ! command -v ssh-keygen >/dev/null 2>&1; then
    abort "ssh-keygen not found on PATH — install OpenSSH (macOS: xcode-select --install; Linux: re-run package-manager bootstrap) and re-run."
  fi

  # ~/.ssh with chmod 700 (FR-7). mkdir -p is a no-op on an existing dir, so
  # chmod is applied unconditionally — cheap, and corrects a pre-existing dir
  # whose perms drifted without dropping its contents.
  if [ ! -d "${HOME}/.ssh" ]; then
    info "Creating ~/.ssh (chmod 700)…"
    mkdir -p "${HOME}/.ssh"
  fi
  chmod 700 "${HOME}/.ssh"

  if [ ! -f "${M3O_SSH_KEY_PATH}" ]; then
    info "No SSH key at ${M3O_SSH_KEY_PATH} — fetching from 1Password…"
    # Capture op's stderr verbatim so a failed read can be re-emitted unchanged
    # (mirrors the sign-in error handling). stdout holds the key material on
    # success; we keep stderr with it so the abort shows the real op error when
    # the command itself fails (an empty stdout + exit 0 is caught below).
    local key_material
    if ! key_material="$(op read "${M3O_SSH_KEY_OP_REF}" 2>&1)"; then
      abort "Failed to read SSH key from 1Password (${M3O_SSH_KEY_OP_REF}):"$'\n'"${key_material}"$'\n'"If op is too old to support the SSH key item type, upgrade op manually, then re-run."
    fi
    if [ -z "$key_material" ]; then
      abort "1Password returned an empty SSH key for ${M3O_SSH_KEY_OP_REF} — check the item exists in 1Password and re-run."
    fi
    printf '%s\n' "$key_material" >"${M3O_SSH_KEY_PATH}"
    chmod 600 "${M3O_SSH_KEY_PATH}"
    info "SSH key written to ${M3O_SSH_KEY_PATH} (chmod 600)."
    M3O_STEP_SSH_KEY=done
  else
    info "SSH key exists at ${M3O_SSH_KEY_PATH} — verifying fingerprint…"
    local keygen_out actual_fp
    if ! keygen_out="$(ssh-keygen -lf "${M3O_SSH_KEY_PATH}" 2>/dev/null)"; then
      abort "Cannot read fingerprint of ${M3O_SSH_KEY_PATH} (ssh-keygen -lf failed) — file may be corrupt; remove it and re-run: rm ${M3O_SSH_KEY_PATH}"
    fi
    actual_fp="$(parse_ssh_fingerprint "$keygen_out")"
    if [ -z "$actual_fp" ]; then
      abort "Could not parse a SHA256 fingerprint from ssh-keygen output for ${M3O_SSH_KEY_PATH} — remove the key and re-run: rm ${M3O_SSH_KEY_PATH}"
    fi
    if [ "$actual_fp" = "${M3O_SSH_KEY_FINGERPRINT}" ]; then
      info "Fingerprint matches expected (${actual_fp}) — keeping existing key."
      M3O_STEP_SSH_KEY=skipped
    else
      abort "Existing ${M3O_SSH_KEY_PATH} does not match the 1Password key (got ${actual_fp}, want ${M3O_SSH_KEY_FINGERPRINT}). If intentional, remove it and re-run: rm ${M3O_SSH_KEY_PATH}"
    fi
  fi
}

# github_ssh_resolved — true (exit 0) when `ssh -G github.com` already maps
# github.com to GitHub (hostname github.com AND user git). `ssh -G` is the
# real resolver, so it honors `Include`d files and existing `Host github.com`
# blocks — meaning an already-configured machine is detected and we skip
# appending a duplicate block. Output keys from `ssh -G` are lowercase
# (e.g. `hostname github.com`, `user git`); we match the whole token so a
# value like `github.com.evil.com` cannot satisfy `hostname github.com`.
github_ssh_resolved() {
  local resolved
  if ! resolved="$(ssh -G github.com 2>/dev/null)"; then
    return 1
  fi
  printf '%s\n' "$resolved" | grep -Eq '^hostname[[:space:]]+github\.com([[:space:]]|$)' \
    && printf '%s\n' "$resolved" | grep -Eq '^user[[:space:]]+git([[:space:]]|$)'
}

# configure_github_ssh_host — append a `Host github.com` block to
# ~/.ssh/config ONLY when `ssh -G github.com` does not already resolve to
# GitHub (hostname github.com, user git). Using `ssh -G` (the real resolver,
# which honors Include'd files and existing blocks) both avoids missing an
# existing block and avoids duplicating/overwriting one — so re-runs are a
# no-op (FR-7). Creates ~/.ssh/config (chmod 600) if absent; appends only.
# `IgnoreUnknown UseKeychain` keeps the block portable: macOS recognizes
# `UseKeychain`, while Linux (which doesn't) ignores it instead of erroring.
configure_github_ssh_host() {
  banner "GitHub SSH Host"

  if ! command -v ssh >/dev/null 2>&1; then
    abort "ssh not found on PATH — install OpenSSH and re-run."
  fi

  if github_ssh_resolved; then
    info "ssh -G github.com already resolves to GitHub (github.com / git) — skipping host config."
    M3O_STEP_GH_HOST=skipped
    return 0
  fi

  info "Appending Host github.com block to ~/.ssh/config…"
  # Touch + chmod defensively so a missing config is created with safe perms
  # before append; never rewrite existing content (append-only).
  touch "${HOME}/.ssh/config"
  chmod 600 "${HOME}/.ssh/config"

  {
    printf '\n'
    printf 'Host github.com\n'
    printf '  HostName github.com\n'
    printf '  User git\n'
    printf '  IdentityFile ~/.ssh/id_ed25519\n'
    printf '  AddKeysToAgent yes\n'
    printf '  IgnoreUnknown UseKeychain\n'
    printf '  UseKeychain yes\n'
  } >>"${HOME}/.ssh/config"

  info "GitHub SSH host block added."
  M3O_STEP_GH_HOST=done
}

# === Main ===

# configure_git — set global git identity and init default branch. Checks
# user.name and user.email; prompts for any missing value (default email =
# the 1Password account email, overridable; user.name has no default). Sets
# init.defaultBranch=main. Idempotent: skips any value already set. No
# --force (NG8) — to redo, the user edits `git config` and re-runs. FR-6.
# Prompts read from /dev/tty so the piped `curl | sh` path still reaches the
# user's real terminal (same model sudo -v uses).
configure_git() {
  banner "Git"

  # git must be on PATH before we can configure it. install_yay pulls it via
  # pacman on Manjaro; on macOS it ships with the Xcode Command Line Tools.
  if ! command -v git >/dev/null 2>&1; then
    abort "git not found on PATH — install Xcode Command Line Tools (macOS: xcode-select --install) or re-run package-manager bootstrap (Linux), then re-run."
  fi

  # Couplet counter: >0 means at least one value was actually set this run
  # (done); 0 means everything was already configured (skipped). FR-10.
  local git_changed=0
  local current_name git_user_name
  current_name="$(git config --global user.name 2>/dev/null || true)"
  if [ -n "$current_name" ]; then
    info "git user.name already set (\"${current_name}\") — skipping."
  else
    while true; do
      printf 'Enter git user.name (global): '
      read -r git_user_name </dev/tty
      if [ -n "$git_user_name" ]; then
        break
      fi
      fail "user.name cannot be empty."
    done
    git config --global user.name "$git_user_name"
    info "git user.name set to \"${git_user_name}\"."
    git_changed=1
  fi

  local current_email git_user_email
  current_email="$(git config --global user.email 2>/dev/null || true)"
  if [ -n "$current_email" ]; then
    info "git user.email already set (\"${current_email}\") — skipping."
  else
    printf 'Enter git user.email (global) [%s]: ' "${M3O_OP_ACCOUNT_EMAIL}"
    read -r git_user_email </dev/tty
    # Empty input accepts the suggested default (FR-6).
    if [ -z "$git_user_email" ]; then
      git_user_email="${M3O_OP_ACCOUNT_EMAIL}"
    fi
    git config --global user.email "$git_user_email"
    info "git user.email set to \"${git_user_email}\"."
    git_changed=1
  fi

  local current_branch
  current_branch="$(git config --global init.defaultBranch 2>/dev/null || true)"
  if [ -n "$current_branch" ]; then
    info "git init.defaultBranch already set (\"${current_branch}\") — skipping."
  else
    git config --global init.defaultBranch main
    info "git init.defaultBranch set to \"main\"."
    git_changed=1
  fi

  if [ "$git_changed" -eq 0 ]; then
    M3O_STEP_GIT=skipped
  else
    M3O_STEP_GIT=done
  fi
}

# === GitHub Host Key Pinning ===

# github_host_key_present — true (exit 0) when ~/.ssh/known_hosts already
# contains the pinned GitHub ed25519 host key line. Uses `grep -F` (fixed
# strings) so the base64 payload is matched literally — no regex metachar
# surprises — and treats a missing known_hosts file as "not present" so the
# caller falls through to append it. (ADR-0002.)
github_host_key_present() {
  [ -f "${HOME}/.ssh/known_hosts" ] || return 1
  grep -Fq "${M3O_GITHUB_HOST_KEY}" "${HOME}/.ssh/known_hosts"
}

# pin_github_host_key — append GitHub's officially published ed25519 host
# key to ~/.ssh/known_hosts ONLY when not already present, before the first
# `git clone` over SSH runs. Under `curl | sh` there is no TTY, so the
# standard accept-on-first-use prompt cannot fire and ssh would reject the
# clone with "Host key verification failed". Baking the published key makes
# the clone MITM-proof without trusting whatever `ssh-keyscan`/`accept-new`
# would return, and any reader can verify it against docs.github.com before
# piping. Idempotent (re-run is a no-op). Requires ~/.ssh (setup_ssh_key ran
# first). (ADR-0002.)
pin_github_host_key() {
  banner "GitHub Host Key"

  # setup_ssh_key created ~/.ssh; recreate defensively so the pin step is
  # safe even if this function is ever run standalone.
  if [ ! -d "${HOME}/.ssh" ]; then
    mkdir -p "${HOME}/.ssh"
    chmod 700 "${HOME}/.ssh"
  fi

  if github_host_key_present; then
    info "GitHub ed25519 host key already pinned in ~/.ssh/known_hosts — skipping."
    M3O_STEP_GH_HOSTKEY=skipped
    return 0
  fi

  local known_hosts="${HOME}/.ssh/known_hosts"
  info "Pinning GitHub's published ed25519 host key in ${known_hosts}…"
  # Append-only; never rewrite existing known_hosts content. touch creates it
  # with umask perms (typically 0644, which ssh accepts) when absent.
  touch "$known_hosts"
  printf '%s\n' "${M3O_GITHUB_HOST_KEY}" >>"$known_hosts"
  info "GitHub host key pinned."
  M3O_STEP_GH_HOSTKEY=done
}

# === Dotfiles Clone / Update ===

# clone_dotfiles — ensure the private dotfiles repo exists at
# ${M3O_DOTFILES_DIR}, cloning it over SSH when absent or fast-forwarding it
# when present. Requires the provisioned SSH key (setup_ssh_key), the GitHub
# host block (configure_github_ssh_host), the pinned host key
# (pin_github_host_key), and git (configure_git ensured `command -v git`).
# Idempotent (FR-7): a re-run with no upstream changes is a near no-op —
# `git pull --ff-only` prints "Already up to date." and exits 0.
clone_dotfiles() {
  banner "Dotfiles"

  if ! command -v git >/dev/null 2>&1; then
    abort "git not found on PATH — re-run so package-manager bootstrap can install it."
  fi

  # Create the workspace parent so the clone has somewhere to land. mkdir -p
  # is a no-op when it already exists.
  mkdir -p "${M3O_WORKSPACE_DIR}"

  if [ ! -d "${M3O_DOTFILES_DIR}" ] || [ ! -d "${M3O_DOTFILES_DIR}/.git" ]; then
    info "No dotfiles checkout at ${M3O_DOTFILES_DIR} — cloning from ${M3O_DOTFILES_GIT_URL}…"
    # Fresh clone over SSH. The pinned host key means ssh never prompts to
    # accept GitHub's key, so this succeeds under `curl | sh` with no TTY.
    if ! git clone "${M3O_DOTFILES_GIT_URL}" "${M3O_DOTFILES_DIR}"; then
      abort "git clone of dotfiles failed — see output above (check SSH key, 1Password session, network) and re-run."
    fi
    info "Dotfiles cloned to ${M3O_DOTFILES_DIR}."
    M3O_STEP_DOTFILES=done
    return 0
  fi

  info "Dotfiles already checked out at ${M3O_DOTFILES_DIR} — pulling (--ff-only)…"
  # --ff-only keeps the local branch a clean mirror of origin: no merge
  # commit, no rebase. A diverged local aborts loudly rather than silently
  # rewriting the user's history. Run inside the checkout via `git -C` so we
  # never `cd` and risk leaving the script's CWD somewhere unexpected on
  # failure.
  if ! git -C "${M3O_DOTFILES_DIR}" pull --ff-only; then
    abort "git pull --ff-only failed in ${M3O_DOTFILES_DIR} — the local branch has diverged. Resolve manually (e.g. git reset --hard origin/<branch>) and re-run."
  fi
  info "Dotfiles up to date."
  M3O_STEP_DOTFILES=skipped
}

# === Post-Install ===

# run_post_install — from the cloned dotfiles dir, run the OS-specific
# post-install script (macos-post-install.sh on macOS, manjaro-post-install.sh
# on Manjaro). The post-install scripts source their own Helpers
# (useful-functions.sh); the bootstrapper NEVER sources it directly (ADR-0001)
# — that keeps the Helper file's top-level `brew upgrade`/`yay -Syu` side
# effects from firing on every bootstrapper source, which would break the
# idempotent re-run goal, and keeps the bootstrapper honest about its deps.
#
# Exit code is propagated: a non-zero post-install makes the bootstrapper exit
# non-zero, after printing a breadcrumb naming the script and its exit code so
# a failure leaves a clear trail (FR-9). The steps before post-install are
# idempotent, so the user can re-run `curl -sSL m3o.sh/install | sh` and resume
# from where it left off.
run_post_install() {
  banner "Post-Install"

  local os script exit_code script_path
  os="$(detect_os)"
  case "$os" in
    macos) script="macos-post-install.sh" ;;
    linux) script="manjaro-post-install.sh" ;;
    *)     abort "Cannot run post-install on unsupported OS \"${os}\"." ;;
  esac

  script_path="${M3O_DOTFILES_DIR}/${script}"
  if [ ! -f "$script_path" ]; then
    abort "Post-install script not found at ${script_path} — dotfiles clone may be incomplete; re-run."
  fi

  info "Running ${script} from ${M3O_DOTFILES_DIR}…"
  # Spawn the post-install as a child process (`bash <script>`), never `source`
  # it into this shell. `set -e`/`pipefail` do NOT propagate into a child, and
  # a non-zero exit is captured here so we can translate it into the breadcrumb
  # + bootstrapper non-zero exit. We disable `set -e` around the call so a
  # non-zero post-install falls through to our handling instead of aborting
  # the bootstrapper before the breadcrumb prints. We do NOT `cd` into the
  # dotfiles dir — running `bash <path>` keeps the bootstrapper's CWD stable;
  # the post-install sources its own Helpers relative to its own path.
  set +e
  bash "$script_path"
  exit_code=$?
  set -e

  # Record for the final summary (FR-10).
  M3O_POST_INSTALL_SCRIPT="$script"
  M3O_POST_INSTALL_EXIT="$exit_code"

  if [ "$exit_code" -ne 0 ]; then
    # FR-9 breadcrumb: name the script and its exit code, and point at the
    # idempotent re-run. fail() prints the [FAIL] prefix; we then exit
    # non-zero ourselves (rather than via abort()) so the breadcrumb is the
    # single failure line and the exit code is propagated.
    M3O_INSTALL_FAILED=1
    M3O_STEP_POST_INSTALL=failed
    fail "${script} exited ${exit_code}. Steps before it succeeded and are idempotent — re-run curl -sSL m3o.sh/install | sh once fixed."
    exit 1
  fi

  M3O_STEP_POST_INSTALL=done
  info "Post-install (${script}) completed (exit 0)."
}

# === Summary ===

# step_status <label> <outcome> — print one summary line, coloring the
# outcome (green done / yellow skipped / red failed / grey pending) when
# stdout is a TTY so the summary scans like a checklist. FR-10.
step_status() {
  local label="$1" status="$2" color
  case "$status" in
    done)    color=$'\033[1;32m' ;;  # bold green
    skipped) color=$'\033[1;33m' ;;  # bold yellow
    failed)  color="${M3O_FAIL_COLOR}" ;;  # bold red (reuses fail color)
    *)       color=$'\033[1;90m' ;;  # bold grey (pending / unknown)
  esac
  # Strip color when not a TTY so piped logs stay clean (mirrors info()/fail()).
  if [ ! -t 1 ]; then color=""; fi
  printf '  %-22s %s%s%s\n' "$label" "$color" "$status" "${M3O_RESET_COLOR}"
}

# print_summary — the final summary (FR-10). Lists every narrative step's
# outcome (done/skipped/failed), prints the FR-9 post-install breadcrumb
# (ran <script> (exit N)) and the US-8 next-step reminders (open 1Password
# GUI, enable SSH biometric CLI integration, restart the terminal if mise
# added new shims). If any step failed, prints the breadcrumb and exits
# non-zero; otherwise exits 0.
print_summary() {
  banner "Summary"

  step_status "Package manager"   "${M3O_STEP_PM}"
  step_status "1Password"         "${M3O_STEP_1PASSWORD}"
  step_status "1Password sign-in" "${M3O_STEP_OP_SIGNIN}"
  step_status "SSH key"          "${M3O_STEP_SSH_KEY}"
  step_status "GitHub SSH host"  "${M3O_STEP_GH_HOST}"
  step_status "GitHub host key"  "${M3O_STEP_GH_HOSTKEY}"
  step_status "Git config"       "${M3O_STEP_GIT}"
  step_status "Dotfiles"         "${M3O_STEP_DOTFILES}"
  step_status "Post-install"     "${M3O_STEP_POST_INSTALL}"

  # FR-9 breadcrumb — always present in the summary (pass or fail), naming
  # the post-install script and its exit code once run_post_install has run.
  if [ -n "${M3O_POST_INSTALL_SCRIPT}" ]; then
    info "ran ${M3O_POST_INSTALL_SCRIPT} (exit ${M3O_POST_INSTALL_EXIT})"
  fi

  # US-8 next-step reminders. 1Password GUI unlock is required before the CLI
  # can touch the SSH key item on a fresh login; biometric CLI integration is
  # the ergonomic unlock path for `op` afterwards; a terminal restart is the
  # usual fix-up so any shims added by mise/on tool-version changes are on PATH.
  info "Next steps:"
  printf '  - %s\n' "Open the 1Password GUI and unlock your account."
  printf '  - %s\n' "Enable SSH biometric CLI integration in 1Password (Developer settings → set up SSH agent + app integration)."
  printf '  - %s\n' "Restart your terminal so any new mise shims are on PATH."

  # Exit code: 0 only when every recorded step is done or skipped. Any
  # failure (run_post_install records failed and exits 1 itself, so on this
  # path failures come from steps the narrative never reached because an
  # earlier abort() halted — those stay \'pending\' and we still treat the run
  # as failed defensively) produces a non-zero exit. FR-10.
  if [ "${M3O_STEP_PM}" = "failed" ] || [ "${M3O_STEP_1PASSWORD}" = "failed" ] \
    || [ "${M3O_STEP_OP_SIGNIN}" = "failed" ] || [ "${M3O_STEP_SSH_KEY}" = "failed" ] \
    || [ "${M3O_STEP_GH_HOST}" = "failed" ] || [ "${M3O_STEP_GH_HOSTKEY}" = "failed" ] \
    || [ "${M3O_STEP_GIT}" = "failed" ] || [ "${M3O_STEP_DOTFILES}" = "failed" ] \
    || [ "${M3O_STEP_POST_INSTALL}" = "failed" ]; then
    fail "One or more steps failed — see the breadcrumb above and re-run curl -sSL m3o.sh/install | sh once fixed."
    exit 1
  fi

  info "m3o.sh install complete."
  exit 0
}

# === Main ===

# The narrative runs top-to-bottom from here. Each phase is its own section.
# Future phases append below: post-install, summary.

print_system_info
assert_supported_os
start_sudo_refresh
bootstrap_package_manager
bootstrap_1password
sign_in_1password
setup_ssh_key
configure_github_ssh_host
pin_github_host_key
configure_git
clone_dotfiles
run_post_install
print_summary