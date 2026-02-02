import type React from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import { Popover } from "@plane/propel/popover";
import { Tooltip } from "@plane/propel/tooltip";
import { ControlLink } from "@plane/ui";
import { cn, findTotalDaysInRange, generateWorkItemLink } from "@plane/utils";
// components
import { MultipleSelectEntityAction } from "@/components/core/multiple-select";
import { SIDEBAR_WIDTH } from "@/components/gantt-chart/constants";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useIssues } from "@/hooks/store/use-issues";
import { useProject } from "@/hooks/store/use-project";
import { useProjectState } from "@/hooks/store/use-project-state";
import { useLongPress } from "@/hooks/use-long-press";
import { useIssueStoreType } from "@/hooks/use-issue-layout-store";
import useIssuePeekOverviewRedirection from "@/hooks/use-issue-peek-overview-redirection";
import type { TSelectionHelper } from "@/hooks/use-multiple-select";
import { usePlatformOS } from "@/hooks/use-platform-os";
// plane web imports
import { IssueIdentifier } from "@/plane-web/components/issues/issue-details/issue-identifier";
import { IssueStats } from "@/plane-web/components/issues/issue-layouts/issue-stats";
// local imports
import { WorkItemPreviewCard } from "../../preview-card";
import { getBlockViewDetails } from "../utils";
import type { GanttStoreType } from "./base-gantt-root";

type Props = {
  issueId: string;
  isEpic?: boolean;
};

export const IssueGanttBlock = observer(function IssueGanttBlock(props: Props) {
  const { issueId, isEpic } = props;
  // router
  const { workspaceSlug: routerWorkspaceSlug } = useParams();
  const workspaceSlug = routerWorkspaceSlug?.toString();
  // store hooks
  const { getProjectStates } = useProjectState();
  const {
    issue: { getIssueById },
  } = useIssueDetail();
  // hooks
  const { isMobile } = usePlatformOS();
  const { handleRedirection } = useIssuePeekOverviewRedirection(isEpic);

  // derived values
  const issueDetails = getIssueById(issueId);
  const stateDetails =
    issueDetails && getProjectStates(issueDetails?.project_id)?.find((state) => state?.id == issueDetails?.state_id);

  const { blockStyle } = getBlockViewDetails(issueDetails, stateDetails?.color ?? "");

  const handleIssuePeekOverview = () => handleRedirection(workspaceSlug, issueDetails, isMobile);

  const duration = findTotalDaysInRange(issueDetails?.start_date, issueDetails?.target_date) || 0;

  return (
    <Popover delay={100} openOnHover>
      <Popover.Button
        className="w-full"
        render={
          <div
            id={`issue-${issueId}`}
            role="button"
            tabIndex={0}
            className="relative flex h-full w-full cursor-pointer items-center rounded-sm space-between"
            style={blockStyle}
            onClick={handleIssuePeekOverview}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleIssuePeekOverview();
              }
            }}
          >
            <div className="absolute left-0 top-0 h-full w-full bg-surface-1/50 " />
            <div
              className="sticky w-auto overflow-hidden truncate px-2.5 py-1 text-13 text-primary flex-1"
              style={{ left: `${SIDEBAR_WIDTH}px` }}
            >
              {issueDetails?.name}
            </div>
            {isEpic && (
              <IssueStats
                issueId={issueId}
                className="sticky mx-2 font-medium text-primary overflow-hidden truncate w-auto justify-end flex-shrink-0"
                showProgressText={duration >= 2}
              />
            )}
          </div>
        }
      />
      <Popover.Panel side="bottom" align="start">
        <>
          {issueDetails && issueDetails?.project_id && (
            <WorkItemPreviewCard
              projectId={issueDetails.project_id}
              stateDetails={{
                id: issueDetails.state_id ?? undefined,
              }}
              workItem={issueDetails}
            />
          )}
        </>
      </Popover.Panel>
    </Popover>
  );
});

type SidebarBlockProps = Props & {
  selectionHelpers?: TSelectionHelper;
  groupId?: string;
  projectId?: string;
};

// rendering issues on gantt sidebar
export const IssueGanttSidebarBlock = observer(function IssueGanttSidebarBlock(props: SidebarBlockProps) {
  const { issueId, isEpic = false, selectionHelpers, groupId, projectId } = props;
  // router
  const { workspaceSlug: routerWorkspaceSlug } = useParams();
  const workspaceSlug = routerWorkspaceSlug?.toString();
  // store hooks
  const {
    issue: { getIssueById },
  } = useIssueDetail();
  const { isMobile } = usePlatformOS();
  const storeType = useIssueStoreType() as GanttStoreType;
  const { issuesFilter } = useIssues(storeType);
  const { getProjectIdentifierById } = useProject();

  // handlers
  const { handleRedirection } = useIssuePeekOverviewRedirection(isEpic);

  // derived values
  const issueDetails = getIssueById(issueId);
  const projectIdentifier = getProjectIdentifierById(issueDetails?.project_id);

  const handleIssuePeekOverview = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    handleRedirection(workspaceSlug, issueDetails, isMobile);
  };

  const handleLongPressSelect = () => {
    if (!selectionHelpers || !groupId || !issueDetails) return;
    if (projectId && issueDetails.project_id !== projectId) return;
    selectionHelpers.enterSelectionMode();
    selectionHelpers.handleEntitySelection({ entityID: issueDetails.id, groupID: groupId }, false, "force-add");
  };

  const {
    longPressHandledRef,
    onPointerDown: onLongPressPointerDown,
    onPointerUp: onLongPressPointerUp,
    onPointerCancel: onLongPressPointerCancel,
    onPointerLeave: onLongPressPointerLeave,
  } = useLongPress(handleLongPressSelect, { delayMs: 1000 });

  const handleRowClick = (e: React.MouseEvent) => {
    if (longPressHandledRef.current) {
      e.preventDefault();
      e.stopPropagation();
      longPressHandledRef.current = false;
      return;
    }
    handleIssuePeekOverview(e);
  };

  const workItemLink = generateWorkItemLink({
    workspaceSlug,
    projectId: issueDetails?.project_id,
    issueId,
    projectIdentifier,
    sequenceId: issueDetails?.sequence_id,
    isEpic,
  });

  const isSelected = selectionHelpers?.getIsEntitySelected(issueDetails?.id ?? "");

  return (
    <ControlLink
      id={`issue-${issueId}`}
      href={workItemLink}
      onClick={handleRowClick}
      onPointerDown={onLongPressPointerDown}
      onPointerUp={onLongPressPointerUp}
      onPointerCancel={onLongPressPointerCancel}
      onPointerLeave={onLongPressPointerLeave}
      className={cn("line-clamp-1 w-full cursor-pointer text-13 text-primary rounded-sm border border-transparent", {
        "border-2 border-accent-primary": isSelected,
      })}
      disabled={!!issueDetails?.tempId}
    >
      <div className="relative flex h-full w-full cursor-pointer items-center gap-2">
        {selectionHelpers && groupId && !selectionHelpers.isSelectionDisabled && issueDetails && (
          <div
            role="button"
            tabIndex={0}
            className="flex w-5 flex-shrink-0 items-center justify-center"
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
            data-issue-select-checkbox-area
          >
            <MultipleSelectEntityAction id={issueDetails.id} groupId={groupId} selectionHelpers={selectionHelpers} />
          </div>
        )}
        {issueDetails?.project_id && (
          <IssueIdentifier
            issueId={issueDetails.id}
            projectId={issueDetails.project_id}
            size="xs"
            variant="tertiary"
            displayProperties={issuesFilter?.issueFilters?.displayProperties}
          />
        )}
        <Tooltip tooltipContent={issueDetails?.name} isMobile={isMobile}>
          <span className="flex-grow truncate text-13 font-medium">{issueDetails?.name}</span>
        </Tooltip>
      </div>
    </ControlLink>
  );
});
