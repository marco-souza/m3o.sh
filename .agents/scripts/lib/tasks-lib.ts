/**
 * Shared library for tasks.json operations.
 *
 * All scripts in .agents/scripts/ import from this module instead of
 * duplicating JSON loading, dependency resolution, and topological sorting.
 *
 * Usage:
 *   import { loadTasks, topologicalSort, computeWaves } from "./lib/tasks-lib.ts";
 */

import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

// ── Types ──────────────────────────────────────────────────────────────

export interface Task {
  id: string;
  title: string;
  description: string;
  phase: string;
  priority: "critical" | "high" | "medium" | "low";
  estimatedHours: number;
  dependencies: string[];
  agent: string;
  moeExperts: string[];
  acceptanceCriteria: string[];
  userStory?: string | null;
  functionalReq?: string | null;
  tags?: string[];
}

export interface Phase {
  label: string;
  description: string;
  tasks: string[];
}

export interface AgentInfo {
  role: string;
  tasks: string[];
}

export interface TasksData {
  $schema: string;
  metadata: Record<string, unknown>;
  phases: Record<string, Phase>;
  tasks: Task[];
  agents: Record<string, AgentInfo>;
}

// ── Path Resolution ────────────────────────────────────────────────────

export const SCRIPTS_DIR = dirname(import.meta.path ?? __filename);
export const AGENTS_DIR = dirname(SCRIPTS_DIR);

/** Resolve a script path relative to .agents/scripts/. */
export function resolveScriptPath(name: string): string {
  if (name.startsWith("/")) return name;
  if (name.startsWith("../")) return resolve(process.cwd(), name);
  return resolve(SCRIPTS_DIR, name);
}

/** Walk up from startDir to find tasks.json. */
export function findTasksJson(startDir?: string): string {
  let here = resolve(startDir ?? process.cwd());
  for (let i = 0; i < 10; i++) {
    const candidate = join(here, "tasks.json");
    if (existsSync(candidate)) return candidate;
    const tasksDir = join(here, "tasks", "tasks.json");
    if (existsSync(tasksDir)) return tasksDir;
    const parent = dirname(here);
    if (parent === here) break;
    here = parent;
  }
  console.error(
    `ERROR: tasks.json not found (searched from ${startDir ?? process.cwd()})`,
  );
  process.exit(1);
}

// ── Data Loading ───────────────────────────────────────────────────────

export async function loadTasks(path?: string): Promise<TasksData> {
  const filePath = path ? resolve(path) : findTasksJson();
  try {
    const raw = Bun.file(filePath);
    return JSON.parse(await raw.text());
  } catch (e) {
    if (e instanceof SyntaxError) {
      console.error(`ERROR: Invalid JSON in ${filePath}: ${e.message}`);
    } else {
      console.error(`ERROR: ${e}`);
    }
    process.exit(1);
  }
}

// ── Dependency Graph ───────────────────────────────────────────────────

export function buildAdjacency(tasks: Task[]): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const t of tasks) adj.set(t.id, [...t.dependencies]);
  return adj;
}

export function buildReverseAdjacency(tasks: Task[]): Map<string, string[]> {
  const reverse = new Map<string, string[]>();
  for (const t of tasks) reverse.set(t.id, []);
  for (const t of tasks) {
    for (const dep of t.dependencies) {
      if (reverse.has(dep)) reverse.get(dep)?.push(t.id);
    }
  }
  return reverse;
}

export function validateDependencies(tasks: Task[]): string[] {
  const ids = new Set(tasks.map((t) => t.id));
  const errors: string[] = [];
  for (const t of tasks) {
    for (const dep of t.dependencies) {
      if (!ids.has(dep))
        errors.push(`${t.id} depends on non-existent task: '${dep}'`);
    }
  }
  return errors;
}

export function detectCycles(tasks: Task[]): string[] {
  const adj = buildAdjacency(tasks);
  const visited = new Set<string>();
  const stack = new Set<string>();
  const cycles: string[] = [];

  function dfs(n: string, path: string[]) {
    if (stack.has(n)) {
      const cycleStart = path.indexOf(n);
      const cycle = [...path.slice(cycleStart), n];
      cycles.push(cycle.join(" → "));
      return;
    }
    if (visited.has(n)) return;
    stack.add(n);
    for (const dep of adj.get(n) ?? []) dfs(dep, [...path, n]);
    stack.delete(n);
    visited.add(n);
  }

  for (const t of tasks) {
    if (!visited.has(t.id)) dfs(t.id, []);
  }
  return cycles;
}

// ── Topological Sort (Kahn's algorithm) ────────────────────────────────

export function topologicalSort(tasks: Task[]): string[] {
  const ids = new Set(tasks.map((t) => t.id));
  const inDegree = new Map<string, number>();
  for (const t of tasks) inDegree.set(t.id, 0);

  for (const t of tasks) {
    for (const dep of t.dependencies) {
      if (ids.has(dep)) inDegree.set(t.id, (inDegree.get(t.id) ?? 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const [tid, deg] of inDegree) {
    if (deg === 0) queue.push(tid);
  }

  const result: string[] = [];
  while (queue.length > 0) {
    const tid = queue.shift()!;
    result.push(tid);
    for (const t of tasks) {
      if (t.dependencies.includes(tid)) {
        const newDeg = (inDegree.get(t.id) ?? 1) - 1;
        inDegree.set(t.id, newDeg);
        if (newDeg === 0) queue.push(t.id);
      }
    }
  }

  if (result.length !== ids.size) {
    const remaining = [...ids].filter((id) => !result.includes(id));
    console.error(
      `ERROR: Circular dependency detected. Cannot order: ${remaining.join(", ")}`,
    );
    process.exit(1);
  }

  return result;
}

// ── Wave Computation ───────────────────────────────────────────────────

export function computeWaves(tasks: Task[]): string[][] {
  const ids = new Set(tasks.map((t) => t.id));
  const depsMap = new Map<string, Set<string>>();
  for (const t of tasks) {
    depsMap.set(t.id, new Set(t.dependencies.filter((d) => ids.has(d))));
  }

  const done = new Set<string>();
  const waves: string[][] = [];

  while (done.size < ids.size) {
    const ready = tasks
      .filter(
        (t) =>
          !done.has(t.id) &&
          [...(depsMap.get(t.id) ?? [])].every((d) => done.has(d)),
      )
      .map((t) => t.id)
      .sort();

    if (ready.length === 0) {
      const remaining = [...ids].filter((id) => !done.has(id));
      console.error(
        `ERROR: Cannot resolve wave. Remaining: ${remaining.join(", ")}`,
      );
      process.exit(1);
    }

    waves.push(ready);
    for (const id of ready) done.add(id);
  }

  return waves;
}

// ── Critical Path ──────────────────────────────────────────────────────

export function criticalPath(tasks: Task[]): [number, string[]] {
  const taskMap = new Map<string, Task>();
  for (const t of tasks) taskMap.set(t.id, t);

  const memo = new Map<string, [number, string[]]>();

  function longest(tid: string): [number, string[]] {
    if (memo.has(tid)) return memo.get(tid)!;
    const task = taskMap.get(tid)!;
    if (!task.dependencies || task.dependencies.length === 0) {
      const result: [number, string[]] = [task.estimatedHours, [tid]];
      memo.set(tid, result);
      return result;
    }

    let bestH = 0;
    let bestP: string[] = [];
    for (const dep of task.dependencies) {
      if (taskMap.has(dep)) {
        const [h, p] = longest(dep);
        if (h > bestH) {
          bestH = h;
          bestP = p;
        }
      }
    }

    const result: [number, string[]] = [
      bestH + task.estimatedHours,
      [...bestP, tid],
    ];
    memo.set(tid, result);
    return result;
  }

  let maxH = 0;
  let maxP: string[] = [];
  for (const t of tasks) {
    const [h, p] = longest(t.id);
    if (h > maxH) {
      maxH = h;
      maxP = p;
    }
  }

  return [maxH, maxP];
}

// ── Task Lookup ────────────────────────────────────────────────────────

export function getTaskById(tasks: Task[], tid: string): Task | undefined {
  return tasks.find((t) => t.id === tid);
}

export function getTasksByPhase(tasks: Task[], phase: string): Task[] {
  return tasks.filter((t) => t.phase === phase);
}

export function getReadyTasks(tasks: Task[], doneIds: Set<string>): string[] {
  const ids = new Set(tasks.map((t) => t.id));
  return tasks
    .filter((t) => !doneIds.has(t.id))
    .filter((t) =>
      t.dependencies.filter((d) => ids.has(d)).every((d) => doneIds.has(d)),
    )
    .map((t) => t.id);
}

export function getBlockedTasks(
  tasks: Task[],
  doneIds: Set<string>,
): [string, string[]][] {
  const ids = new Set(tasks.map((t) => t.id));
  return tasks
    .filter((t) => !doneIds.has(t.id))
    .map((t) => [
      t.id,
      t.dependencies.filter((d) => ids.has(d) && !doneIds.has(d)),
    ])
    .filter(([_id, unmet]) => (unmet?.length ?? 0) > 0) as [string, string[]][];
}

// ── Status Tracking ────────────────────────────────────────────────────

export function scanTaskStatus(
  tasks: Task[],
  tasksDir?: string,
): Map<string, string> {
  const dir = tasksDir ?? join(process.cwd(), "tasks");
  const ids = new Set(tasks.map((t) => t.id));
  const doneIds = new Set<string>();
  const runningIds = new Set<string>();

  for (const t of tasks) {
    if (existsSync(join(dir, `${t.id}.done`))) doneIds.add(t.id);
    else if (existsSync(join(dir, `${t.id}.out`))) runningIds.add(t.id);
  }

  const status = new Map<string, string>();
  for (const t of tasks) {
    if (doneIds.has(t.id)) status.set(t.id, "done");
    else if (runningIds.has(t.id)) status.set(t.id, "running");
    else {
      const deps = t.dependencies.filter((d) => ids.has(d));
      if (deps.length > 0 && !deps.every((d) => doneIds.has(d)))
        status.set(t.id, "blocked");
      else status.set(t.id, "pending");
    }
  }

  return status;
}

// ── Stats ──────────────────────────────────────────────────────────────

export interface PhaseStats {
  label: string;
  count: number;
  hours: number;
}

export interface AgentStats {
  role: string;
  count: number;
  hours: number;
}

export interface TaskStats {
  totalTasks: number;
  totalHours: number;
  phases: Record<string, PhaseStats>;
  agents: Record<string, AgentStats>;
  criticalPath: { hours: number; path: string[] };
}

export function computeStats(data: TasksData): TaskStats {
  const { tasks, phases, agents } = data;
  const totalHours = tasks.reduce((sum, t) => sum + t.estimatedHours, 0);

  const phaseStats: Record<string, PhaseStats> = {};
  for (const [key, p] of Object.entries(phases)) {
    const pt = tasks.filter((t) => t.phase === key);
    phaseStats[key] = {
      label: p.label,
      count: pt.length,
      hours: pt.reduce((sum, t) => sum + t.estimatedHours, 0),
    };
  }

  const agentStats: Record<string, AgentStats> = {};
  for (const [name, a] of Object.entries(agents)) {
    const at = tasks.filter((t) => t.agent === name);
    agentStats[name] = {
      role: a.role,
      count: at.length,
      hours: at.reduce((sum, t) => sum + t.estimatedHours, 0),
    };
  }

  const [critHours, critPath] = criticalPath(tasks);

  return {
    totalTasks: tasks.length,
    totalHours,
    phases: phaseStats,
    agents: agentStats,
    criticalPath: { hours: critHours, path: critPath },
  };
}
