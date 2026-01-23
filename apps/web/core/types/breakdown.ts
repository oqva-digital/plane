/**
 * Types for Task Master breakdown integration (frontend-specific).
 * These types define the contract between the frontend and the external Task Master API.
 */

export interface ITaskBreakdownRequest {
  work_item_id: string;
  workspace_slug: string;
  project_id: string;
  options?: {
    max_tasks?: number;
    include_estimates?: boolean;
    language?: string;
  };
}

export interface ITaskBreakdownExpandRequest {
  work_item_id: string;
  workspace_slug: string;
  project_id: string;
  options?: {
    max_subtasks?: number;
    include_context_from_parent?: boolean;
  };
}

export type TTaskBreakdownPriority = string;

export interface ITaskBreakdownSuggestedTask {
  temp_id: string;
  title: string;
  description: string;
  details?: string;
  test_strategy?: string;
  priority: TTaskBreakdownPriority;
  estimated_hours?: number;
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

/**
 * Payload for confirming and creating tasks from breakdown suggestions.
 * POST /api/breakdown/confirm
 */
export interface ITaskBreakdownConfirmRequest {
  workspace_slug: string;
  project_id: string;
  parent_work_item_id: string;
  tasks_to_create: Array<{
    title: string;
    description?: string;
    priority?: TTaskBreakdownPriority;
    labels?: string[];
  }>;
  options?: {
    link_to_parent?: boolean;
    set_parent_as_epic?: boolean;
  };
}

/**
 * Response from /api/breakdown/confirm
 */
export interface ITaskBreakdownConfirmCreatedItem {
  id: string;
  name: string;
}

export interface ITaskBreakdownConfirmFailedItem {
  index: number;
  error: string;
}

export interface ITaskBreakdownConfirmResponse {
  success: boolean;
  created: ITaskBreakdownConfirmCreatedItem[];
  failed?: ITaskBreakdownConfirmFailedItem[];
}
