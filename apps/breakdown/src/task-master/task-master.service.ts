import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import type { SuggestedTask, TaskMasterTasksFile, TaskMasterTask } from "./task-master.types";
import { TaskMasterStorageService } from "./task-master-storage.service";

const TASK_MASTER_SCRIPT = (() => {
  try {
    const p = path.join(path.dirname(require.resolve("task-master-ai/package.json")), "dist", "task-master.js");
    if (fs.existsSync(p)) return p;
  } catch {
    // fallback
  }
  return path.join(process.cwd(), "node_modules", "task-master-ai", "dist", "task-master.js");
})();

function toPlanePriority(p?: string): "urgent" | "high" | "medium" | "low" | "none" {
  const v = (p || "medium").toLowerCase();
  if (v === "urgent" || v === "critical") return "urgent";
  if (v === "high") return "high";
  if (v === "low") return "low";
  if (v === "none") return "none";
  return "medium";
}

function mapTaskToSuggested(t: TaskMasterTask, index: number, idToTemp: Map<number | string, string>): SuggestedTask {
  const tempId = `temp-${index + 1}`;
  const deps = (t.dependencies ?? []).map((d) => idToTemp.get(d) ?? `temp-${d}`);
  return {
    temp_id: tempId,
    title: t.title || "Untitled",
    description: t.description || t.title,
    details: t.details,
    test_strategy: (t as TaskMasterTask & { testStrategy?: string }).testStrategy ?? t.test_strategy,
    priority: toPlanePriority(t.priority),
    estimated_hours: (() => {
      const h = (t as TaskMasterTask & { estimatedHours?: number }).estimatedHours ?? t.estimated_hours;
      return typeof h === "number" ? h : undefined;
    })(),
    dependencies: deps.filter(Boolean),
    tags: t.category ? [t.category] : [],
  };
}

/**
 * Recursively finds a task by ID in tasks and their subtasks.
 */
function findTaskById(tasks: TaskMasterTask[], taskId: number | string): TaskMasterTask | null {
  for (const task of tasks) {
    if (task.id === taskId) {
      return task;
    }
    if (task.subtasks) {
      const found = findTaskById(task.subtasks, taskId);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Recursively collects all task IDs from tasks and subtasks.
 */
function collectTaskIds(tasks: TaskMasterTask[], ids: (number | string)[]): void {
  for (const task of tasks) {
    ids.push(task.id);
    if (task.subtasks) {
      collectTaskIds(task.subtasks, ids);
    }
  }
}

/**
 * Flattens tasks for CLI compatibility (CLI can't find nested tasks).
 */
function flattenTasksForCli(tasks: TaskMasterTask[]): TaskMasterTask[] {
  const flattened: TaskMasterTask[] = [];

  for (const task of tasks) {
    // Create a copy without subtasks for the top level
    const { subtasks, ...taskWithoutSubtasks } = task;
    flattened.push(taskWithoutSubtasks);

    // Recursively flatten subtasks and add them to the top level
    if (subtasks && subtasks.length > 0) {
      const flattenedSubtasks = flattenTasksForCli(subtasks);
      flattened.push(...flattenedSubtasks);
    }
  }

  return flattened;
}

function parseTasksFile(p: string, tag?: string): TaskMasterTask[] {
  const raw = JSON.parse(fs.readFileSync(p, "utf-8")) as
    | TaskMasterTasksFile
    | Record<string, { tasks: TaskMasterTask[] }>;

  // Tagged format: { "prd-TEST-1": { tasks: [...] }, "prd-TEST-2": { tasks: [...] } }
  if (tag && typeof raw === "object" && !Array.isArray(raw)) {
    const tagged = raw as Record<string, { tasks: TaskMasterTask[] }>;
    if (tagged[tag]?.tasks) return tagged[tag].tasks;
  }

  // Legacy format: { master: { tasks: [...] } } or { tasks: [...] }
  if (typeof raw === "object" && "master" in raw) {
    const file = raw as TaskMasterTasksFile;
    if (file.master?.tasks) return file.master.tasks;
  }

  const file = raw as TaskMasterTasksFile;
  if (Array.isArray(file.tasks)) {
    return file.tasks;
  }

  return [];
}

const OPENAI_MODEL = {
  provider: "openai",
  modelId: "gpt-4o",
  maxTokens: 8192,
  temperature: 0.2,
};

const GEMINI_MODEL = {
  provider: "google",
  modelId: "gemini-3-flash-preview",
  maxTokens: 8192,
  temperature: 0.2,
};

/**
 * Adjusts .taskmaster/config.json to automatically select the best available AI provider.
 * Priority: Anthropic > Gemini > OpenAI
 * Reduces failures due to: Anthropic without credits, missing PERPLEXITY_API_KEY.
 */
function ensureTaskMasterConfig(cwd: string): void {
  const taskmasterDir = path.join(cwd, ".taskmaster");
  const p = path.join(taskmasterDir, "config.json");

  // If config doesn't exist, create it
  if (!fs.existsSync(p)) {
    if (!fs.existsSync(taskmasterDir)) {
      fs.mkdirSync(taskmasterDir, { recursive: true });
    }
    // Create empty config structure
    fs.writeFileSync(p, JSON.stringify({ models: {}, global: {} }, null, 2), "utf-8");
  }

  // Need at least one API key to configure
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasGemini = !!process.env.GOOGLE_API_KEY;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;

  if (!hasAnthropic && !hasGemini && !hasOpenAI) return;

  const config = JSON.parse(fs.readFileSync(p, "utf-8")) as Record<string, unknown>;
  if (!config.models || typeof config.models !== "object") config.models = {};

  const models = config.models as Record<string, unknown>;

  // Helper to check if a model config uses Perplexity without API key
  const needsPerplexityFix = (model: unknown): boolean => {
    if (!model || typeof model !== "object") return false;
    const m = model as Record<string, unknown>;
    return m.provider === "perplexity" && !process.env.PERPLEXITY_API_KEY;
  };

  // Determine main model based on priority: Anthropic > Gemini > OpenAI
  // Also fix if Perplexity is configured but API key is missing
  const currentMain = models.main as Record<string, unknown> | undefined;
  if (!models.main || needsPerplexityFix(currentMain)) {
    if (hasAnthropic) {
      // Keep Anthropic if already configured, or use default
      // Don't override if user has custom config (unless it's Perplexity without key)
      if (needsPerplexityFix(currentMain)) {
        // Fix: replace Perplexity with Anthropic
      }
    } else if (hasGemini) {
      models.main = { ...GEMINI_MODEL };
    } else if (hasOpenAI) {
      models.main = { ...OPENAI_MODEL };
    }
  }

  // Set fallback: prefer OpenAI if available, otherwise use main provider
  // Also fix if Perplexity is configured but API key is missing
  const currentFallback = models.fallback as Record<string, unknown> | undefined;
  if (!models.fallback || needsPerplexityFix(currentFallback)) {
    if (hasOpenAI) {
      models.fallback = { ...OPENAI_MODEL };
    } else if (hasGemini && !hasAnthropic) {
      models.fallback = { ...GEMINI_MODEL };
    }
  }

  // Set research model: prefer Perplexity, fallback to Gemini or OpenAI
  // Also fix if Perplexity is configured but API key is missing
  const currentResearch = models.research as Record<string, unknown> | undefined;
  const isPerplexityWithoutKey =
    currentResearch && currentResearch.provider === "perplexity" && !process.env.PERPLEXITY_API_KEY;

  if (!models.research || isPerplexityWithoutKey) {
    if (!process.env.PERPLEXITY_API_KEY) {
      // Prefer Gemini if available (better for research tasks)
      if (hasGemini) {
        models.research = { ...GEMINI_MODEL, temperature: 0.1 };
      } else if (hasOpenAI) {
        models.research = { ...OPENAI_MODEL, temperature: 0.1 };
      }
    }
  }

  fs.writeFileSync(p, JSON.stringify(config, null, 2), "utf-8");
}

@Injectable()
export class TaskMasterService {
  constructor(
    private readonly config: ConfigService,
    private readonly storage: TaskMasterStorageService
  ) {}

  /**
   * Flattens tasks for CLI compatibility.
   */
  private flattenTasksForCli(tasks: TaskMasterTask[]): TaskMasterTask[] {
    return flattenTasksForCli(tasks);
  }

  private get timeoutMs(): number {
    return this.config.get<number>("TASK_MASTER_TIMEOUT_MS") ?? 120_000;
  }

  private runCli(args: string[], cwd: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = this.timeoutMs;
      const proc = spawn(process.execPath, [TASK_MASTER_SCRIPT, ...args], {
        cwd,
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      proc.stdout?.on("data", (d: Buffer | string) => {
        stdout += d.toString();
      });
      proc.stderr?.on("data", (d: Buffer | string) => {
        stderr += d.toString();
      });
      proc.on("error", reject);
      const t = setTimeout(() => {
        proc.kill("SIGKILL");
        reject(new Error(`Task Master CLI timed out after ${timeout}ms`));
      }, timeout);
      proc.on("close", (code: number | null) => {
        clearTimeout(t);
        if (code === 0) resolve();
        else {
          const tail = (s: string, n: number) => (s.length <= n ? s : s.slice(-n));
          const msg = [
            `Task Master exit ${code}`,
            stderr && `stderr: ${tail(stderr, 600)}`,
            stdout && `stdout: ${tail(stdout, 600)}`,
          ]
            .filter(Boolean)
            .join(" | ");
          reject(new Error(msg));
        }
      });
    });
  }

  async parsePrdFromContent(
    prdContent: string,
    workspaceSlug: string,
    projectId: string,
    workItemId: string,
    options: { maxTasks?: number; research?: boolean; prompt?: string } = {}
  ): Promise<SuggestedTask[]> {
    const max = options.maxTasks ?? this.config.get<number>("MAX_TASKS_DEFAULT") ?? 10;

    // Use persistent project directory
    const projectDir = this.storage.ensureProjectDir(workspaceSlug, projectId);
    await this.storage.initTaskMaster(projectDir);
    ensureTaskMasterConfig(projectDir);

    const tag = this.storage.getTagName(workItemId);
    const prdPath = path.join(projectDir, "PRD.md");

    // If a prompt is provided, incorporate it into the PRD content
    // parse-prd doesn't accept --prompt option, so we incorporate it into the PRD
    // Format it as part of the PRD requirements to ensure the AI processes it
    let finalPrdContent = prdContent;
    if (options.prompt) {
      // Incorporate instructions as part of the PRD structure
      // This ensures task-master processes them as requirements
      finalPrdContent = `${prdContent}

---

## Task Generation Requirements

**CRITICAL INSTRUCTIONS FOR TASK GENERATION**: When breaking down this PRD into tasks, you MUST follow these requirements:

${options.prompt}

**MANDATORY**: Each generated task MUST include ALL relevant PRD specifications (colors, dimensions, APIs, business rules, validation rules, etc.) directly in the task's description and details fields. Tasks must be self-contained and detailed enough for implementation without consulting the PRD.`;
    }

    fs.writeFileSync(prdPath, finalPrdContent, "utf-8");

    // Use relative path to projectDir for task-master
    const prdRelative = "PRD.md";
    const args = ["parse-prd", prdRelative, "-n", String(max), "--force", "--tag", tag];
    if (options.research) args.push("--research");
    await this.runCli(args, projectDir);

    const outPath = path.join(projectDir, ".taskmaster", "tasks", "tasks.json");
    const tasks = parseTasksFile(outPath, tag);
    const idToTemp = new Map<number | string, string>();
    tasks.forEach((t, i) => idToTemp.set(t.id, `temp-${i + 1}`));
    return tasks.map((t, i) => mapTaskToSuggested(t, i, idToTemp));
  }

  async expandTask(
    _content: { title: string; description?: string },
    workspaceSlug: string,
    projectId: string,
    tag: string,
    taskId: number,
    options: { maxSubtasks?: number; prompt?: string } = {}
  ): Promise<SuggestedTask[]> {
    const max = options.maxSubtasks ?? 5;

    // Use persistent project directory
    const projectDir = this.storage.ensureProjectDir(workspaceSlug, projectId);
    await this.storage.initTaskMaster(projectDir);
    ensureTaskMasterConfig(projectDir);

    // Read existing tasks.json to find the correct task
    const tasksPath = path.join(projectDir, ".taskmaster", "tasks", "tasks.json");
    const allTasks = parseTasksFile(tasksPath, tag);

    // Search recursively in tasks and subtasks
    const task = findTaskById(allTasks, taskId);

    if (!task) {
      // Collect all task IDs (including subtasks) for error message
      const allTaskIds: (number | string)[] = [];
      collectTaskIds(allTasks, allTaskIds);
      throw new Error(`Task with id ${taskId} not found in tag ${tag}. Available tasks: ${allTaskIds.join(", ")}`);
    }

    // Check if task is nested in subtasks - CLI can't find nested tasks
    // We need to flatten temporarily for CLI, then restore hierarchy
    const isNested = !allTasks.some((t) => t.id === taskId);

    if (isNested) {
      // Flatten tasks temporarily for CLI
      const flattenedTasks = this.flattenTasksForCli(allTasks);

      // Read current tasks.json to preserve other tags
      const currentContent = fs.readFileSync(tasksPath, "utf-8");
      const currentData: unknown = JSON.parse(currentContent);
      let tasksData: Record<string, { tasks: TaskMasterTask[] }> = {};

      if (typeof currentData === "object" && currentData !== null && !Array.isArray(currentData)) {
        tasksData = currentData as Record<string, { tasks: TaskMasterTask[] }>;
      }

      // Temporarily replace with flattened structure
      tasksData[tag] = { tasks: flattenedTasks };
      fs.writeFileSync(tasksPath, JSON.stringify(tasksData, null, 2), "utf-8");

      try {
        const args = ["expand", `--id=${taskId}`, "-n", String(max), "--force", "--tag", tag];
        if (options.prompt) args.push("--prompt", options.prompt);

        await this.runCli(args, projectDir);

        // Read the flattened result from CLI
        const flattenedResult = parseTasksFile(tasksPath, tag);
        const expandedTask = flattenedResult.find((t) => t.id === taskId);
        const newSubtasks = expandedTask?.subtasks ?? [];

        // Update the original hierarchical structure with new subtasks
        const originalTask = findTaskById(allTasks, taskId);
        if (originalTask) {
          originalTask.subtasks = newSubtasks;
        }

        // Restore original hierarchical structure with updated subtasks
        tasksData[tag] = { tasks: allTasks };
        fs.writeFileSync(tasksPath, JSON.stringify(tasksData, null, 2), "utf-8");

        // Return the new subtasks
        const idToTemp = new Map<number | string, string>();
        newSubtasks.forEach((t, i) => idToTemp.set(t.id, `temp-${i + 1}`));
        return newSubtasks.map((t, i) => mapTaskToSuggested(t, i, idToTemp));
      } catch (error: unknown) {
        // Restore original hierarchical structure on error
        tasksData[tag] = { tasks: allTasks };
        fs.writeFileSync(tasksPath, JSON.stringify(tasksData, null, 2), "utf-8");
        throw error;
      }
    } else {
      // Task is at top level, CLI can find it
      const args = ["expand", `--id=${taskId}`, "-n", String(max), "--force", "--tag", tag];
      if (options.prompt) args.push("--prompt", options.prompt);

      await this.runCli(args, projectDir);
    }

    // Re-read tasks.json after expand
    const updatedTasks = parseTasksFile(tasksPath, tag);
    // Search recursively in case task is nested in subtasks
    const updatedTask = findTaskById(updatedTasks, taskId);
    const subs = updatedTask?.subtasks ?? [];

    const idToTemp = new Map<number | string, string>();
    subs.forEach((t, i) => idToTemp.set(t.id, `temp-${i + 1}`));
    return subs.map((t, i) => mapTaskToSuggested(t, i, idToTemp));
  }
}
