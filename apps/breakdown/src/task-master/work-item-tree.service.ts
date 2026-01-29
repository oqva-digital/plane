import { Injectable } from "@nestjs/common";
import { PlaneClient } from "../plane/plane.client";
import type { WorkItem } from "../plane/plane.types";
import type { TaskMasterTask } from "./task-master.types";

import Turndown from "turndown";
const td = new Turndown();

@Injectable()
export class WorkItemTreeService {
  constructor(private readonly plane: PlaneClient) {}

  /**
   * Fetches all work items in a tree starting from a root work item.
   * Fetches all work items from project and filters to get the tree.
   */
  async fetchWorkItemTree(workspaceSlug: string, projectId: string, rootWorkItemId: string): Promise<WorkItem[]> {
    // Fetch root item to get its UUID
    const rootItem = await this.plane.getWorkItem(workspaceSlug, projectId, rootWorkItemId);

    // Fetch all work items from project
    const allProjectItems = await this.plane.listWorkItems(workspaceSlug, projectId, {
      expand: "state,labels",
    });

    // Build tree starting from root
    const treeItems: WorkItem[] = [rootItem];
    const visited = new Set<string>([rootItem.id]);

    // Recursively add all descendants
    this.addDescendants(rootItem.id, allProjectItems, treeItems, visited);

    return treeItems;
  }

  /**
   * Recursively adds all descendants of a work item to the tree.
   */
  private addDescendants(parentId: string, allItems: WorkItem[], treeItems: WorkItem[], visited: Set<string>): void {
    const children = allItems.filter((item) => item.parent === parentId && !visited.has(item.id));

    for (const child of children) {
      visited.add(child.id);
      treeItems.push(child);
      // Recursively add children of this child
      this.addDescendants(child.id, allItems, treeItems, visited);
    }
  }

  /**
   * Builds a tree structure from flat work items array and converts to TaskMasterTask format.
   * Generates sequential task IDs starting from 1.
   */
  buildTreeFromWorkItems(workItems: WorkItem[], rootPrdId: string): TaskMasterTask[] {
    if (workItems.length === 0) return [];

    // Find root item
    const rootItem = workItems.find(
      (item) => item.id === rootPrdId || item.sequence_id === rootPrdId || String(item.sequence_id) === rootPrdId
    );

    if (!rootItem) {
      // If root not found, use first item without parent
      const root = workItems.find((item) => !item.parent);
      if (!root) return [];
      return this.buildTreeRecursive(workItems, root.id, { value: 1 });
    }

    return this.buildTreeRecursive(workItems, rootItem.id, { value: 1 });
  }

  /**
   * Recursively builds tree structure and converts WorkItem to TaskMasterTask.
   */
  private buildTreeRecursive(
    allWorkItems: WorkItem[],
    parentId: string,
    taskIdCounter: { value: number }
  ): TaskMasterTask[] {
    const children = allWorkItems.filter((item) => item.parent === parentId);

    const tasks: TaskMasterTask[] = [];

    for (const workItem of children) {
      const task = this.convertWorkItemToTask(workItem, allWorkItems, taskIdCounter);
      tasks.push(task);
    }

    return tasks;
  }

  /**
   * Converts a WorkItem to TaskMasterTask format.
   * Uses a global counter to ensure unique IDs across all levels.
   */
  private convertWorkItemToTask(
    workItem: WorkItem,
    allWorkItems: WorkItem[],
    taskIdCounter: { value: number }
  ): TaskMasterTask {
    const taskId = taskIdCounter.value++;
    const description = this.htmlToMarkdown(workItem.description_html);

    // Get children (subtasks)
    const children = allWorkItems.filter((item) => item.parent === workItem.id);
    const subtasks: TaskMasterTask[] = [];

    for (const child of children) {
      const subtask = this.convertWorkItemToTask(child, allWorkItems, taskIdCounter);
      subtasks.push(subtask);
    }

    // Convert priority
    const priority = this.toTaskMasterPriority(workItem.priority);

    // Get category from labels (first label name)
    const category = workItem.labels && workItem.labels.length > 0 ? workItem.labels[0].name : undefined;

    return {
      id: taskId,
      title: workItem.name || "Untitled",
      description: description || undefined,
      status: workItem.state_detail?.name || workItem.state || undefined,
      priority: priority,
      subtasks: subtasks.length > 0 ? subtasks : undefined,
      category: category,
    };
  }

  private htmlToMarkdown(html: string | undefined | null): string {
    if (!html || !html.trim()) return "";
    try {
      return td.turndown(html);
    } catch {
      // Fallback to simple HTML stripping
      return html
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .trim();
    }
  }

  private toTaskMasterPriority(priority: string | null | undefined): string | undefined {
    if (!priority) return undefined;
    const p = priority.toLowerCase();
    if (["urgent", "high", "medium", "low", "none"].includes(p)) {
      return p;
    }
    return "medium";
  }
}
