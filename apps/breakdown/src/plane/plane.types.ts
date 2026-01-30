export interface WorkItem {
  id: string;
  name: string;
  description_html?: string | null;
  state?: string | null;
  state_detail?: { id: string; name: string } | null;
  priority?: string | null;
  label_ids?: string[];
  labels?: Array<{ id: string; name: string }>;
  parent?: string | null;
  project_id?: string;
  sequence_id?: string;
  blocked_by?: string[];
  blocking?: string[];
  start_date?: string | null;
  github_link?: string | null;
  agent?: string | null;
  [key: string]: unknown;
}

export interface Label {
  id: string;
  name: string;
  color?: string;
  [key: string]: unknown;
}

export interface State {
  id: string;
  name: string;
  group?: "backlog" | "unstarted" | "started" | "completed" | "cancelled";
  default?: boolean;
  [key: string]: unknown;
}

export interface CreateWorkItemBody {
  name: string;
  description_html?: string;
  state?: string;
  priority?: string;
  labels?: string[]; // API uses 'labels', not 'label_ids'
  parent?: string;
  blocked_by?: string[];
  blocking?: string[];
  start_date?: string;
  github_link?: string;
  agent?: string;
}

export interface UpdateWorkItemBody {
  name?: string;
  description_html?: string;
  state?: string;
  priority?: string;
  labels?: string[];
  parent?: string;
  blocked_by?: string[];
  blocking?: string[];
  start_date?: string;
}

export interface CreateWorkItemRelationBody {
  relation_type: "blocked_by" | "blocking" | "relates_to" | "duplicate_of";
  issues: string[]; // Array of work item UUIDs
}

export interface Link {
  id: string;
  title?: string;
  url: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
  project?: string;
  workspace?: string;
  issue?: string;
  [key: string]: unknown;
}

export interface Page {
  id: string;
  name: string;
  description_html?: string | null;
  owned_by?: string;
  is_locked?: boolean;
  archived_at?: string | null;
  workspace?: string;
  project?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}
