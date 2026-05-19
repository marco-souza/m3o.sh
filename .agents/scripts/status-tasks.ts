#!/usr/bin/env bun
/**
 * Show task status from tasks.json and tasks/ directory.
 *
 * Usage:
 *   bun status-tasks.ts                     # full status table
 *   bun status-tasks.ts --compact           # one-line summary
 *   bun status-tasks.ts --pending           # only pending/blocked tasks
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  computeStats,
  computeWaves,
  findTasksJson,
  loadTasks,
  scanTaskStatus,
  topologicalSort,
} from "./lib/tasks-lib.ts";

const args = Bun.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const positional = args.filter((a) => !a.startsWith("--"));

const tasksPath = positional[0]
  ? findTasksJson(positional[0])
  : findTasksJson();
const data = await loadTasks(tasksPath);
const { tasks } = data;
const tasksDir = join(process.cwd(), "tasks");

const status = scanTaskStatus(
  tasks,
  existsSync(tasksDir) ? tasksDir : undefined,
);
const stats = computeStats(data);
const _order = topologicalSort(tasks);
const waves = computeWaves(tasks);

// ── Compact mode ─────────────────────────────────────────────────────────

if (flags.has("--compact")) {
  const counts = { done: 0, running: 0, pending: 0, blocked: 0 };
  for (const s of status.values()) counts[s as keyof typeof counts]++;
  const total = tasks.length;
  const pct = total > 0 ? Math.round((counts.done / total) * 100) : 0;
  console.log(
    `${counts.done}/${total} done (${pct}%) | running: ${counts.running} | pending: ${counts.pending} | blocked: ${counts.blocked}`,
  );
  process.exit(0);
}

// ── Filtered mode ────────────────────────────────────────────────────────

let filteredTasks = tasks;
if (flags.has("--pending")) {
  filteredTasks = tasks.filter((t) => {
    const s = status.get(t.id);
    return s === "pending" || s === "blocked";
  });
} else if (flags.has("--running")) {
  filteredTasks = tasks.filter((t) => status.get(t.id) === "running");
} else if (flags.has("--done")) {
  filteredTasks = tasks.filter((t) => status.get(t.id) === "done");
} else if (flags.has("--blocked")) {
  filteredTasks = tasks.filter((t) => status.get(t.id) === "blocked");
}

// ── Full status table ────────────────────────────────────────────────────

const icons: Record<string, string> = {
  done: "✅",
  running: "🔄",
  pending: "⏳",
  blocked: "🚫",
};

// Header
console.log(
  `\n${"ID".padEnd(5)} ${"Status".padEnd(9)} ${"Title".padEnd(45)} ${"Phase".padEnd(16)} ${"Agent".padEnd(18)} ${"Hrs"}`,
);
console.log("─".repeat(100));

for (const task of filteredTasks) {
  const s = status.get(task.id) ?? "pending";
  const icon = icons[s] ?? "❓";
  const title =
    task.title.length > 43 ? `${task.title.slice(0, 40)}...` : task.title;
  console.log(
    `${icon} ${task.id.padEnd(3)} ${s.padEnd(9)} ${title.padEnd(45)} ${task.phase.padEnd(16)} ${task.agent.padEnd(18)} ${task.estimatedHours}`,
  );
}

// Summary
console.log("─".repeat(100));
const counts = { done: 0, running: 0, pending: 0, blocked: 0 };
for (const s of status.values()) counts[s as keyof typeof counts]++;
const total = tasks.length;
const pct = total > 0 ? Math.round((counts.done / total) * 100) : 0;
console.log(
  `\nTotal: ${total} tasks | ✅ ${counts.done} | 🔄 ${counts.running} | ⏳ ${counts.pending} | 🚫 ${counts.blocked} (${pct}% complete)`,
);
console.log(
  `Estimated: ${stats.totalHours}h | Critical path: ${stats.criticalPath.hours}h (${stats.criticalPath.path.join(" → ")})`,
);

// Waves overview
console.log(`\nExecution waves: ${waves.length}`);
waves.forEach((wave, i) => {
  const waveStatus = wave.map((tid) => status.get(tid) ?? "pending");
  const doneCount = waveStatus.filter((s) => s === "done").length;
  console.log(
    `  Wave ${i + 1}: ${wave.join(", ")} (${doneCount}/${wave.length} done)`,
  );
});
