// services
import { API_BASE_URL } from "@plane/constants";
import type {
  CycleDateCheckData,
  ICycle,
  TIssue,
  TIssuesResponse,
  IWorkspaceActiveCyclesResponse,
  TCycleDistribution,
  TProgressSnapshot,
  TCycleEstimateDistribution,
} from "@plane/types";
import { APIService } from "@/services/api.service";

type ApiError = { response?: { data?: unknown } };

export class CycleService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async workspaceActiveCyclesAnalytics(
    workspaceSlug: string,
    projectId: string,
    cycleId: string,
    analytic_type: string = "points"
  ): Promise<TCycleDistribution | TCycleEstimateDistribution> {
    return this.get(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/cycles/${cycleId}/analytics?type=${analytic_type}`
    )
      .then(
        (res): TCycleDistribution | TCycleEstimateDistribution =>
          res?.data as TCycleDistribution | TCycleEstimateDistribution
      )
      .catch((err: ApiError) => {
        throw err?.response?.data;
      });
  }

  async workspaceActiveCyclesProgress(
    workspaceSlug: string,
    projectId: string,
    cycleId: string
  ): Promise<TProgressSnapshot> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/cycles/${cycleId}/progress/`)
      .then((res): TProgressSnapshot => res?.data as TProgressSnapshot)
      .catch((err: ApiError) => {
        throw err?.response?.data;
      });
  }

  async workspaceActiveCyclesProgressPro(
    workspaceSlug: string,
    projectId: string,
    cycleId: string
  ): Promise<TProgressSnapshot> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/cycles/${cycleId}/cycle-progress/`)
      .then((res): TProgressSnapshot => res?.data as TProgressSnapshot)
      .catch((err: ApiError) => {
        throw err?.response?.data;
      });
  }

  async workspaceActiveCycles(
    workspaceSlug: string,
    cursor: string,
    per_page: number
  ): Promise<IWorkspaceActiveCyclesResponse> {
    return this.get(`/api/workspaces/${workspaceSlug}/active-cycles/`, {
      params: {
        per_page,
        cursor,
      },
    })
      .then((res): IWorkspaceActiveCyclesResponse => res?.data as IWorkspaceActiveCyclesResponse)
      .catch((err: ApiError) => {
        throw err?.response?.data;
      });
  }

  async getWorkspaceCycles(workspaceSlug: string): Promise<ICycle[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/cycles/`)
      .then((response): ICycle[] => response?.data as ICycle[])
      .catch((error: ApiError) => {
        throw error?.response?.data;
      });
  }

  async createCycle(
    workspaceSlug: string,
    projectId: string,
    data: Partial<ICycle> | Record<string, unknown>
  ): Promise<ICycle> {
    return this.post(`/api/workspaces/${workspaceSlug}/projects/${projectId}/cycles/`, data as Record<string, unknown>)
      .then((response): ICycle => response?.data as ICycle)
      .catch((error: ApiError) => {
        throw error?.response?.data;
      });
  }

  async getCyclesWithParams(workspaceSlug: string, projectId: string, cycleType?: "current"): Promise<ICycle[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/cycles/`, {
      params: {
        cycle_view: cycleType,
      },
    })
      .then((response): ICycle[] => response?.data as ICycle[])
      .catch((error: ApiError) => {
        throw error?.response?.data;
      });
  }

  async getCycleDetails(workspaceSlug: string, projectId: string, cycleId: string): Promise<ICycle> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/cycles/${cycleId}/`)
      .then((res): ICycle => res?.data as ICycle)
      .catch((err: ApiError) => {
        throw err?.response?.data;
      });
  }

  async getCycleIssues(
    workspaceSlug: string,
    projectId: string,
    cycleId: string,
    queries?: Record<string, unknown>,
    config = {}
  ): Promise<TIssuesResponse> {
    return this.get(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/cycles/${cycleId}/cycle-issues/`,
      {
        params: queries ?? {},
      },
      config
    )
      .then((response): TIssuesResponse => response?.data as TIssuesResponse)
      .catch((error: ApiError) => {
        throw error?.response?.data;
      });
  }

  async patchCycle(workspaceSlug: string, projectId: string, cycleId: string, data: Partial<ICycle>): Promise<ICycle> {
    return this.patch(`/api/workspaces/${workspaceSlug}/projects/${projectId}/cycles/${cycleId}/`, data)
      .then((response): ICycle => response?.data as ICycle)
      .catch((error: ApiError) => {
        throw error?.response?.data;
      });
  }

  async deleteCycle(workspaceSlug: string, projectId: string, cycleId: string): Promise<void> {
    return this.delete(`/api/workspaces/${workspaceSlug}/projects/${projectId}/cycles/${cycleId}/`)
      .then((): void => undefined)
      .catch((error: ApiError) => {
        throw error?.response?.data;
      });
  }

  async cycleDateCheck(
    workspaceSlug: string,
    projectId: string,
    data: CycleDateCheckData
  ): Promise<Record<string, unknown>> {
    return this.post(`/api/workspaces/${workspaceSlug}/projects/${projectId}/cycles/date-check/`, data)
      .then((response): Record<string, unknown> => response?.data as Record<string, unknown>)
      .catch((error: ApiError) => {
        throw error?.response?.data;
      });
  }

  async addCycleToFavorites(
    workspaceSlug: string,
    projectId: string,
    data: {
      cycle: string;
    }
  ): Promise<Record<string, unknown>> {
    return this.post(`/api/workspaces/${workspaceSlug}/projects/${projectId}/user-favorite-cycles/`, data)
      .then((response): Record<string, unknown> => response?.data as Record<string, unknown>)
      .catch((error: ApiError) => {
        throw error?.response?.data;
      });
  }

  async transferIssues(
    workspaceSlug: string,
    projectId: string,
    cycleId: string,
    data: {
      new_cycle_id: string;
    }
  ): Promise<TIssue> {
    return this.post(`/api/workspaces/${workspaceSlug}/projects/${projectId}/cycles/${cycleId}/transfer-issues/`, data)
      .then((response): TIssue => response?.data as TIssue)
      .catch((error: ApiError) => {
        throw error?.response?.data;
      });
  }

  async removeCycleFromFavorites(
    workspaceSlug: string,
    projectId: string,
    cycleId: string
  ): Promise<Record<string, unknown>> {
    return this.delete(`/api/workspaces/${workspaceSlug}/projects/${projectId}/user-favorite-cycles/${cycleId}/`)
      .then((response): Record<string, unknown> => response?.data as Record<string, unknown>)
      .catch((error: ApiError) => {
        throw error?.response?.data;
      });
  }
}
