import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { spawn } from "child_process";

const TASK_MASTER_SCRIPT = (() => {
  try {
    const p = path.join(path.dirname(require.resolve("task-master-ai/package.json")), "dist", "task-master.js");
    if (fs.existsSync(p)) return p;
  } catch {
    // fallback
  }
  return path.join(process.cwd(), "node_modules", "task-master-ai", "dist", "task-master.js");
})();

@Injectable()
export class TaskMasterStorageService {
  constructor(private readonly config: ConfigService) {}

  /**
   * Resolves the base storage path.
   * Priority: env var > ~/.plane-ai-breakdown > ./data
   */
  private getStorageBasePath(): string {
    const envPath = this.config.get<string>("TASK_MASTER_STORAGE_PATH");
    if (envPath) {
      return path.resolve(envPath);
    }

    // Default: ~/.plane-ai-breakdown
    const homeDir = os.homedir();
    const defaultPath = path.join(homeDir, ".plane-ai-breakdown");

    // Fallback: ./data (relative to cwd)
    try {
      if (!fs.existsSync(defaultPath)) {
        fs.mkdirSync(defaultPath, { recursive: true });
      }
      return defaultPath;
    } catch {
      // If can't create in ~, use ./data
      const fallbackPath = path.join(process.cwd(), "data");
      if (!fs.existsSync(fallbackPath)) {
        fs.mkdirSync(fallbackPath, { recursive: true });
      }
      return fallbackPath;
    }
  }

  /**
   * Returns the project directory path.
   * Format: {workspace_slug}-{project_id}
   */
  getProjectDir(workspaceSlug: string, projectId: string): string {
    const base = this.getStorageBasePath();
    const projectKey = `${workspaceSlug}-${projectId}`;
    return path.join(base, projectKey);
  }

  /**
   * Normalizes work_item_id to a valid tag name.
   * Example: "TEST-1" → "prd-TEST-1", "550e8400-e29b-..." → "prd-550e8400-e29b-..."
   */
  getTagName(workItemId: string): string {
    // Sanitize: remove invalid characters, keep only alphanumeric, hyphen, underscore
    const sanitized = workItemId.replace(/[^a-zA-Z0-9_-]/g, "-");
    return `prd-${sanitized}`;
  }

  /**
   * Ensures the project directory exists.
   * Returns the directory path.
   */
  ensureProjectDir(workspaceSlug: string, projectId: string): string {
    const projectDir = this.getProjectDir(workspaceSlug, projectId);
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }
    return projectDir;
  }

  /**
   * Initializes task-master in the project directory if needed.
   * Executes `task-master init -y` only if .taskmaster doesn't exist.
   */
  async initTaskMaster(projectDir: string): Promise<void> {
    const taskmasterDir = path.join(projectDir, ".taskmaster");
    if (fs.existsSync(taskmasterDir)) {
      return; // Already initialized
    }

    return new Promise<void>((resolve, reject) => {
      const proc = spawn(process.execPath, [TASK_MASTER_SCRIPT, "init", "-y"], {
        cwd: projectDir,
        env: process.env,
        stdio: "ignore",
      });

      proc.on("error", reject);
      proc.on("close", (code: number | null) => {
        if (code === 0) resolve();
        else reject(new Error(`Task Master init failed with code ${code}`));
      });
    });
  }
}
