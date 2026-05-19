#!/usr/bin/env bun
/**
 * Validate tasks.json against the PRD-to-Tasks schema.
 *
 * Usage:
 *   bun validate-dag.ts                     # verbose
 *   bun validate-dag.ts --summary           # + breakdown & critical path
 *   bun validate-dag.ts --topo              # print topological order
 *   bun validate-dag.ts --waves             # print parallel execution waves
 *   bun validate-dag.ts --json              # machine-readable JSON output
 *   bun validate-dag.ts --quiet             # exit code only
 */

import {
  computeStats,
  computeWaves,
  criticalPath,
  detectCycles,
  loadTasks,
  type TasksData,
  topologicalSort,
  validateDependencies,
} from "./lib/tasks-lib.ts";

// ── Validators ────────────────────────────────────────────────────────────

function validateRequiredFields(tasks: TasksData["tasks"]): string[] {
  const required = [
    "id",
    "title",
    "description",
    "phase",
    "priority",
    "estimatedHours",
    "dependencies",
    "agent",
    "moeExperts",
    "acceptanceCriteria",
  ] as const;
  const errors: string[] = [];
  for (const t of tasks) {
    for (const field of required) {
      if (!(field in t))
        errors.push(`${t.id ?? "?"} missing required field: '${field}'`);
    }
  }
  return errors;
}

function validateUniqueIds(tasks: TasksData["tasks"]): string[] {
  const ids = tasks.map((t) => t.id);
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  const dupes = [...counts.entries()].filter(([, v]) => v > 1).map(([k]) => k);
  return dupes.length ? [`Duplicate task IDs: ${dupes.join(", ")}`] : [];
}

function validatePhases(
  tasks: TasksData["tasks"],
  phases: Record<string, { label: string }>,
): string[] {
  const phaseKeys = new Set(Object.keys(phases));
  return tasks
    .filter((t) => !phaseKeys.has(t.phase))
    .map((t) => `${t.id} references invalid phase: '${t.phase}'`);
}

function validatePhaseLists(
  tasks: TasksData["tasks"],
  phases: TasksData["phases"],
): string[] {
  const errors: string[] = [];
  for (const [key, phaseData] of Object.entries(phases)) {
    const listed = new Set(phaseData.tasks);
    const actual = new Set(
      tasks.filter((t) => t.phase === key).map((t) => t.id),
    );
    const onlyListed = [...listed].filter((x) => !actual.has(x));
    const onlyActual = [...actual].filter((x) => !listed.has(x));
    if (onlyListed.length || onlyActual.length) {
      const parts: string[] = [];
      if (onlyListed.length)
        parts.push(`listed but not assigned: ${onlyListed.join(", ")}`);
      if (onlyActual.length)
        parts.push(`assigned but not listed: ${onlyActual.join(", ")}`);
      errors.push(`Phase '${key}' mismatch — ${parts.join("; ")}`);
    }
  }
  return errors;
}

function validateAgents(
  tasks: TasksData["tasks"],
  agents: TasksData["agents"],
): string[] {
  const errors: string[] = [];
  const allAgentTasks = new Set<string>();
  for (const [name, agentData] of Object.entries(agents)) {
    for (const tid of agentData.tasks) {
      allAgentTasks.add(tid);
      const task = tasks.find((t) => t.id === tid);
      if (!task)
        errors.push(`Agent '${name}' references non-existent task: '${tid}'`);
      else if (task.agent !== name)
        errors.push(
          `Task '${tid}' has agent='${task.agent}' but listed under '${name}'`,
        );
    }
  }
  const taskIds = new Set(tasks.map((t) => t.id));
  const missing = [...taskIds].filter((id) => !allAgentTasks.has(id));
  if (missing.length)
    errors.push(`Tasks not assigned to any agent: ${missing.join(", ")}`);
  return errors;
}

function validatePriorities(tasks: TasksData["tasks"]): string[] {
  const valid = new Set(["critical", "high", "medium", "low"]);
  return tasks
    .filter((t) => !valid.has(t.priority))
    .map((t) => `${t.id} has invalid priority: '${t.priority}'`);
}

function validateMetadata(
  tasks: TasksData["tasks"],
  meta: Record<string, unknown>,
): string[] {
  const errors: string[] = [];
  const declared = meta.totalTasks as number | undefined;
  if (declared !== tasks.length)
    errors.push(
      `metadata.totalTasks (${declared}) != actual tasks (${tasks.length})`,
    );
  const declaredHours = meta.totalEstimatedHours as number | undefined;
  const actualHours = tasks.reduce((sum, t) => sum + t.estimatedHours, 0);
  if (
    declaredHours === undefined ||
    Math.abs(declaredHours - actualHours) > 0.01
  )
    errors.push(
      `metadata.totalEstimatedHours (${declaredHours}) != actual (${actualHours})`,
    );
  return errors;
}

// ── Output helpers ───────────────────────────────────────────────────────

function printSummary(data: TasksData) {
  const { tasks, phases, agents } = data;
  console.log("\n=== Phase Breakdown ===");
  for (const [key, p] of Object.entries(phases)) {
    const pt = tasks.filter((t) => t.phase === key);
    const h = pt.reduce((s, t) => s + t.estimatedHours, 0);
    console.log(`  ${p.label}: ${pt.length} tasks, ${h}h`);
  }
  console.log("\n=== Agent Breakdown ===");
  for (const [name, _a] of Object.entries(agents)) {
    const at = tasks.filter((t) => t.agent === name);
    const h = at.reduce((s, t) => s + t.estimatedHours, 0);
    console.log(`  ${name}: ${at.length} tasks, ${h}h`);
  }
  const [hours, path] = criticalPath(tasks);
  console.log(`\n=== Critical Path (${hours}h) ===`);
  console.log(`  ${path.join(" → ")}`);
}

function printTopo(tasks: TasksData["tasks"]) {
  const order = topologicalSort(tasks);
  console.log("\n=== Topological Execution Order ===");
  order.forEach((tid, i) => {
    const t = tasks.find((x) => x.id === tid)!;
    const deps = t.dependencies.length ? t.dependencies.join(", ") : "—";
    console.log(
      `  ${(i + 1).toString().padStart(2)}. ${tid} (${t.estimatedHours}h)  deps: ${deps}`,
    );
  });
}

function printWaves(tasks: TasksData["tasks"]) {
  const waves = computeWaves(tasks);
  console.log("\n=== Parallel Execution Waves ===");
  waves.forEach((wave, i) => {
    const hours = wave.reduce(
      (s, tid) => s + tasks.find((t) => t.id === tid)?.estimatedHours,
      0,
    );
    console.log(
      `  Wave ${i + 1}: [${wave.join(", ")}]  (${wave.length} tasks, max ${hours}h)`,
    );
  });
}

function printJson(data: TasksData) {
  const order = topologicalSort(data.tasks);
  const waves = computeWaves(data.tasks);
  const [hours, path] = criticalPath(data.tasks);
  const stats = computeStats(data);
  console.log(
    JSON.stringify(
      {
        valid: true,
        stats,
        topological_order: order,
        waves,
        critical_path: { hours, path },
      },
      null,
      2,
    ),
  );
}

// ── Main ─────────────────────────────────────────────────────────────────

const args = Bun.argv.slice(2);
const positional = args.filter((a) => !a.startsWith("--"));
const path = positional[0];
const flags = new Set(
  args.filter((a) => a.startsWith("--")).map((a) => a.replace(/^--/, "")),
);

const quiet = flags.has("quiet");
const data = await loadTasks(path);
const { tasks, phases, agents, metadata } = data;

const checks: [string, string[]][] = [
  ["Valid JSON", []],
  [
    `All ${tasks.length} tasks have required fields`,
    validateRequiredFields(tasks),
  ],
  ["All task IDs are unique", validateUniqueIds(tasks)],
  ["All tasks reference valid phases", validatePhases(tasks, phases)],
  ["All dependencies reference valid task IDs", validateDependencies(tasks)],
  [
    "No circular dependencies (DAG is valid)",
    detectCycles(tasks).map((c) => `Circular dependency: ${c}`),
  ],
  [
    "Phase task lists match actual assignments",
    validatePhaseLists(tasks, phases),
  ],
  [
    "All agent assignments are consistent and complete",
    validateAgents(tasks, agents),
  ],
  ["All priorities are valid", validatePriorities(tasks)],
  [
    `Metadata consistent (${metadata.totalTasks} tasks, ${metadata.totalEstimatedHours}h)`,
    validateMetadata(tasks, metadata),
  ],
];

for (const [label, errs] of checks) {
  if (errs.length) {
    for (const e of errs) console.error(`✗ ${e}`);
    process.exit(1);
  }
  if (!quiet) console.log(`✓ ${label}`);
}

if (flags.has("json")) printJson(data);
else {
  if (flags.has("summary")) printSummary(data);
  if (flags.has("topo")) printTopo(tasks);
  if (flags.has("waves")) printWaves(tasks);
}

console.log();
if (!quiet) console.log("✓ ALL VALIDATIONS PASSED");
