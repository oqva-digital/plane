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
  private breakdownApiUrl: string;

  constructor() {
    const breakdownApiUrl = process.env.VITE_BREAKDOWN_API_URL || "";
    super(breakdownApiUrl);
    this.breakdownApiUrl = breakdownApiUrl;
  }

  /**
   * Request AI breakdown suggestions for a parent work item (PRD).
   * Wraps POST /api/breakdown.
   */
  async generateBreakdown(payload: ITaskBreakdownRequest, apiKey: string): Promise<ITaskBreakdownResponse> {
    return this.post(`${this.breakdownApiUrl}/breakdown`, payload, {
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
    return this.post(`${this.breakdownApiUrl}/expand`, payload, {
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
    return this.post(`${this.breakdownApiUrl}/confirm`, payload, {
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
