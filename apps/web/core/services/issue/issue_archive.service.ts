import { API_BASE_URL } from "@plane/constants";
import type { TIssue, TIssueServiceType, TIssuesResponse } from "@plane/types";
import { EIssueServiceType } from "@plane/types";
import { APIService } from "@/services/api.service";
// types
// constants

export class IssueArchiveService extends APIService {
  private serviceType: TIssueServiceType;

  constructor(serviceType: TIssueServiceType = EIssueServiceType.ISSUES) {
    super(API_BASE_URL);
    this.serviceType = serviceType;
  }

  async getArchivedIssues(
    workspaceSlug: string,
    projectId: string,
    queries?: Record<string, unknown>,
    config = {}
  ): Promise<TIssuesResponse> {
    return this.get<TIssuesResponse>(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/archived-issues/`,
      {
        params: { ...queries },
      },
      config
    )
      .then((response): TIssuesResponse => response?.data as TIssuesResponse)
      .catch((error: { response?: { data?: unknown } }) => {
        throw error?.response?.data;
      });
  }

  async archiveIssue(
    workspaceSlug: string,
    projectId: string,
    issueId: string
  ): Promise<{
    archived_at: string;
  }> {
    return this.post(`/api/workspaces/${workspaceSlug}/projects/${projectId}/${this.serviceType}/${issueId}/archive/`)
      .then((response) => response?.data as { archived_at: string })
      .catch((error: { response?: { data?: unknown } }) => {
        throw error?.response?.data;
      });
  }

  async restoreIssue(workspaceSlug: string, projectId: string, issueId: string): Promise<Record<string, unknown>> {
    return this.delete(`/api/workspaces/${workspaceSlug}/projects/${projectId}/${this.serviceType}/${issueId}/archive/`)
      .then((response) => response?.data as Record<string, unknown>)
      .catch((error: { response?: { data?: unknown } }) => {
        throw error?.response?.data;
      });
  }

  async retrieveArchivedIssue(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    queries?: Record<string, unknown>
  ): Promise<TIssue> {
    return this.get<TIssue>(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/${this.serviceType}/${issueId}/archive/`,
      {
        params: queries,
      }
    )
      .then((response) => response?.data as TIssue)
      .catch((error: { response?: { data?: unknown } }) => {
        throw error?.response?.data;
      });
  }
}
