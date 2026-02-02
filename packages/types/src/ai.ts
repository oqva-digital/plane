import type { IProjectLite } from "./project";
import type { IWorkspaceLite } from "./workspace";

export interface IGptResponse {
  response: string;
  response_html: string;
  count: number;
  project_detail: IProjectLite;
  workspace_detail: IWorkspaceLite;
}

// --- Task breakdown (Task Master) DTOs ---

export interface ITaskBreakdownRequest {
  work_item_id: string;
  workspace_slug: string;
  project_id: string;
}

export type TTaskBreakdownPriority = string;

export interface ITaskBreakdownSuggestedTask {
  temp_id: string;
  title: string;
  description: string;
  priority: TTaskBreakdownPriority;
  dependencies: string[];
  tags: string[];
}

export interface ITaskBreakdownSourceWorkItem {
  id: string;
  title: string;
  description: string;
}

export interface ITaskBreakdownResponse {
  success: boolean;
  source_work_item: ITaskBreakdownSourceWorkItem;
  suggested_tasks: ITaskBreakdownSuggestedTask[];
  metadata: Record<string, unknown>;
}

// NOTE: This payload is a placeholder until the real API contract is defined.
// It assumes that we send back the selected tasks to be created in Plane.
export interface ITaskBreakdownCreateTasksPayload {
  source_work_item_id: string;
  workspace_slug: string;
  project_id: string;
  tasks: Array<{
    temp_id?: string;
    title: string;
    description?: string;
    priority?: TTaskBreakdownPriority;
    dependencies?: string[];
    tags?: string[];
  }>;
}
