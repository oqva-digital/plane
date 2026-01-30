import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as fs from "fs";
import * as path from "path";
import { PlaneClient } from "../plane/plane.client";
import { TaskMasterService } from "../task-master/task-master.service";
import { TaskMasterStorageService } from "../task-master/task-master-storage.service";
import { TasksRebuildService } from "../task-master/tasks-rebuild.service";
import { getTaskGenerationPrompt } from "../task-master/task-prompts";
import type { WorkItem, CreateWorkItemBody } from "../plane/plane.types";
import type { SuggestedTask } from "../task-master/task-master.types";
import type { BreakdownRequestDto } from "./dto/breakdown.dto";
import type { ConfirmRequestDto } from "./dto/confirm.dto";
import type { ExpandRequestDto } from "./dto/expand.dto";

import Turndown from "turndown";
const td = new Turndown();

function htmlToMarkdown(html: string | undefined | null): string {
  if (!html || !html.trim()) return "";
  try {
    return td.turndown(html);
  } catch {
    return html.replace(/<[^>]+>/g, "");
  }
}

function toDescriptionHtml(s: string | undefined): string | undefined {
  if (!s?.trim()) return undefined;
  if (/<[a-z][\s\S]*>/i.test(s)) return s;
  return `<p>${String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")}</p>`;
}

function toPlanePriority(p: string | undefined): "urgent" | "high" | "medium" | "low" | "none" {
  const v = (p || "medium").toLowerCase();
  if (v === "urgent" || v === "critical") return "urgent";
  if (v === "high") return "high";
  if (v === "low") return "low";
  if (v === "none") return "none";
  return "medium";
}

/**
 * Parsed result from a Plane page URL.
 */
interface PlanePageUrlInfo {
  workspaceSlug: string;
  projectId: string;
  pageId: string;
}

/**
 * Extracts workspace_slug, project_id, and page_id from a Plane page URL.
 * URL format: https://plane.mush.so/{workspace}/projects/{project_id}/pages/{page_id}
 * Returns null if the URL doesn't match the expected format.
 */
function parsePlanePageUrl(url: string): PlanePageUrlInfo | null {
  try {
    const parsed = new URL(url);
    // Match pattern: /{workspace}/projects/{project_id}/pages/{page_id}
    const match = parsed.pathname.match(/^\/([^/]+)\/projects\/([^/]+)\/pages\/([^/]+)\/?$/);
    if (!match) return null;

    return {
      workspaceSlug: match[1],
      projectId: match[2],
      pageId: match[3],
    };
  } catch {
    return null;
  }
}

/**
 * Calculates incremental start date based on task index.
 * @param index Task index in array (0-based)
 * @param baseDate Base date (optional, defaults to today)
 * @returns String in YYYY-MM-DD format
 */
function calculateStartDate(index: number, baseDate?: Date): string {
  const base = baseDate ?? new Date();
  const date = new Date(base.getTime());
  date.setDate(date.getDate() + index);

  // Format as YYYY-MM-DD
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

@Injectable()
export class BreakdownService {
  constructor(
    private readonly plane: PlaneClient,
    private readonly taskMaster: TaskMasterService,
    private readonly storage: TaskMasterStorageService,
    private readonly tasksRebuild: TasksRebuildService,
    private readonly config: ConfigService
  ) {}

  async breakdown(dto: BreakdownRequestDto): Promise<{
    success: boolean;
    source_work_item: { id: string; title: string; description: string };
    suggested_tasks: SuggestedTask[];
    metadata?: Record<string, unknown>;
  }> {
    const wi = await this.plane.getWorkItem(dto.workspace_slug, dto.project_id, dto.work_item_id);
    const name = wi.name || "Untitled";
    const md = htmlToMarkdown(wi.description_html);
    const prd = `# ${name}\n\n${md}`.trim();

    // Rebuild tasks.json from Plane.so tree before parsing PRD
    const projectDir = this.storage.ensureProjectDir(dto.workspace_slug, dto.project_id);
    await this.tasksRebuild.rebuildTasksJsonFromPlane(dto.workspace_slug, dto.project_id, dto.work_item_id, projectDir);

    // Fetch linked pages content for additional context
    const pagesContext = await this.fetchLinkedPagesContent(dto.workspace_slug, dto.project_id, dto.work_item_id);

    const opts = dto.options ?? {};
    const maxTasks = opts.max_tasks ?? this.config.get<number>("MAX_TASKS_DEFAULT") ?? 10;
    let prompt = getTaskGenerationPrompt(opts.prompt);

    // Add pages context to the prompt if available
    if (pagesContext) {
      prompt = `${prompt}\n\n## Additional Context from Linked Documentation:\n\n${pagesContext}`;
    }

    // Use research mode to get more detailed tasks
    // Research mode uses Perplexity/OpenAI to gather context and generate more comprehensive tasks
    const tasks = await this.taskMaster.parsePrdFromContent(prd, dto.workspace_slug, dto.project_id, dto.work_item_id, {
      maxTasks,
      research: false,
      prompt,
    });

    return {
      success: true,
      source_work_item: { id: wi.id, title: name, description: md || name },
      suggested_tasks: tasks,
    };
  }

  /**
   * Fetches content from linked Plane pages attached to a work item.
   * Only processes links that match the Plane page URL format.
   * @returns Formatted markdown content from all linked pages, or empty string if none
   */
  private async fetchLinkedPagesContent(workspaceSlug: string, projectId: string, workItemId: string): Promise<string> {
    try {
      // Fetch all links attached to the work item
      const links = await this.plane.listWorkItemLinks(workspaceSlug, projectId, workItemId);

      if (!links || links.length === 0) {
        return "";
      }

      const pageContents: string[] = [];

      for (const link of links) {
        // Parse the URL to check if it's a Plane page
        const pageInfo = parsePlanePageUrl(link.url);
        if (!pageInfo) {
          // Not a Plane page URL, skip
          continue;
        }

        try {
          // Fetch the page content
          const page = await this.plane.getPage(pageInfo.workspaceSlug, pageInfo.projectId, pageInfo.pageId);

          // Convert page content to markdown
          const pageTitle = page.name || "Untitled Page";
          const pageContent = htmlToMarkdown(page.description_html);

          if (pageContent) {
            console.log(`[Breakdown] Fetched page ${pageInfo.pageId}: ${pageTitle}`);
            pageContents.push(`### ${pageTitle}\n\n${pageContent}`);
          }
        } catch (e: unknown) {
          // Check if it's a 401 error (expected - Pages API doesn't support X-API-Key)
          const err = e as { response?: { status?: number } };
          const status = err?.response?.status;
          if (status === 401) {
            // This is expected - Plane's Pages API only supports session/cookie auth, not X-API-Key
            console.log(
              `[Breakdown] Skipping page ${pageInfo.pageId} - Pages API requires session auth (not supported via API Key)`
            );
          } else {
            // Log other errors but continue processing
            console.error(
              `[Breakdown] Failed to fetch page ${pageInfo.pageId}:`,
              e instanceof Error ? e.message : String(e)
            );
          }
        }
      }

      if (pageContents.length === 0) {
        return "";
      }

      return pageContents.join("\n\n---\n\n");
    } catch (e) {
      // Log error but don't fail the breakdown
      console.error(`[Breakdown] Failed to fetch linked pages:`, e instanceof Error ? e.message : String(e));
      return "";
    }
  }

  async confirm(dto: ConfirmRequestDto): Promise<{
    success: boolean;
    created: Array<{ id: string; name: string }>;
    failed?: Array<{ index: number; error: string }>;
  }> {
    const [states, labels] = await Promise.all([
      this.plane.listStates(dto.workspace_slug, dto.project_id),
      this.plane.listLabels(dto.workspace_slug, dto.project_id),
    ]);

    const defaultState =
      states.find((s) => s.default) ??
      states.find((s) => ["backlog", "unstarted"].includes(s.group ?? "")) ??
      states[0];
    const stateId = defaultState?.id;

    const labelMap = new Map<string, string>();
    for (const l of labels) labelMap.set(l.name.toLowerCase(), l.id);

    const link = dto.options?.link_to_parent !== false;
    let parent: string | undefined;
    let parentLabels: string[] = []; // Labels from parent work item
    let parentGithubLink: string | undefined;
    let parentAgent: string | undefined;

    // Fetch parent work item to get its labels, github_link, agent and UUID
    if (dto.parent_work_item_id) {
      try {
        const parentWorkItem = await this.plane.getWorkItem(
          dto.workspace_slug,
          dto.project_id,
          dto.parent_work_item_id
        );
        parent = parentWorkItem.id; // Use parent's UUID, not sequence_id

        // Extract parent labels
        if (parentWorkItem.labels && parentWorkItem.labels.length > 0) {
          parentLabels = parentWorkItem.labels.map((l) => l.id);
        } else if (parentWorkItem.label_ids && parentWorkItem.label_ids.length > 0) {
          parentLabels = parentWorkItem.label_ids;
        }

        // Extract parent github_link and agent (inherit to children)
        if (parentWorkItem.github_link && parentWorkItem.github_link.trim()) {
          parentGithubLink = parentWorkItem.github_link.trim();
        }
        if (parentWorkItem.agent && parentWorkItem.agent.trim()) {
          parentAgent = parentWorkItem.agent.trim();
        }
      } catch (e) {
        console.error(`[Confirm] Failed to fetch parent work item ${dto.parent_work_item_id}:`, e);
        // If it fails, try using the ID directly (might be UUID)
        if (link) {
          parent = dto.parent_work_item_id;
        }
      }
    }

    const created: Array<{ id: string; name: string; temp_id?: string }> = [];
    const failed: Array<{ index: number; error: string }> = [];

    // Map to store temp_id → work_item_id for dependency resolution
    const tempIdToWorkItemId = new Map<string, string>();

    // Get tag and projectDir
    const prdTag = this.storage.getTagName(dto.parent_work_item_id);
    const projectDir = this.storage.ensureProjectDir(dto.workspace_slug, dto.project_id);
    // Read tasks.json to get the correct task IDs in the tag
    const tasksPath = path.join(projectDir, ".taskmaster", "tasks", "tasks.json");
    let tasksInTag: Array<{ id: number; title: string }> = [];
    if (fs.existsSync(tasksPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(tasksPath, "utf-8")) as
          | Record<string, { tasks: Array<{ id: number; title: string }> }>
          | { master?: { tasks: Array<{ id: number; title: string }> } };
        const rawRecord = raw as Record<string, { tasks: Array<{ id: number; title: string }> }>;
        if (typeof raw === "object" && rawRecord[prdTag]?.tasks) {
          tasksInTag = rawRecord[prdTag].tasks;
        } else if ((raw as { master?: { tasks: Array<{ id: number; title: string }> } }).master?.tasks) {
          tasksInTag = (raw as { master: { tasks: Array<{ id: number; title: string }> } }).master.tasks;
        }
      } catch (e) {
        console.error(`[Confirm] Error reading tasks.json:`, e);
      }
    }

    // Create title → task.id map to map created tasks
    const titleToTaskId = new Map<string, number>();
    for (const task of tasksInTag) {
      titleToTaskId.set(task.title.trim().toLowerCase(), task.id);
    }

    // Step 1: Create all work items first
    for (let i = 0; i < dto.tasks_to_create.length; i++) {
      const t = dto.tasks_to_create[i];

      // Get labels from task
      const taskLabelIds = (t.labels ?? []).map((n) => labelMap.get(n.toLowerCase())).filter(Boolean) as string[];

      // Combine parent labels with task labels (parent labels first, then task labels)
      // Remove duplicates by converting to Set and back to array
      const allLabelIds = Array.from(new Set([...parentLabels, ...taskLabelIds]));

      // Build body removing undefined fields (API may reject if undefined is sent)
      const body: CreateWorkItemBody = {
        name: t.title,
      };
      const descHtml = toDescriptionHtml(t.description);
      if (descHtml) {
        body.description_html = descHtml;
      }
      if (stateId) {
        body.state = stateId;
      }
      const priority = toPlanePriority(t.priority);
      if (priority) {
        body.priority = priority;
      }
      if (allLabelIds.length > 0) {
        body.labels = allLabelIds; // API uses 'labels', not 'label_ids'
      }
      if (parent && link) {
        body.parent = parent;
      }
      // Inherit github_link and agent from parent if task does not have its own
      const githubLink = t.github_link?.trim() || parentGithubLink;
      if (githubLink) {
        body.github_link = githubLink;
      }
      const agent = t.agent?.trim() || parentAgent;
      if (agent) {
        body.agent = agent;
      }
      // Set incremental start_date for ordering in Plane
      body.start_date = calculateStartDate(i);

      try {
        const res = await this.plane.createWorkItem(dto.workspace_slug, dto.project_id, body);
        created.push({ id: res.id, name: res.name, temp_id: t.temp_id });

        // Store mapping for dependency resolution
        if (t.temp_id) {
          tempIdToWorkItemId.set(t.temp_id, res.id);
        }
      } catch (e: unknown) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        console.error(`[Confirm] Failed to create work item ${i + 1}:`, errorMsg);
        failed.push({
          index: i,
          error: errorMsg,
        });
      }
    }

    // Step 2: Resolve and apply dependencies
    // Create a map from temp_id to created item for easier lookup
    const tempIdToCreatedItem = new Map<string, { id: string; name: string }>();
    for (const item of created) {
      if (item.temp_id) {
        tempIdToCreatedItem.set(item.temp_id, { id: item.id, name: item.name });
      }
    }

    for (let i = 0; i < dto.tasks_to_create.length; i++) {
      const t = dto.tasks_to_create[i];

      // Skip if task has no temp_id, no dependencies, or task creation failed
      if (!t.temp_id || !t.dependencies || !Array.isArray(t.dependencies) || t.dependencies.length === 0) {
        continue;
      }

      // Find the created item for this task
      const createdItem = tempIdToCreatedItem.get(t.temp_id);
      if (!createdItem) {
        continue;
      }

      // Resolve temp_ids to work item IDs
      const blockedBy = t.dependencies
        .map((tempId: string) => tempIdToWorkItemId.get(tempId))
        .filter((id): id is string => Boolean(id));

      if (blockedBy.length === 0) {
        continue;
      }

      // Create work item relations using the issue-relation endpoint
      try {
        await this.plane.createWorkItemRelation(dto.workspace_slug, dto.project_id, createdItem.id, {
          relation_type: "blocked_by",
          issues: blockedBy,
        });
      } catch (e: unknown) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        console.error(`[Confirm] Failed to create relations for work item "${t.title}":`, errorMsg);
        // Don't fail the entire operation, just log the error
      }
    }

    // Return created items without temp_id (for backward compatibility)
    const createdResponse = created.map(({ id, name }) => ({ id, name }));

    return {
      success: failed.length === 0,
      created: createdResponse,
      ...(failed.length ? { failed } : {}),
    };
  }

  async expand(dto: ExpandRequestDto): Promise<{
    success: boolean;
    source_work_item: { id: string; title: string };
    suggested_tasks: SuggestedTask[];
    metadata?: Record<string, unknown>;
  }> {
    // Get work item - PlaneClient handles both UUID and sequence_id automatically
    const wi = await this.plane.getWorkItem(dto.workspace_slug, dto.project_id, dto.work_item_id);

    const projectDir = this.storage.ensureProjectDir(dto.workspace_slug, dto.project_id);

    // Rebuild tasks.json from Plane.so tree before expanding
    // Use original work_item_id - PlaneClient will handle UUID/sequence_id detection
    await this.tasksRebuild.rebuildTasksJsonFromPlane(dto.workspace_slug, dto.project_id, dto.work_item_id, projectDir);

    // Find root PRD to get tag
    // Use original work_item_id - findRootPrdId will handle normalization internally
    const rootPrdId = await this.findRootPrdId(
      dto.workspace_slug,
      dto.project_id,
      dto.work_item_id,
      new Set<string>(),
      10,
      new Map<string, WorkItem>(),
      dto.work_item_id
    );

    // Get tag from root PRD (for internal task-master use)
    const tag = this.storage.getTagName(rootPrdId);

    // Find task_id from rebuilt tasks.json
    // Use original work_item_id - findTaskIdForWorkItem will handle it correctly
    const taskId = await this.tasksRebuild.findTaskIdForWorkItem(
      dto.workspace_slug,
      dto.project_id,
      dto.work_item_id,
      projectDir
    );

    if (taskId === null) {
      throw new Error(
        `Could not find task_id for work_item_id "${dto.work_item_id}" in tag "${tag}". ` +
          `Make sure the work item exists in Plane.so and belongs to the PRD tree.`
      );
    }

    const opts = dto.options ?? {};
    const maxSubtasks = opts.max_subtasks ?? 5;

    // If a custom prompt was provided, use it
    let prompt: string | undefined;
    if (opts.prompt) {
      prompt = opts.prompt;
    } else {
      prompt = getTaskGenerationPrompt();
    }

    // Always include PRD context for better subtask generation
    // Read the PRD file that was created during breakdown
    const prdPath = path.join(projectDir, "PRD.md");
    let prdContext = "";
    if (fs.existsSync(prdPath)) {
      try {
        const prdContent = fs.readFileSync(prdPath, "utf-8");
        // Remove the task generation instructions section if present
        const prdWithoutInstructions = prdContent
          .replace(/^# Task Generation Instructions[\s\S]*?^---\s*\n\n?/m, "")
          .replace(/^# Product Requirements Document\s*\n\n?/m, "")
          .trim();
        if (prdWithoutInstructions) {
          prdContext = prdWithoutInstructions;
        }
      } catch (e) {
        console.error(`[Expand] Error reading PRD file:`, e);
      }
    }

    // Build prompt with PRD context
    if (prdContext) {
      prompt = `${prompt}\n\n## PRD Context (for reference when generating subtasks):\n\n${prdContext}`;
    }

    // Fetch linked pages content for additional context
    const pagesContext = await this.fetchLinkedPagesContent(dto.workspace_slug, dto.project_id, dto.work_item_id);

    // Add pages context to the prompt if available
    if (pagesContext) {
      prompt = `${prompt}\n\n## Additional Context from Linked Documentation:\n\n${pagesContext}`;
    }

    // If include_context_from_parent is active, add the parent task context to the prompt
    if (opts.include_context_from_parent) {
      const parentContext = htmlToMarkdown(wi.description_html);
      if (parentContext) {
        prompt = `${prompt}\n\n## Additional context from parent task:\n\n${parentContext}`;
      }
    }

    const tasks = await this.taskMaster.expandTask(
      {
        title: wi.name || "Untitled",
        description: htmlToMarkdown(wi.description_html),
      },
      dto.workspace_slug,
      dto.project_id,
      tag,
      taskId,
      { maxSubtasks, prompt }
    );

    return {
      success: true,
      source_work_item: { id: wi.id, title: wi.name || "Untitled" },
      suggested_tasks: tasks,
      metadata: { task_id: taskId },
    };
  }

  /**
   * Traverses the work item hierarchy up to find the root PRD (no parent).
   * Protected against infinite loops and with work item caching.
   * @param originalWorkItemId The original work_item_id used to start the search (preserves sequence_id format)
   */
  private async findRootPrdId(
    workspaceSlug: string,
    projectId: string,
    workItemId: string,
    visited = new Set<string>(),
    maxDepth = 10,
    cache = new Map<string, WorkItem>(),
    originalWorkItemId?: string
  ): Promise<string> {
    if (visited.has(workItemId) || maxDepth <= 0) {
      throw new Error("Circular reference detected in work item hierarchy or max depth exceeded");
    }

    visited.add(workItemId);

    // Use cache if available
    let current: WorkItem;
    if (cache.has(workItemId)) {
      current = cache.get(workItemId)!;
    } else {
      current = await this.plane.getWorkItem(workspaceSlug, projectId, workItemId);
      cache.set(workItemId, current);
    }

    // If no parent, it's the root PRD
    // Return sequence_id if available (to generate correct tag), otherwise UUID
    if (!current.parent) {
      if (current.sequence_id) {
        const seqIdStr = String(current.sequence_id);
        // If sequence_id is just a number (e.g., "1"), try to reconstruct full format
        if (/^\d+$/.test(seqIdStr)) {
          // Try to get the full format by fetching with UUID and checking sequence_id
          // Or try common prefixes if originalWorkItemId has a prefix
          if (originalWorkItemId) {
            const seqIdMatch = originalWorkItemId.match(/^([A-Z]+)-\d+$/i);
            if (seqIdMatch) {
              const prefix = seqIdMatch[1];
              const reconstructed = `${prefix}-${seqIdStr}`;
              // Verify the reconstructed format
              try {
                const verify = await this.plane.getWorkItem(workspaceSlug, projectId, reconstructed);
                if (verify.id === current.id) {
                  return reconstructed;
                }
              } catch {
                // If verification fails, try to get from UUID
              }
            }
          }
          // If reconstruction failed, try fetching by UUID to get full sequence_id
          try {
            const byUuid = await this.plane.getWorkItem(workspaceSlug, projectId, current.id);
            if (byUuid.sequence_id && !/^\d+$/.test(String(byUuid.sequence_id))) {
              return String(byUuid.sequence_id);
            }
          } catch {
            // If UUID fetch fails, fall through
          }
        }
        // Return sequence_id as is (may be full format like "TEST-1" or just number)
        return seqIdStr;
      }
      return current.id;
    }

    // Recursively search for parent
    return this.findRootPrdId(
      workspaceSlug,
      projectId,
      current.parent,
      visited,
      maxDepth - 1,
      cache,
      originalWorkItemId
    );
  }
}
