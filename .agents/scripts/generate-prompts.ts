#!/usr/bin/env bun

/**
 * Generate self-contained prompt files from tasks.json.
 *
 * Features:
 *   - Auto-validates tasks.json before generating
 *   - Includes PRD context when available
 *   - Includes dependency task descriptions
 *   - Topological order (dependencies first)
 *
 * Usage:
 *   bun generate-prompts.ts                     # uses tasks.json in cwd
 *   bun generate-prompts.ts /path/to/tasks.json # explicit path
 *   bun generate-prompts.ts --dry-run           # preview without writing
 *   bun generate-prompts.ts --no-validate       # skip validation
 *   bun generate-prompts.ts --prd docs/PRD.md   # explicit PRD path
 */

import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { $ } from "bun";
import { findTasksJson, loadTasks, topologicalSort } from "./lib/tasks-lib.ts";

// ── Validation ───────────────────────────────────────────────────────────

async function validateFirst(tasksPath: string) {
  const validator = join(import.meta.dir, "validate-dag.ts");
  if (!existsSync(validator)) {
    console.warn("WARNING: validate-dag.ts not found, skipping validation");
    return;
  }
  try {
    await $`bun ${validator} ${tasksPath} --quiet`;
    console.log("✓ tasks.json validated");
  } catch {
    console.error(
      "✗ tasks.json validation failed — fix errors before generating prompts",
    );
    // Re-run verbose to show errors
    try {
      await $`bun ${validator} ${tasksPath}`.quiet();
    } catch {
      // errors already printed
    }
    process.exit(1);
  }
}

// ── PRD Context ──────────────────────────────────────────────────────────

function loadPrdContext(prdPath: string): string | null {
  if (!existsSync(prdPath)) return null;
  const content = Bun.file(prdPath);
  return content
    .text()
    .then((text) => {
      const sections: string[] = [];
      let current: string | null = null;
      let lines: string[] = [];

      for (const line of text.split("\n")) {
        if (line.startsWith("## ")) {
          if (current && lines.length > 0 && isRelevantSection(current)) {
            sections.push(`## ${current}\n${lines.join("\n")}`);
          }
          current = line.slice(3).trim();
          lines = [];
        } else if (current) {
          lines.push(line);
        }
      }
      if (current && lines.length > 0 && isRelevantSection(current)) {
        sections.push(`## ${current}\n${lines.join("\n")}`);
      }
      return sections.length > 0 ? sections.join("\n\n") : null;
    })
    .catch(() => null);
}

function isRelevantSection(name: string): boolean {
  return name === "Executive Summary" || name.startsWith("Decisions");
}

// ── Prompt Generation ────────────────────────────────────────────────────

function generatePrompt(
  task: Awaited<ReturnType<typeof loadTasks>>["tasks"][number],
  allTasks: Awaited<ReturnType<typeof loadTasks>>["tasks"],
  prdContext: string | null,
  projectDir: string,
): string {
  const deps = task.dependencies;
  const experts = task.moeExperts;

  const depContext =
    deps.length > 0
      ? "\nDEPENDENCIES (completed before this task):\n" +
        deps
          .map((depId) => {
            const dep = allTasks.find((t) => t.id === depId);
            return dep
              ? `- ${depId}: ${dep.title} — ${dep.description.slice(0, 200)}`
              : `- ${depId}: (not found)`;
          })
          .join("\n")
      : "";

  const expertContext =
    experts.length > 0
      ? "\nEXPERT PERSPECTIVES TO CONSIDER:\n" +
        experts.map((e) => `- ${e}`).join("\n")
      : "";

  const acLines = task.acceptanceCriteria.map((ac) => `- ${ac}`).join("\n");

  const prdBlock = prdContext
    ? `\nPROJECT CONTEXT (from PRD):\n${prdContext}`
    : "";

  return `WORKDIR: ${projectDir}
TASK_ID: ${task.id}
TASK_TITLE: ${task.title}
AGENT: ${task.agent}
PHASE: ${task.phase}
PRIORITY: ${task.priority}
ESTIMATED: ${task.estimatedHours}h${depContext}
DESCRIPTION:
${task.description}

WHAT YOU MUST DO:
1. Discover relevant source files (use ls/find to locate, read to examine)
2. Implement the changes using edit/write/bash tools
3. Verify each acceptance criterion listed below
4. Do NOT modify files unrelated to this task
5. Do NOT skip acceptance criteria — verify each one

ACCEPTANCE CRITERIA:
${acLines}${expertContext}${prdBlock}

AFTER COMPLETION:
Write "${task.id}_DONE" to tasks/${task.id}.done
`;
}

// ── Main ─────────────────────────────────────────────────────────────────

const args = Bun.argv.slice(2);
const positional = args.filter((a) => !a.startsWith("--"));
const flags = new Set(args.filter((a) => a.startsWith("--")));

const tasksPath = positional[0]
  ? findTasksJson(positional[0])
  : findTasksJson();

if (!flags.has("--no-validate")) {
  await validateFirst(tasksPath);
}

const data = await loadTasks(tasksPath);
const { tasks, metadata } = data;
const projectDir = process.cwd();

// Auto-detect PRD
let prdContext: string | null = null;
const prdFlag = args.find((a) => a.startsWith("--prd="));
const prdPath = prdFlag ? prdFlag.split("=")[1] : null;

if (prdPath) {
  prdContext = await loadPrdContext(prdPath);
  if (prdContext) console.log(`✓ Loaded PRD context from ${prdPath}`);
} else {
  const prdName = (metadata as Record<string, unknown>).prd as
    | string
    | undefined;
  if (prdName) {
    for (const candidate of [
      join(process.cwd(), "docs", prdName),
      join(process.cwd(), prdName),
      join(tasksPath, "..", prdName),
    ]) {
      prdContext = await loadPrdContext(candidate);
      if (prdContext) {
        console.log(`✓ Loaded PRD context from ${candidate}`);
        break;
      }
    }
  }
}

// Topological order
const order = topologicalSort(tasks);
const taskMap = new Map(tasks.map((t) => [t.id, t]));
const ordered = order.map((id) => taskMap.get(id)!);

// Generate
const tasksDir = join(projectDir, "tasks");
if (!flags.has("--dry-run")) mkdirSync(tasksDir, { recursive: true });

let count = 0;
for (const task of ordered) {
  const prompt = generatePrompt(task, tasks, prdContext, projectDir);
  const promptPath = join(tasksDir, `${task.id}-prompt`);

  if (flags.has("--dry-run")) {
    console.log(`Would write: ${promptPath} (${prompt.length} bytes)`);
  } else {
    await Bun.write(promptPath, prompt);
    console.log(`  ✓ ${task.id}: ${task.title} (${prompt.length} bytes)`);
  }
  count++;
}

if (flags.has("--dry-run")) {
  console.log(`\nWould generate ${count} prompt files in ${tasksDir}/`);
} else {
  console.log(`\nGenerated ${count} prompt files in ${tasksDir}/`);
}
