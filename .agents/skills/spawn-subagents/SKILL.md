---
name: spawn-subagents
description: >
  Spawn isolated pi subagents in background tmux sessions to parallelize work,
  isolate context, or run long-running tasks without blocking the main agent.
  Use when you need to delegate work to independent pi instances that operate
  autonomously. Do NOT use for simple one-off commands or when the task can be
  done synchronously without blocking.
---

# Spawn Pi Subagents

**You can spawn new pi instances as subagents.** This is the primary mechanism
for parallelizing work, isolating risky operations, and running long tasks
without blocking the main session.

Each subagent is an independent `pi` process running in a detached tmux session.
They share the same filesystem and tools as the main agent but have their own
context window — they don't see your conversation history.

## When to Use

- Run multiple investigations or analyses in parallel
- Isolate complex or risky operations (code generation, refactoring)
- Execute long-running tasks without blocking the main session
- Get a fresh context window for focused, specific tasks
- Delegate work when implementing tasks from `tasks.json`
- Run Mixture-of-Experts analyses with multiple specialized agents

## When NOT to Use

- Simple one-off commands (just run them directly)
- Tasks that require interactive user input (subagents are headless)
- When you need to share conversation context (subagents start fresh)
- When the user explicitly requests alternative tools (screen, nohup)

## Core Concept

```
Main Agent (you)
    │
    ├── spawns → Subagent A (tmux session: task-code-review)
    │               └── pi -p "Review auth module" → output file
    │
    ├── spawns → Subagent B (tmux session: task-refactor)
    │               └── pi -p "Refactor user service" → output file
    │
    └── spawns → Subagent C (tmux session: task-tests)
                    └── pi -p "Write tests for login" → output file
```

All three run simultaneously. You poll for completion and collect results.

## Quick Start

### Spawn a Single Subagent

```bash
# 1. Create a detached tmux session
tmux new-session -d -s subagent-scout -n worker

# 2. Send the pi command (runs autonomously)
tmux send-keys -t subagent-scout \
  'pi -p "Find all files that import the auth module and summarize their purpose" \
   > /tmp/scout.out 2>&1 && echo "___DONE___" >> /tmp/scout.out' C-m
```

### Wait for Completion

```bash
# Poll until the DONE marker appears
while ! grep -q "___DONE___" /tmp/scout.out 2>/dev/null; do
  sleep 2
done

# Read the results
cat /tmp/scout.out
```

### Clean Up

```bash
# Kill the session and remove temp files
tmux kill-session -t subagent-scout
rm /tmp/scout.out
```

## Complete Workflow

```bash
# === SPAWN ===
tmux new-session -d -s subagent-example
tmux send-keys -t subagent-example \
  'pi -p "Analyze the dependency graph in this project and identify circular deps" \
   > /tmp/example.out 2>&1 && echo "___DONE___" >> /tmp/example.out' C-m

# === WAIT ===
echo "Waiting for subagent..."
while ! grep -q "___DONE___" /tmp/example.out 2>/dev/null; do
  sleep 2
done

# === COLLECT ===
echo "=== Subagent Results ==="
grep -v "___DONE___" /tmp/example.out

# === CLEANUP ===
tmux kill-session -t subagent-example 2>/dev/null
rm /tmp/example.out
```

## Running Subagents with Prompt Files

For complex tasks with multi-line prompts, use a prompt file instead of inline text:

```bash
# Write the prompt to a file
cat > /tmp/prompt-task.txt << 'ENDOFPROMPT'
You are a code reviewer. Review the following files for security issues:

Files to review:
- src/auth/login.ts
- src/auth/middleware.ts
- src/auth/utils.ts

Focus on:
1. Authentication bypasses
2. Token handling vulnerabilities
3. Input validation gaps
4. Secrets management

For each finding, provide:
- File and line number
- Severity (CRITICAL/HIGH/MEDIUM/LOW)
- Description and fix recommendation
ENDOFPROMPT

# Spawn the subagent using the prompt file
tmux new-session -d -s subagent-review
tmux send-keys -t subagent-review \
  'cat /tmp/prompt-task.txt | pi --append-system-prompt -p "$(cat)" \
   > /tmp/review.out 2>&1 && echo "___DONE___" >> /tmp/review.out' C-m
```

## Parallel Subagents

Spawn multiple subagents simultaneously for parallel work:

```bash
# Define tasks
declare -A tasks=(
  ["architect"]="Review the project for architectural issues and design patterns"
  ["security"]="Audit the codebase for security vulnerabilities"
  ["performance"]="Identify performance bottlenecks and optimization opportunities"
  ["maintainer"]="Evaluate code quality, readability, and documentation"
)

# Spawn all in parallel
for expert in "${!tasks[@]}"; do
  session="subagent-${expert}"
  task="${tasks[$expert]}"
  tmux new-session -d -s "$session"
  tmux send-keys -t "$session" \
    "pi -p '$task' > /tmp/${session}.out 2>&1 && echo '___DONE___' >> /tmp/${session}.out" C-m
  echo "Spawned: $session"
done

# Wait for ALL to complete
echo "Waiting for all subagents..."
for expert in "${!tasks[@]}"; do
  session="subagent-${expert}"
  while ! grep -q "___DONE___" "/tmp/${session}.out" 2>/dev/null; do
    sleep 2
  done
  echo "✅ $session complete"
done

# Aggregate results
echo "=== Aggregated Results ==="
for expert in "${!tasks[@]}"; do
  session="subagent-${expert}"
  echo ""
  echo "--- $expert ---"
  grep -v "___DONE___" "/tmp/${session}.out"
done

# Cleanup
for expert in "${!tasks[@]}"; do
  tmux kill-session -t "subagent-${expert}" 2>/dev/null
  rm -f "/tmp/subagent-${expert}.out"
done
```

## Structured Output (JSON Mode)

For machine-parseable results, use pi's JSON mode:

```bash
tmux new-session -d -s subagent-json
tmux send-keys -t subagent-json \
  'pi --mode json -p "List all exported functions in src/ with their signatures" \
   > /tmp/json-task.jsonl 2>&1 && echo "___DONE___" >> /tmp/json-task.jsonl' C-m

# Wait and collect
while ! grep -q "___DONE___" /tmp/json-task.jsonl 2>/dev/null; do sleep 2; done
cat /tmp/json-task.jsonl | grep -v "___DONE___"
```

## Session Management

```bash
# List all subagent sessions
tmux ls | grep "subagent-"

# Check if a specific subagent is still running
tmux has-session -t subagent-scout 2>/dev/null && echo "Running" || echo "Finished"

# Peek at live output (last 20 lines)
tmux capture-pane -t subagent-scout -p | tail -20

# Kill a stuck subagent
tmux kill-session -t subagent-scout

# Kill all subagent sessions
tmux ls | grep "subagent-" | cut -d: -f1 | xargs -I {} tmux kill-session -t {}
```

## Subagent Patterns

### Pattern 1: Scout (Read-Only Exploration)

Subagent explores code and reports back. No file modifications.

```bash
tmux new-session -d -s scout-deps
tmux send-keys -t scout-deps \
  'pi -p "Map the full dependency graph of this project. List every module, what it imports, and who imports it." > /tmp/scout-deps.out 2>&1 && echo DONE >> /tmp/scout-deps.out' C-m
```

### Pattern 2: Worker (Read-Write Implementation)

Subagent implements code changes. **Always review changes after.**

```bash
tmux new-session -d -s worker-auth
tmux send-keys -t worker-auth \
  'pi -p "Implement JWT authentication middleware in src/auth/middleware.ts following the patterns in src/existing-middleware/. Include tests." > /tmp/worker-auth.out 2>&1 && echo DONE >> /tmp/worker-auth.out' C-m
```

### Pattern 3: Reviewer (Post-Implementation Review)

Subagent reviews completed work and provides feedback.

```bash
# After a worker completes, spawn a reviewer
tmux new-session -d -s reviewer-auth
tmux send-keys -t reviewer-auth \
  'pi -p "Review all changes in src/auth/ for correctness, security, and adherence to project patterns. Focus on the diff from main." > /tmp/reviewer-auth.out 2>&1 && echo DONE >> /tmp/reviewer-auth.out' C-m
```

### Pattern 4: Pipeline (Sequential Subagents)

Chain subagents where the output of one feeds the next:

```bash
# Step 1: Analyze
tmux new-session -d -s pipe-analyze
tmux send-keys -t pipe-analyze \
  'pi -p "Analyze src/ for all TODO comments and group by category" > /tmp/pipe-step1.out 2>&1 && echo DONE >> /tmp/pipe-step1.out' C-m

# Wait for step 1
while ! grep -q "DONE" /tmp/pipe-step1.out 2>/dev/null; do sleep 2; done

# Step 2: Prioritize (uses step 1's output)
TODO_LIST=$(grep -v "DONE" /tmp/pipe-step1.out)
tmux new-session -d -s pipe-prioritize
tmux send-keys -t pipe-prioritize \
  "echo '$TODO_LIST' | pi -p 'Prioritize these TODOs by impact and effort. Suggest the top 5 to tackle first.' > /tmp/pipe-step2.out 2>&1 && echo DONE >> /tmp/pipe-step2.out" C-m
```

## Timeouts and Safety

Always set timeouts for subagents to prevent runaway sessions:

```bash
# Wrapper function with timeout
spawn_with_timeout() {
  local session=$1
  local command=$2
  local timeout_sec=${3:-300}  # default 5 minutes

  tmux new-session -d -s "$session"
  tmux send-keys -t "$session" "$command" C-m

  # Background killer
  (
    sleep "$timeout_sec"
    if tmux has-session -t "$session" 2>/dev/null; then
      echo "⏰ Timeout: killing $session after ${timeout_sec}s" >> "/tmp/${session}.out"
      echo "___TIMEOUT___" >> "/tmp/${session}.out"
      tmux kill-session -t "$session"
    fi
  ) &
}

# Usage
spawn_with_timeout "subagent-risky" \
  'pi -p "Run a complex analysis that might be slow" > /tmp/subagent-risky.out 2>&1 && echo DONE >> /tmp/subagent-risky.out' \
  120  # 2 minute timeout
```

## Best Practices

- **Name sessions clearly**: `subagent-<purpose>-<timestamp>` or `task-<id>`
- **Always capture output to a file**: Tmux pane buffers are limited and volatile
- **Use DONE markers**: `___DONE___` or `DONE` makes polling reliable
- **Set timeouts**: Kill sessions that hang beyond a reasonable time
- **Clean up**: Always remove sessions and temp files when done
- **Check disk space**: Output files can grow large with verbose tasks
- **Review worker output**: Always inspect code changes made by worker subagents
- **Use prompt files for complex tasks**: Avoid quoting issues with inline prompts
- **Never spawn from within a subagent**: Subagents should not spawn their own subagents (infinite fanout risk)
- **Limit parallelism**: Don't spawn more than 5-8 subagents at once (system resource limits)

## Troubleshooting

### Subagent never finishes

```bash
# Check if it's still running
tmux has-session -t subagent-name && echo "Still running" || echo "Crashed"

# Check the last output
tmux capture-pane -t subagent-name -p | tail -30

# Kill and retry if stuck
tmux kill-session -t subagent-name
```

### Output file is empty

```bash
# Check if the command started correctly
tmux capture-pane -t subagent-name -p

# Verify pi is on PATH inside tmux
tmux send-keys -t subagent-name 'which pi' C-m
sleep 1
tmux capture-pane -t subagent-name -p
```

### "Command not found: pi"

The tmux session may not inherit your shell's PATH. Use the full path:

```bash
tmux send-keys -t subagent-name \
  '$(which pi) -p "task" > /tmp/output.out 2>&1 && echo DONE >> /tmp/output.out' C-m
```

### Quoting issues with complex prompts

Use a prompt file instead of inline text (see "Running Subagents with Prompt Files" above).

## Integration with Other Skills

This skill is a **foundational primitive** used by higher-level skills:

- **`mixture-of-experts`** — Spawns multiple expert subagents in parallel, aggregates results
- **`implement-tasks`** — Spawns worker subagents to independently implement tasks from `tasks.json`
- **`explore`** — Can spawn scout subagents for parallel codebase exploration
- **`pr-review`** — Can spawn reviewer subagents for automated PR analysis

When using `mixture-of-experts` or `implement-tasks`, follow their specific patterns
for spawning and aggregating. This skill provides the underlying tmux/pi mechanics.
