export interface SuggestedTask {
  temp_id: string;
  title: string;
  description: string;
  details?: string;
  test_strategy?: string;
  priority: "urgent" | "high" | "medium" | "low" | "none";
  estimated_hours?: number;
  dependencies: string[];
  tags: string[];
}

/** Raw task from Task Master tasks.json (master.tasks[] or tasks[]) */
export interface TaskMasterTask {
  id: number | string;
  title: string;
  description?: string;
  details?: string;
  status?: string;
  priority?: string;
  dependencies?: (number | string)[];
  subtasks?: TaskMasterTask[];
  category?: string;
  [key: string]: unknown;
}

export interface TaskMasterTasksFile {
  master?: { tasks: TaskMasterTask[] };
  tasks?: TaskMasterTask[];
}
