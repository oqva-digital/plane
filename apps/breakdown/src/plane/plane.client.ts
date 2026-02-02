import { Injectable } from "@nestjs/common";
import { firstValueFrom } from "rxjs";
import { HttpService } from "@nestjs/axios";
import type {
  WorkItem,
  Label,
  State,
  CreateWorkItemBody,
  UpdateWorkItemBody,
  CreateWorkItemRelationBody,
  Link,
  Page,
} from "./plane.types";

@Injectable()
export class PlaneClient {
  constructor(private readonly http: HttpService) {}

  /** Relative path for Plane API v1 (baseURL and X-API-Key are set in PlaneModule's HttpModule). */
  private path(...parts: string[]): string {
    return ["/api/v1", ...parts].join("/");
  }

  private static readonly UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  private isUuid(id: string): boolean {
    return PlaneClient.UUID_REGEX.test(id);
  }

  private async request<T>(cfg: {
    method: "GET" | "POST" | "PATCH" | "DELETE";
    url: string;
    data?: unknown;
    params?: Record<string, string>;
  }): Promise<T> {
    try {
      const response = await firstValueFrom(
        this.http.request<T>({
          method: cfg.method,
          url: cfg.url,
          data: cfg.data,
          params: cfg.params,
          headers: { "Content-Type": "application/json" },
        })
      );
      return response.data;
    } catch (error: unknown) {
      const err = error as {
        response?: { headers?: unknown; status?: number; statusText?: string; data?: unknown };
        message?: string;
      };
      console.error(`[PlaneClient] Request failed:`, {
        url: cfg.url,
        method: cfg.method,
        baseURL: this.http.axiosRef?.defaults?.baseURL,
        headers: err?.response?.headers ?? {},
        status: err?.response?.status,
        statusText: err?.response?.statusText,
        data: err?.response?.data,
        message: err?.message,
      });
      throw error;
    }
  }

  /**
   * Fetches a work item by UUID or by sequence ID (identifier like "TEST-1", "PROJ-123").
   * - UUID: GET /workspaces/{ws}/projects/{projectId}/work-items/{id}
   * - Sequence ID: GET /workspaces/{ws}/work-items/{id} (projectId not used)
   */
  async getWorkItem(workspaceSlug: string, projectId: string, workItemId: string): Promise<WorkItem> {
    const params = { expand: "state,labels" };
    const url = this.isUuid(workItemId)
      ? this.path("workspaces", workspaceSlug, "projects", projectId, "work-items", workItemId)
      : this.path("workspaces", workspaceSlug, "work-items", workItemId);
    return this.request<WorkItem>({ method: "GET", url, params });
  }

  async createWorkItem(workspaceSlug: string, projectId: string, body: CreateWorkItemBody): Promise<WorkItem> {
    const url = this.path("workspaces", workspaceSlug, "projects", projectId, "work-items") + "/"; // API requires trailing slash
    const res = await this.request<{ results?: WorkItem[] } | WorkItem>({
      method: "POST",
      url,
      data: body,
    });

    // API returns the created work item directly (response shape varies)
    if (Array.isArray(res)) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- API response shape varies
      return res[res.length - 1];
    } else if ((res as { results?: WorkItem[] })?.results) {
      // If it returns a paginated list (shouldn't happen), search by name
      const results = (res as { results: WorkItem[] }).results;
      const found = results.find((item) => item.name === body.name);
      if (found) return found;
      // Fallback: get the most recent
      const sorted = [...results].sort((a, b) => {
        const aItem = a as WorkItem & { created_at?: string };
        const bItem = b as WorkItem & { created_at?: string };
        const aDate = aItem.created_at ? new Date(aItem.created_at).getTime() : 0;
        const bDate = bItem.created_at ? new Date(bItem.created_at).getTime() : 0;
        return bDate - aDate;
      });
      const first = sorted[0];
      if (!first) throw new Error("Empty results from create work item");
      return first;
    } else {
      return res as WorkItem;
    }
  }

  async listLabels(workspaceSlug: string, projectId: string): Promise<Label[]> {
    const url = this.path("workspaces", workspaceSlug, "projects", projectId, "labels");
    const res = await this.request<{ results?: Label[] }>({
      method: "GET",
      url,
    });
    return Array.isArray(res) ? res : (res?.results ?? []);
  }

  async listStates(workspaceSlug: string, projectId: string): Promise<State[]> {
    const url = this.path("workspaces", workspaceSlug, "projects", projectId, "states");
    const res = await this.request<{ results?: State[] } | State[]>({
      method: "GET",
      url,
    });
    return Array.isArray(res) ? res : (res?.results ?? []);
  }

  /**
   * Lists all work items in a project.
   * Handles pagination if API returns paginated results.
   */
  async listWorkItems(
    workspaceSlug: string,
    projectId: string,
    params?: { expand?: string; parent?: string | null }
  ): Promise<WorkItem[]> {
    const url = this.path("workspaces", workspaceSlug, "projects", projectId, "work-items");
    const requestParams: Record<string, string> = {};
    if (params?.expand) {
      requestParams.expand = params.expand;
    }
    if (params?.parent !== undefined) {
      requestParams.parent = params.parent === null ? "" : params.parent;
    }

    const res = await this.request<{ results?: WorkItem[] } | WorkItem[] | WorkItem>({
      method: "GET",
      url,
      params: Object.keys(requestParams).length > 0 ? requestParams : undefined,
    });

    // Handle different response formats
    if (Array.isArray(res)) {
      return res;
    } else if ((res as { results?: WorkItem[] })?.results) {
      return (res as { results: WorkItem[] }).results;
    } else {
      // Single item (shouldn't happen for list, but handle it)
      return [res as WorkItem];
    }
  }

  /**
   * Updates a work item by UUID or by sequence ID.
   * - UUID: PATCH /workspaces/{ws}/projects/{projectId}/work-items/{id}/
   * - Sequence ID: PATCH /workspaces/{ws}/work-items/{id}/ (projectId not used)
   */
  async updateWorkItem(
    workspaceSlug: string,
    projectId: string,
    workItemId: string,
    body: UpdateWorkItemBody
  ): Promise<WorkItem> {
    const url =
      (this.isUuid(workItemId)
        ? this.path("workspaces", workspaceSlug, "projects", projectId, "work-items", workItemId)
        : this.path("workspaces", workspaceSlug, "work-items", workItemId)) + "/"; // API requires trailing slash
    return this.request<WorkItem>({ method: "PATCH", url, data: body });
  }

  /**
   * Creates a relation between work items.
   * Endpoint: POST /api/v1/workspaces/{workspace}/projects/{project_id}/work-items/{work_item_id}/issue-relation/create/
   *
   * @param workspaceSlug Workspace slug
   * @param projectId Project UUID
   * @param workItemId Work item UUID (must be UUID, not sequence_id)
   * @param body Relation body with relation_type and issues array
   */
  async createWorkItemRelation(
    workspaceSlug: string,
    projectId: string,
    workItemId: string,
    body: CreateWorkItemRelationBody
  ): Promise<unknown> {
    // Endpoint follows the standard /api/v1/.../work-items/... pattern
    // Path: /api/v1/workspaces/{workspace}/projects/{project_id}/work-items/{work_item_id}/issue-relation/create/
    const url =
      this.path(
        "workspaces",
        workspaceSlug,
        "projects",
        projectId,
        "work-items",
        workItemId,
        "issue-relation",
        "create"
      ) + "/"; // API requires trailing slash
    try {
      return await this.request<unknown>({ method: "POST", url, data: body });
    } catch (error: unknown) {
      const err = error as { response?: { status?: number; statusText?: string; data?: unknown }; message?: string };
      console.error(`[PlaneClient] Failed to create work item relation:`, {
        workspaceSlug,
        projectId,
        workItemId,
        relationType: body.relation_type,
        issues: body.issues,
        url,
        status: err?.response?.status,
        statusText: err?.response?.statusText,
        errorData: err?.response?.data,
        message: err?.message,
      });
      throw error;
    }
  }

  /**
   * Lists all links attached to a work item.
   * Endpoint: GET /api/v1/workspaces/{workspace_slug}/projects/{project_id}/work-items/{work_item_id}/links/
   */
  async listWorkItemLinks(workspaceSlug: string, projectId: string, workItemId: string): Promise<Link[]> {
    // Need to get UUID if sequence_id is provided
    let uuid = workItemId;
    if (!this.isUuid(workItemId)) {
      const wi = await this.getWorkItem(workspaceSlug, projectId, workItemId);
      uuid = wi.id;
    }

    const url = this.path("workspaces", workspaceSlug, "projects", projectId, "work-items", uuid, "links") + "/";
    const res = await this.request<{ results?: Link[] } | Link[]>({
      method: "GET",
      url,
    });
    return Array.isArray(res) ? res : (res?.results ?? []);
  }

  /**
   * Retrieves a project page by its ID.
   * Tries the public API v1 first, falls back to internal API if not available.
   * Endpoint: GET /api/v1/workspaces/{workspace_slug}/projects/{project_id}/pages/{page_id}/
   */
  async getPage(workspaceSlug: string, projectId: string, pageId: string): Promise<Page> {
    // Try public API v1 first (same as other endpoints)
    const url = this.path("workspaces", workspaceSlug, "projects", projectId, "pages", pageId) + "/";
    return this.request<Page>({ method: "GET", url });
  }
}
