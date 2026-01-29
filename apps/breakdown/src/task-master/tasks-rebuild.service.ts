import { Injectable } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
import { PlaneClient } from "../plane/plane.client";
import { WorkItemTreeService } from "./work-item-tree.service";
import { TaskMasterStorageService } from "./task-master-storage.service";
import type { TaskMasterTask } from "./task-master.types";

@Injectable()
export class TasksRebuildService {
  constructor(
    private readonly plane: PlaneClient,
    private readonly treeService: WorkItemTreeService,
    private readonly storage: TaskMasterStorageService
  ) {}

  /**
   * Rebuilds tasks.json from Plane.so work item tree.
   * Finds root PRD, fetches entire tree, and writes to tasks.json with tag.
   */
  async rebuildTasksJsonFromPlane(
    workspaceSlug: string,
    projectId: string,
    workItemId: string,
    projectDir: string
  ): Promise<void> {
    // Find root PRD by traversing up the hierarchy
    // Returns { tagId: string for tag generation, uuid: string for API calls }
    // Pass original workItemId to preserve sequence_id format
    const rootPrd = await this.findRootPrd(
      workspaceSlug,
      projectId,
      workItemId,
      new Set<string>(),
      10,
      workItemId // Original workItemId to preserve format
    );

    // Fetch entire tree starting from root PRD (use UUID for API call)
    const workItems = await this.treeService.fetchWorkItemTree(workspaceSlug, projectId, rootPrd.uuid);

    if (workItems.length === 0) {
      console.warn(`[TasksRebuild] No work items found for root PRD ${rootPrd.uuid}`);
      return;
    }

    // Build tree structure and convert to TaskMasterTask format
    // Use UUID to find root in workItems array
    const tasks = this.treeService.buildTreeFromWorkItems(workItems, rootPrd.uuid);

    // Keep the hierarchical structure - don't flatten
    // The task-master CLI should be able to find tasks in subtasks via findTaskById

    // Get tag name for this PRD (use tagId which is sequence_id or UUID)
    const tag = this.storage.getTagName(rootPrd.tagId);

    // Ensure .taskmaster/tasks directory exists
    const tasksDir = path.join(projectDir, ".taskmaster", "tasks");
    if (!fs.existsSync(tasksDir)) {
      fs.mkdirSync(tasksDir, { recursive: true });
    }

    // Read existing tasks.json to preserve other tags
    const tasksPath = path.join(tasksDir, "tasks.json");
    let existingData: Record<string, { tasks: TaskMasterTask[] }> = {};

    if (fs.existsSync(tasksPath)) {
      try {
        const content = fs.readFileSync(tasksPath, "utf-8");
        const parsed: unknown = JSON.parse(content);
        // Only preserve if it's the tagged format
        if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
          existingData = parsed as Record<string, { tasks: TaskMasterTask[] }>;
        }
      } catch (error: unknown) {
        console.error(`[TasksRebuild] Failed to read existing tasks.json:`, error);
      }
    }

    // Update the tag with new tasks (keep hierarchical structure)
    existingData[tag] = { tasks };

    // Write updated tasks.json
    fs.writeFileSync(tasksPath, JSON.stringify(existingData, null, 2), "utf-8");
  }

  /**
   * Traverses up the work item hierarchy to find the root PRD (no parent).
   * Returns both tagId (for tag generation) and uuid (for API calls).
   * @param originalWorkItemId The original work_item_id used to start the search (preserves sequence_id format)
   */
  private async findRootPrd(
    workspaceSlug: string,
    projectId: string,
    workItemId: string,
    visited = new Set<string>(),
    maxDepth = 10,
    originalWorkItemId?: string
  ): Promise<{ tagId: string; uuid: string }> {
    if (visited.has(workItemId) || maxDepth <= 0) {
      throw new Error("Circular reference detected in work item hierarchy or max depth exceeded");
    }

    visited.add(workItemId);

    const workItem = await this.plane.getWorkItem(workspaceSlug, projectId, workItemId);

    // If no parent, it's the root PRD
    if (!workItem.parent) {
      // Return both tagId (sequence_id for tag, or UUID) and uuid (always UUID for API)
      let tagId: string;
      if (workItem.sequence_id) {
        const seqIdStr = String(workItem.sequence_id);
        // If sequence_id is just a number (e.g., "1"), try to reconstruct full format
        if (/^\d+$/.test(seqIdStr)) {
          // Try to get the full format by using originalWorkItemId prefix
          if (originalWorkItemId) {
            const seqIdMatch = originalWorkItemId.match(/^([A-Z]+)-\d+$/i);
            if (seqIdMatch) {
              const prefix = seqIdMatch[1];
              const reconstructed = `${prefix}-${seqIdStr}`;
              // Verify the reconstructed format
              try {
                const verify = await this.plane.getWorkItem(workspaceSlug, projectId, reconstructed);
                if (verify.id === workItem.id) {
                  tagId = reconstructed;
                } else {
                  tagId = seqIdStr;
                }
              } catch {
                // If verification fails, try to get from UUID
                try {
                  const byUuid = await this.plane.getWorkItem(workspaceSlug, projectId, workItem.id);
                  if (byUuid.sequence_id && !/^\d+$/.test(String(byUuid.sequence_id))) {
                    tagId = String(byUuid.sequence_id);
                  } else {
                    tagId = seqIdStr;
                  }
                } catch {
                  tagId = seqIdStr;
                }
              }
            } else {
              // If originalWorkItemId doesn't have prefix format, try UUID fetch
              try {
                const byUuid = await this.plane.getWorkItem(workspaceSlug, projectId, workItem.id);
                if (byUuid.sequence_id && !/^\d+$/.test(String(byUuid.sequence_id))) {
                  tagId = String(byUuid.sequence_id);
                } else {
                  tagId = seqIdStr;
                }
              } catch {
                tagId = seqIdStr;
              }
            }
          } else {
            // No originalWorkItemId, try UUID fetch
            try {
              const byUuid = await this.plane.getWorkItem(workspaceSlug, projectId, workItem.id);
              if (byUuid.sequence_id && !/^\d+$/.test(String(byUuid.sequence_id))) {
                tagId = String(byUuid.sequence_id);
              } else {
                tagId = seqIdStr;
              }
            } catch {
              tagId = seqIdStr;
            }
          }
        } else {
          // Already full format (e.g., "TEST-1")
          tagId = seqIdStr;
        }
      } else {
        tagId = workItem.id;
      }
      return { tagId, uuid: workItem.id };
    }

    // Recursively search for parent
    return this.findRootPrd(workspaceSlug, projectId, workItem.parent, visited, maxDepth - 1, originalWorkItemId);
  }

  /**
   * Finds the task_id for a work_item_id in the rebuilt tasks.json.
   * Reads the tasks.json file and searches for the matching work item by title/description.
   */
  async findTaskIdForWorkItem(
    workspaceSlug: string,
    projectId: string,
    workItemId: string,
    projectDir: string
  ): Promise<number | null> {
    // Get work item to match
    const workItem = await this.plane.getWorkItem(workspaceSlug, projectId, workItemId);

    // Find root PRD to get tag
    const rootPrd = await this.findRootPrd(
      workspaceSlug,
      projectId,
      workItemId,
      new Set<string>(),
      10,
      workItemId // Original workItemId to preserve format
    );

    // Get tag
    const tag = this.storage.getTagName(rootPrd.tagId);

    // Read tasks.json
    const tasksPath = path.join(projectDir, ".taskmaster", "tasks", "tasks.json");

    if (!fs.existsSync(tasksPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(tasksPath, "utf-8");
      const data: unknown = JSON.parse(content);
      if (typeof data !== "object" || data === null || Array.isArray(data)) {
        return null;
      }

      const tasksData = data as Record<string, { tasks: TaskMasterTask[] }>;
      const tasks = tasksData[tag]?.tasks || [];

      // Search for task matching this work item by title
      // We need to traverse the tree to find it
      return this.findTaskIdInTree(tasks, workItem.name || "");
    } catch (error) {
      console.error(`[TasksRebuild] Failed to find task_id for work_item ${workItemId}:`, error);
      return null;
    }
  }

  /**
   * Recursively searches for a task matching a work item name in the tree.
   */
  private findTaskIdInTree(tasks: TaskMasterTask[], workItemName: string): number | null {
    for (const task of tasks) {
      // Match by title (work item name)
      if (task.title === workItemName) {
        return typeof task.id === "number" ? task.id : null;
      }

      // Check subtasks
      if (task.subtasks) {
        const found = this.findTaskIdInTree(task.subtasks, workItemName);
        if (found !== null) return found;
      }
    }

    return null;
  }
}
