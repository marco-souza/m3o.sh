#!/bin/bash
# Spawn tmux subagents for tasks.json, respecting the DAG.
#
# Usage:
#   bash spawn-wave.sh              # spawn next wave (auto-detects)
#   bash spawn-wave.sh --all        # spawn all remaining waves, waiting between
#   bash spawn-wave.sh T001 T003    # spawn specific tasks
#   bash spawn-wave.sh --dry-run    # show what would spawn
#
# Auto-generates prompts if missing, validates tasks.json, and skips
# already-completed tasks (.done markers).

set -e

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
SCRIPTS_DIR="$(dirname "$0")"
TASKS_DIR="$PROJECT_DIR/tasks"
TASKS_JSON="$PROJECT_DIR/tasks.json"
TMUX_SESSION_PREFIX="${TMUX_SESSION_PREFIX:-task}"

mkdir -p "$TASKS_DIR"

# ── Helpers ──────────────────────────────────────────────────────────────

done_count() { ls "$TASKS_DIR"/*.done 2>/dev/null | wc -l | tr -d ' '; }

is_done() { [ -f "$TASKS_DIR/${1}.done" ]; }

has_prompt() { [ -f "$TASKS_DIR/${1}-prompt" ]; }

# ── Dry-run mode ─────────────────────────────────────────────────────────

if [[ "$1" == "--dry-run" ]]; then
  echo "=== Dry Run: What would be spawned ==="
  if command -v bun &>/dev/null; then
    bun "$SCRIPTS_DIR/status-tasks.ts" --pending
  else
    echo "(install bun to see pending tasks)"
  fi
  exit 0
fi

# ─-- Auto-generate prompts if tasks/ is empty ────────────────────────────

prompt_count=$(ls "$TASKS_DIR"/*-prompt 2>/dev/null | wc -l | tr -d ' ')
task_count=$(python3 -c "import json; print(len(json.load(open('$TASKS_JSON'))['tasks']))" 2>/dev/null || echo "0")

if [ "$prompt_count" -eq 0 ] && [ "$task_count" -gt 0 ]; then
  echo "⚡ No prompt files found — generating from tasks.json..."
  if command -v bun &>/dev/null; then
    bun "$SCRIPTS_DIR/generate-prompts.ts"
  else
    echo "ERROR: bun not found. Run: bun generate-prompts.ts"
    exit 1
  fi
  echo ""
fi

# ── Specific tasks mode ──────────────────────────────────────────────────

if [ $# -gt 0 ] && [[ "$1" != "--"* ]]; then
  for tid in "$@"; do
    if is_done "$tid"; then
      echo "SKIP ${tid}: already done"
      continue
    fi

    PROMPT_FILE="$TASKS_DIR/${tid}-prompt"
    if [ ! -f "$PROMPT_FILE" ]; then
      echo "SKIP ${tid}: no prompt file at ${PROMPT_FILE}"
      continue
    fi

    # Generate runner script via Bun (base64-encode to avoid quoting issues)
    bun -e "
      import { readFileSync, writeFileSync, chmodSync } from 'node:fs';
      const tid = '$tid';
      const projectDir = '$PROJECT_DIR';
      const prompt = readFileSync('$PROMPT_FILE', 'utf8');
      const b64 = Buffer.from(prompt).toString('base64');
      const script = '/tmp/task-' + tid + '.sh';
      const content = '#!/bin/bash\ncd ' + projectDir + '\nPROMPT_B64=\"' + b64 + '\"\npi --thinking low -p \"\$(echo \"\$PROMPT_B64\" | base64 -d)\" 2>&1 | tee tasks/' + tid + '.out\necho \"' + tid + '_DONE\" > tasks/' + tid + '.done\n';
      writeFileSync(script, content);
      chmodSync(script, 0o755);
      console.log('Generated ' + script);
    "

    # Kill stale session
    tmux kill-session -t "${TMUX_SESSION_PREFIX}-${tid}" 2>/dev/null || true

    # Launch
    tmux new-session -d -s "${TMUX_SESSION_PREFIX}-${tid}" "bash /tmp/task-${tid}.sh"
    echo "SPAWN ${tid}"
  done
  echo "---"
  echo "Active: $(tmux ls 2>/dev/null | grep "${TMUX_SESSION_PREFIX}-" | wc -l | tr -d ' ') sessions"
  tmux ls 2>/dev/null | grep "${TMUX_SESSION_PREFIX}-" || echo "(none)"
  exit 0
fi

# ── Auto wave mode ───────────────────────────────────────────────────────

if [[ "$1" == "--all" ]]; then
  echo "🚀 Spawning all remaining waves..."
  echo ""

  # Get topological order from validate-dag
  if command -v bun &>/dev/null; then
    TOPO_ORDER=$(bun "$SCRIPTS_DIR/validate-dag.ts" "$TASKS_JSON" --topo 2>/dev/null | grep -E '^\s+[0-9]+\.' | awk '{print $2}')
    WAVES=$(bun "$SCRIPTS_DIR/validate-dag.ts" "$TASKS_JSON" --waves 2>/dev/null | grep -E '^\s+Wave' | sed 's/Wave [0-9]*: \[\(.*\)\].*/\1/' | tr ',' '\n' | tr -d ' ')
  else
    echo "ERROR: bun not found. Install bun for auto-wave support."
    exit 1
  fi

  if [ -z "$TOPO_ORDER" ]; then
    echo "ERROR: Could not resolve task order. Run: bun validate-dag.ts tasks.json --topo"
    exit 1
  fi

  # Process each wave
  wave_num=0
  current_wave=""
  while IFS= read -r tid; do
    # Check if this is a new wave (has no unmet deps)
    deps=$(python3 -c "
import json
data = json.load(open('$TASKS_JSON'))
task = next((t for t in data['tasks'] if t['id'] == '$tid'), None)
if task: print(' '.join(task['dependencies']))
" 2>/dev/null)

    unmet_deps=false
    for dep in $deps; do
      if ! is_done "$dep"; then
        unmet_deps=true
        break
      fi
    done

    if [ "$unmet_deps" = true ]; then
      # Finish current wave
      if [ -n "$current_wave" ]; then
        wave_num=$((wave_num + 1))
        echo "⏳ Waiting for Wave $wave_num: $current_wave"
        for wt in $current_wave; do
          while [ ! -f "$TASKS_DIR/${wt}.done" ]; do
            sleep 2
          done
          echo "  ✓ ${wt} complete"
          tmux kill-session -t "${TMUX_SESSION_PREFIX}-${wt}" 2>/dev/null || true
        done
        echo ""
        current_wave=""
      fi
      continue
    fi

    # Spawn task if not done and has prompt
    if ! is_done "$tid" && has_prompt "$tid"; then
      # Generate runner if needed
      if [ ! -f "/tmp/task-${tid}.sh" ]; then
        bun -e "
          import { readFileSync, writeFileSync, chmodSync } from 'node:fs';
          const tid = '$tid';
          const projectDir = '$PROJECT_DIR';
          const prompt = readFileSync('$TASKS_DIR/' + tid + '-prompt', 'utf8');
          const b64 = Buffer.from(prompt).toString('base64');
          const script = '/tmp/task-' + tid + '.sh';
          const content = '#!/bin/bash\ncd ' + projectDir + '\nPROMPT_B64=\"' + b64 + '\"\npi --thinking low -p \"\$(echo \"\$PROMPT_B64\" | base64 -d)\" 2>&1 | tee tasks/' + tid + '.out\necho \"' + tid + '_DONE\" > tasks/' + tid + '.done\n';
          writeFileSync(script, content);
          chmodSync(script, 0o755);
        " 2>/dev/null
      fi

      tmux kill-session -t "${TMUX_SESSION_PREFIX}-${tid}" 2>/dev/null || true
      tmux new-session -d -s "${TMUX_SESSION_PREFIX}-${tid}" "bash /tmp/task-${tid}.sh"
      echo "  → ${tid} spawned"
      current_wave="$current_wave $tid"
    fi
  done <<< "$TOPO_ORDER"

  # Wait for final wave
  if [ -n "$current_wave" ]; then
    wave_num=$((wave_num + 1))
    echo ""
    echo "⏳ Waiting for Wave $wave_num: $current_wave"
    for wt in $current_wave; do
      while [ ! -f "$TASKS_DIR/${wt}.done" ]; do sleep 2; done
      echo "  ✓ ${wt} complete"
      tmux kill-session -t "${TMUX_SESSION_PREFIX}-${wt}" 2>/dev/null || true
    done
  fi

  echo ""
  echo "🎉 All waves complete"
  echo "   Done: $(done_count)/$(echo "$TOPO_ORDER" | wc -w | tr -d ' ') tasks"
  exit 0
fi

# ── Default: spawn next available wave ───────────────────────────────────

echo "⚡ Spawning next ready wave..."

if command -v bun &>/dev/null; then
  READY_TASKS=$(bun "$SCRIPTS_DIR/status-tasks.ts" --pending 2>/dev/null | grep -E '^⏳' | awk '{print $2}')
else
  echo "ERROR: bun not found for auto-detection."
  exit 1
fi

if [ -z "$READY_TASKS" ]; then
  echo "No tasks ready to spawn (all done or blocked)"
  exit 0
fi

echo "Ready: $READY_TASKS"
echo ""

for tid in $READY_TASKS; do
  if ! has_prompt "$tid"; then
    echo "SKIP ${tid}: no prompt file"
    continue
  fi

  # Generate runner
  bun -e "
    import { readFileSync, writeFileSync, chmodSync } from 'node:fs';
    const tid = '$tid';
    const projectDir = '$PROJECT_DIR';
    const prompt = readFileSync('$TASKS_DIR/' + tid + '-prompt', 'utf8');
    const b64 = Buffer.from(prompt).toString('base64');
    const script = '/tmp/task-' + tid + '.sh';
    const content = '#!/bin/bash\ncd ' + projectDir + '\nPROMPT_B64=\"' + b64 + '\"\npi --thinking low -p \"\$(echo \"\$PROMPT_B64\" | base64 -d)\" 2>&1 | tee tasks/' + tid + '.out\necho \"' + tid + '_DONE\" > tasks/' + tid + '.done\n';
    writeFileSync(script, content);
    chmodSync(script, 0o755);
  " 2>/dev/null

  tmux kill-session -t "${TMUX_SESSION_PREFIX}-${tid}" 2>/dev/null || true
  tmux new-session -d -s "${TMUX_SESSION_PREFIX}-${tid}" "bash /tmp/task-${tid}.sh"
  echo "SPAWN ${tid}"
done

echo "---"
echo "Active: $(tmux ls 2>/dev/null | grep "${TMUX_SESSION_PREFIX}-" | wc -l | tr -d ' ') sessions"
tmux ls 2>/dev/null | grep "${TMUX_SESSION_PREFIX}-" || echo "(none)"
