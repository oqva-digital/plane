import type {
  ITaskBreakdownConfirmRequest,
  ITaskBreakdownConfirmResponse,
  ITaskBreakdownExpandRequest,
  ITaskBreakdownRequest,
  ITaskBreakdownResponse,
} from "@/types/breakdown";
import type { AxiosError } from "axios";
// services
import { APIService } from "@/services/api.service";

/**
 * Service responsible for talking to the external Task Master breakdown API.
 * This service is frontend-specific and should not be in shared packages.
 */
export class TaskBreakdownService extends APIService {
  constructor() {
    // In development, use proxy (empty baseURL for relative paths)
    // In production, use the full external API URL from env (e.g., https://plane.mush.so/breakdown/api)
    const isDevelopment = import.meta.env.DEV;
    const breakdownApiUrl = isDevelopment ? "" : process.env.VITE_BREAKDOWN_API_URL || "";
    super(breakdownApiUrl);
  }

  private getApiPath(path: string): string {
    // In development, prepend /breakdown/api for proxy
    // In production, use path as-is (baseURL already includes /breakdown/api)
    const isDevelopment = import.meta.env.DEV;
    return isDevelopment ? `/breakdown/api${path}` : path;
  }

  /**
   * Request AI breakdown suggestions for a parent work item (PRD).
   * Wraps POST /api/breakdown.
   */
  async generateBreakdown(payload: ITaskBreakdownRequest, apiKey: string): Promise<ITaskBreakdownResponse> {
    return this.post(this.getApiPath("/breakdown"), payload, {
      headers: {
        "X-Breakdown-API-Key": apiKey,
      },
    })
      .then((res) => res?.data as ITaskBreakdownResponse)
      .catch((error: unknown) => {
        const axiosError = error as AxiosError;
        throw axiosError?.response?.data ?? error;
      });
  }

  /**
   * Request AI expansion suggestions for a child work item (subtask).
   * Wraps POST /api/expand.
   */
  async generateExpand(payload: ITaskBreakdownExpandRequest, apiKey: string): Promise<ITaskBreakdownResponse> {
    return this.post(this.getApiPath("/expand"), payload, {
      headers: {
        "X-Breakdown-API-Key": apiKey,
      },
    })
      .then((res) => res?.data as ITaskBreakdownResponse)
      .catch((error: unknown) => {
        const axiosError = error as AxiosError;
        throw axiosError?.response?.data ?? error;
      });
  }

  /**
   * Confirm and create tasks from breakdown suggestions.
   * Wraps POST /api/breakdown/confirm.
   */
  async confirmBreakdown(
    payload: ITaskBreakdownConfirmRequest,
    apiKey: string
  ): Promise<ITaskBreakdownConfirmResponse> {
    return this.post(this.getApiPath("/confirm"), payload, {
      headers: {
        "X-Breakdown-API-Key": apiKey,
      },
    })
      .then((res) => res?.data as ITaskBreakdownConfirmResponse)
      .catch((error: unknown) => {
        const axiosError = error as AxiosError;
        throw axiosError?.response?.data ?? error;
      });
  }
}
