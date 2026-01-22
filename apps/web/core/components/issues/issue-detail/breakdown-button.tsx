import { useState } from "react";
import { observer } from "mobx-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { AiIcon } from "@plane/propel/icons";
import { IconButton } from "@plane/propel/icon-button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { TaskBreakdownService } from "@/services/breakdown.service";
import type {
  ITaskBreakdownExpandRequest,
  ITaskBreakdownRequest,
  ITaskBreakdownResponse,
  ITaskBreakdownSuggestedTask,
} from "@/types/breakdown";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
// local imports
import { BreakdownModal   } from "./breakdown-modal";
import type {TMockBreakdownTask, TBreakdownConfirmOptions} from "./breakdown-modal";

type Props = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  disabled?: boolean;
};

// Reusable breakdown button component that can be used in different contexts
export const BreakdownButton = observer(function BreakdownButton(props: Props) {
  const { workspaceSlug, projectId, issueId, disabled = false } = props;
  const { t } = useTranslation();

  const [isBreakdownModalOpen, setIsBreakdownModalOpen] = useState(false);
  const [isBreakdownLoading, setIsBreakdownLoading] = useState(false);
  const [isBreakdownSubmitting, setIsBreakdownSubmitting] = useState(false);
  const [breakdownTasks, setBreakdownTasks] = useState<TMockBreakdownTask[]>([]);
  const breakdownService = new TaskBreakdownService();
  const {
    issue: { getIssueById },
  } = useIssueDetail();

  const handleOpenBreakdown = async () => {
    setIsBreakdownLoading(true);
    try {
      const issue = getIssueById(issueId);
      const hasParent = !!issue?.parent_id;
      const apiKey = process.env.VITE_BREAKDOWN_API_KEY || "";

      // MOCK: Create mock data based on whether it's a parent or child
      // const mockTasks: TMockBreakdownTask[] = hasParent
      //   ? [
      //       // Child work item - subtasks
      //       {
      //         id: "temp-1",
      //         title: "Implement user authentication",
      //         description: "Create login and registration functionality with JWT tokens",
      //         selected: true,
      //         priority: "high",
      //         estimated_hours: 8,
      //         dependencies: [],
      //         tags: ["backend", "security"],
      //       },
      //       {
      //         id: "temp-2",
      //         title: "Design database schema",
      //         description: "Create ER diagram and implement database migrations",
      //         selected: true,
      //         priority: "high",
      //         estimated_hours: 6,
      //         dependencies: [],
      //         tags: ["database", "design"],
      //       },
      //       {
      //         id: "temp-3",
      //         title: "Setup CI/CD pipeline",
      //         description: "Configure GitHub Actions for automated testing and deployment",
      //         selected: true,
      //         priority: "medium",
      //         estimated_hours: 4,
      //         dependencies: ["temp-1"],
      //         tags: ["devops", "ci-cd"],
      //       },
      //     ]
      //   : [
      //       // Parent work item - main tasks
      //       {
      //         id: "temp-1",
      //         title: "Setup project infrastructure",
      //         description: "Initialize repository, configure dependencies, and setup development environment",
      //         selected: true,
      //         priority: "high",
      //         estimated_hours: 4,
      //         dependencies: [],
      //         tags: ["setup", "infrastructure"],
      //       },
      //       {
      //         id: "temp-2",
      //         title: "Implement core features",
      //         description: "Develop main application features including user management and data processing",
      //         selected: true,
      //         priority: "high",
      //         estimated_hours: 16,
      //         dependencies: ["temp-1"],
      //         tags: ["feature", "core"],
      //       },
      //       {
      //         id: "temp-3",
      //         title: "Create API endpoints",
      //         description: "Design and implement RESTful API endpoints for frontend integration",
      //         selected: true,
      //         priority: "high",
      //         estimated_hours: 12,
      //         dependencies: ["temp-1"],
      //         tags: ["api", "backend"],
      //       },
      //       {
      //         id: "temp-4",
      //         title: "Build user interface",
      //         description: "Create responsive UI components and implement user interactions",
      //         selected: true,
      //         priority: "medium",
      //         estimated_hours: 20,
      //         dependencies: ["temp-3"],
      //         tags: ["frontend", "ui"],
      //       },
      //       {
      //         id: "temp-5",
      //         title: "Write unit tests",
      //         description: "Create comprehensive test suite for all components and features",
      //         selected: true,
      //         priority: "medium",
      //         estimated_hours: 10,
      //         dependencies: ["temp-2", "temp-3", "temp-4"],
      //         tags: ["testing", "quality"],
      //       },
      //       {
      //         id: "temp-6",
      //         title: "Setup monitoring and logging",
      //         description: "Configure application monitoring, error tracking, and logging systems",
      //         selected: true,
      //         priority: "low",
      //         estimated_hours: 6,
      //         dependencies: ["temp-2"],
      //         tags: ["monitoring", "ops"],
      //       },
      //     ];

      // MOCK: Simulate API delay and return mock data
      // await new Promise((resolve) => setTimeout(resolve, 500));
      // console.log("🔵 MOCK: Opening breakdown modal with tasks:", mockTasks);
      // setBreakdownTasks(mockTasks);
      // setIsBreakdownModalOpen(true);
      // return; // Early return to skip API call

      // API call
      let response: ITaskBreakdownResponse;

      if (hasParent) {
        // Child work item - use expand endpoint
        const payload: ITaskBreakdownExpandRequest = {
          work_item_id: issueId,
          workspace_slug: workspaceSlug,
          project_id: projectId,
          options: {
            max_subtasks: 5,
            include_context_from_parent: false,
          },
        };
        response = await breakdownService.generateExpand(payload, apiKey);
      } else {
        // Parent work item - use breakdown endpoint
        const payload: ITaskBreakdownRequest = {
          work_item_id: issueId,
          workspace_slug: workspaceSlug,
          project_id: projectId,
          options: {
            max_tasks: 10,
            include_estimates: true,
          },
        };
        response = await breakdownService.generateBreakdown(payload, apiKey);
      }

      const mappedTasks: TMockBreakdownTask[] =
        response.suggested_tasks?.map((task: ITaskBreakdownSuggestedTask) => ({
          id: task.temp_id,
          title: task.title,
          description: task.description,
          selected: true,
          priority: task.priority,
          estimated_hours: task.estimated_hours,
          dependencies: task.dependencies,
          tags: task.tags,
        })) ?? [];

      setBreakdownTasks(mappedTasks);
      setIsBreakdownModalOpen(true);
    } catch (_error) {
      setToast({
        title: t("toast.error"),
        type: TOAST_TYPE.ERROR,
        message: t("toast.error_message") || "Failed to generate breakdown suggestions.",
      });
    } finally {
      setIsBreakdownLoading(false);
    }
  };

  const handleConfirmBreakdown = async (tasks: TMockBreakdownTask[], options: TBreakdownConfirmOptions) => {
    setIsBreakdownSubmitting(true);
    try {
      // MOCK: Build the payload structure that would be sent to the API
      // const payload = {
      //   workspace_slug: workspaceSlug,
      //   project_id: projectId,
      //   parent_work_item_id: issueId,
      //   tasks_to_create: tasks
      //     .filter((task) => task.selected)
      //     .map((task) => ({
      //       title: task.title,
      //       description: task.description,
      //       priority: task.priority,
      //       labels: task.tags || [],
      //     })),
      //   options: {
      //     link_to_parent: options.link_to_parent,
      //     set_parent_as_epic: options.set_parent_as_epic,
      //   },
      // };

      // MOCK: Simulate API delay and log the structure
      // await new Promise((resolve) => setTimeout(resolve, 500));
      // console.log("🟢 MOCK: Would send to API /api/breakdown/confirm:");
      // console.log(JSON.stringify(payload, null, 2));
      // console.log("📊 Summary:");
      // console.log(`  - Total tasks selected: ${payload.tasks_to_create.length}`);
      // console.log(`  - Link to parent: ${payload.options.link_to_parent}`);
      // console.log(`  - Set parent as epic: ${payload.options.set_parent_as_epic}`);
      // console.log(`  - Tasks:`, payload.tasks_to_create);

      // MOCK: Show success toast
      // setToast({
      //   type: TOAST_TYPE.SUCCESS,
      //   title: "MOCK: Tasks would be created",
      //   message: `${payload.tasks_to_create.length} task(s) would be created. Check console for payload structure.`,
      // });

      // setIsBreakdownModalOpen(false);
      // return; // Early return to skip API call

      // API call
      const apiKey = process.env.VITE_BREAKDOWN_API_KEY || "";
      const response = await breakdownService.confirmBreakdown(
        {
          workspace_slug: workspaceSlug,
          project_id: projectId,
          parent_work_item_id: issueId,
          tasks_to_create: tasks
            .filter((task) => task.selected)
            .map((task) => ({
              title: task.title,
              description: task.description,
              priority: task.priority,
              labels: task.tags || [],
            })),
          options: {
            link_to_parent: options.link_to_parent,
            set_parent_as_epic: options.set_parent_as_epic,
          },
        },
        apiKey
      );

      // Handle response
      const createdCount = response.created?.length || 0;
      const failedCount = response.failed?.length || 0;

      if (failedCount > 0) {
        // Partial success or total failure
        const failedMessages = response.failed?.map((f) => `Task ${f.index + 1}: ${f.error}`).join("\n") || "";
        setToast({
          type: createdCount > 0 ? TOAST_TYPE.SUCCESS : TOAST_TYPE.ERROR,
          title: createdCount > 0 ? "Partial success" : "Failed to create tasks",
          message:
            createdCount > 0
              ? `${createdCount} task(s) created. ${failedCount} failed:\n${failedMessages}`
              : `All tasks failed:\n${failedMessages}`,
        });
      } else {
        // Full success
        setToast({
          type: TOAST_TYPE.SUCCESS,
          title: "Tasks created successfully",
          message: `${createdCount} task(s) created.`,
        });
      }

      setIsBreakdownModalOpen(false);
    } catch (_error) {
      setToast({
        title: t("toast.error"),
        type: TOAST_TYPE.ERROR,
        message: t("toast.error_message") || "Failed to create tasks.",
      });
    } finally {
      setIsBreakdownSubmitting(false);
    }
  };

  return (
    <>
      <IconButton
        variant="primary"
        size="lg"
        onClick={() => {
          void handleOpenBreakdown();
        }}
        icon={AiIcon}
        loading={isBreakdownLoading}
        disabled={disabled}
        title="AI breakdown"
      />
      <BreakdownModal
        isOpen={isBreakdownModalOpen}
        onClose={() => setIsBreakdownModalOpen(false)}
        onConfirm={handleConfirmBreakdown}
        initialTasks={breakdownTasks}
        isSubmitting={isBreakdownSubmitting}
      />
    </>
  );
});
