import { observer } from "mobx-react";
import { useEffect, useRef, useState } from "react";
// i18n
import { useTranslation } from "@plane/i18n";
// ui icons
import {
  CycleIcon,
  StatePropertyIcon,
  ModuleIcon,
  MembersPropertyIcon,
  PriorityPropertyIcon,
  StartDatePropertyIcon,
  DueDatePropertyIcon,
  LabelPropertyIcon,
  UserCirclePropertyIcon,
  EstimatePropertyIcon,
  ParentPropertyIcon,
  GithubIcon,
} from "@plane/propel/icons";
import { cn, getDate, renderFormattedPayloadDate, shouldHighlightIssueDueDate } from "@plane/utils";
// components
import { DateDropdown } from "@/components/dropdowns/date";
import { EstimateDropdown } from "@/components/dropdowns/estimate";
import { ButtonAvatars } from "@/components/dropdowns/member/avatar";
import { MemberDropdown } from "@/components/dropdowns/member/dropdown";
import { PriorityDropdown } from "@/components/dropdowns/priority";
import { StateDropdown } from "@/components/dropdowns/state/dropdown";
import { SidebarPropertyListItem } from "@/components/common/layout/sidebar/property-list-item";
// helpers
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useMember } from "@/hooks/store/use-member";
import { useProject } from "@/hooks/store/use-project";
import { useProjectState } from "@/hooks/store/use-project-state";
// plane web components
import { WorkItemAdditionalSidebarProperties } from "@/plane-web/components/issues/issue-details/additional-properties";
import { IssueParentSelectRoot } from "@/plane-web/components/issues/issue-details/parent-select-root";
import { DateAlert } from "@/plane-web/components/issues/issue-details/sidebar/date-alert";
import { TransferHopInfo } from "@/plane-web/components/issues/issue-details/sidebar/transfer-hop-info";
import { IssueWorklogProperty } from "@/plane-web/components/issues/worklog/property";
import type { TIssueOperations } from "../issue-detail";
import { IssueCycleSelect } from "../issue-detail/cycle-select";
import { IssueLabel } from "../issue-detail/label";
import { IssueModuleSelect } from "../issue-detail/module-select";
import { UserIcon } from "lucide-react";

interface IPeekOverviewProperties {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  disabled: boolean;
  issueOperations: TIssueOperations;
}

export const PeekOverviewProperties = observer(function PeekOverviewProperties(props: IPeekOverviewProperties) {
  const { workspaceSlug, projectId, issueId, issueOperations, disabled } = props;
  const { t } = useTranslation();
  // store hooks
  const { getProjectById } = useProject();
  const {
    issue: { getIssueById },
  } = useIssueDetail();
  const { getStateById } = useProjectState();
  const { getUserDetails } = useMember();
  // derived values (issue may be undefined; hooks must run unconditionally)
  const issue = getIssueById(issueId);

  // Local editable fields to avoid updating on every keystroke
  const [githubLink, setGithubLink] = useState(issue?.github_link ?? "");
  const [agent, setAgent] = useState(issue?.agent ?? "");

  // Refs always hold latest values so unmount cleanup can save without stale closures
  const refGithubLink = useRef(githubLink);
  const refAgent = useRef(agent);
  const refIssue = useRef(issue);
  refGithubLink.current = githubLink;
  refAgent.current = agent;
  refIssue.current = issue;

  useEffect(() => {
    setGithubLink(issue?.github_link ?? "");
  }, [issue?.github_link]);

  useEffect(() => {
    setAgent(issue?.agent ?? "");
  }, [issue?.agent]);

  // Save pending edits when the sidebar unmounts (e.g. user closes the peek without blur)
  useEffect(() => {
    return () => {
      const currentIssue = refIssue.current;
      const latestGithub = refGithubLink.current.trim() || null;
      if (latestGithub !== (currentIssue?.github_link ?? null)) {
        void issueOperations.update(workspaceSlug, projectId, issueId, {
          github_link: latestGithub,
        });
      }
      const latestAgent = refAgent.current.trim() || null;
      if (latestAgent !== (currentIssue?.agent ?? null)) {
        void issueOperations.update(workspaceSlug, projectId, issueId, {
          agent: latestAgent,
        });
      }
    };
  }, [workspaceSlug, projectId, issueId, issueOperations]);

  if (!issue) return <></>;

  const createdByDetails = getUserDetails(issue?.created_by);
  const projectDetails = getProjectById(issue.project_id);
  const isEstimateEnabled = projectDetails?.estimate;
  const stateDetails = getStateById(issue.state_id);
  const minDate = getDate(issue.start_date);
  minDate?.setDate(minDate.getDate());

  const maxDate = getDate(issue.target_date);
  maxDate?.setDate(maxDate.getDate());

  return (
    <div>
      <h6 className="text-body-xs-medium">{t("common.properties")}</h6>
      <div className={`w-full space-y-3 mt-3 ${disabled ? "opacity-60" : ""}`}>
        <SidebarPropertyListItem icon={StatePropertyIcon} label={t("common.state")}>
          <StateDropdown
            value={issue?.state_id}
            onChange={(val) => void issueOperations.update(workspaceSlug, projectId, issueId, { state_id: val })}
            projectId={projectId}
            disabled={disabled}
            buttonVariant="transparent-with-text"
            className="w-full grow group"
            buttonContainerClassName="w-full text-left h-7.5"
            buttonClassName={`text-body-xs-medium ${issue?.state_id ? "" : "text-placeholder"}`}
            dropdownArrow
            dropdownArrowClassName="h-3.5 w-3.5 hidden group-hover:inline"
          />
        </SidebarPropertyListItem>

        <SidebarPropertyListItem icon={MembersPropertyIcon} label={t("common.assignees")}>
          <MemberDropdown
            value={issue?.assignee_ids ?? undefined}
            onChange={(val) => void issueOperations.update(workspaceSlug, projectId, issueId, { assignee_ids: val })}
            disabled={disabled}
            projectId={projectId}
            placeholder={t("issue.add.assignee")}
            multiple
            buttonVariant={issue?.assignee_ids?.length > 1 ? "transparent-without-text" : "transparent-with-text"}
            className="w-full grow group"
            buttonContainerClassName="w-full text-left h-7.5"
            buttonClassName={`text-body-xs-medium justify-between ${issue?.assignee_ids?.length > 0 ? "" : "text-placeholder"}`}
            hideIcon={issue.assignee_ids?.length === 0}
            dropdownArrow
            dropdownArrowClassName="h-3.5 w-3.5 hidden group-hover:inline"
          />
        </SidebarPropertyListItem>

        <SidebarPropertyListItem icon={PriorityPropertyIcon} label={t("common.priority")}>
          <PriorityDropdown
            value={issue?.priority}
            onChange={(val) => void issueOperations.update(workspaceSlug, projectId, issueId, { priority: val })}
            disabled={disabled}
            buttonVariant="transparent-with-text"
            className="w-full h-7.5 grow rounded-sm"
            buttonContainerClassName="w-full text-left h-7.5"
            buttonClassName={`text-body-xs-medium whitespace-nowrap [&_svg]:size-3.5 ${!issue?.priority || issue?.priority === "none" ? "text-placeholder" : ""}`}
          />
        </SidebarPropertyListItem>

        {createdByDetails && (
          <SidebarPropertyListItem
            icon={UserCirclePropertyIcon}
            label={t("common.created_by")}
            childrenClassName="px-2"
          >
            <ButtonAvatars
              showTooltip
              userIds={createdByDetails?.display_name.includes("-intake") ? null : createdByDetails?.id}
            />
            <span className="grow truncate text-body-xs-medium text-secondary leading-5">
              {createdByDetails?.display_name.includes("-intake") ? "Plane" : createdByDetails?.display_name}
            </span>
          </SidebarPropertyListItem>
        )}

        <SidebarPropertyListItem icon={StartDatePropertyIcon} label={t("common.order_by.start_date")}>
          <DateDropdown
            value={issue.start_date}
            onChange={(val) =>
              void issueOperations.update(workspaceSlug, projectId, issueId, {
                start_date: val ? renderFormattedPayloadDate(val) : null,
              })
            }
            placeholder={t("issue.add.start_date")}
            buttonVariant="transparent-with-text"
            maxDate={maxDate ?? undefined}
            disabled={disabled}
            className="w-full grow group"
            buttonContainerClassName="w-full text-left h-7.5"
            buttonClassName={`text-body-xs-medium ${issue?.start_date ? "" : "text-placeholder"}`}
            hideIcon
            clearIconClassName="h-3 w-3 hidden group-hover:inline"
          />
        </SidebarPropertyListItem>

        <SidebarPropertyListItem icon={DueDatePropertyIcon} label={t("common.order_by.due_date")}>
          <div className="flex items-center gap-2 w-full">
            <DateDropdown
              value={issue.target_date}
              onChange={(val) =>
                void issueOperations.update(workspaceSlug, projectId, issueId, {
                  target_date: val ? renderFormattedPayloadDate(val) : null,
                })
              }
              placeholder={t("issue.add.due_date")}
              buttonVariant="transparent-with-text"
              minDate={minDate ?? undefined}
              disabled={disabled}
              className="w-full grow group"
              buttonContainerClassName="w-full text-left h-7.5"
              buttonClassName={cn("text-body-xs-medium", {
                "text-placeholder": !issue.target_date,
                "text-danger-primary": shouldHighlightIssueDueDate(issue.target_date, stateDetails?.group),
              })}
              hideIcon
              clearIconClassName="h-3 w-3 hidden group-hover:inline text-primary"
            />
            {issue.target_date && <DateAlert date={issue.target_date} workItem={issue} projectId={projectId} />}
          </div>
        </SidebarPropertyListItem>

        {isEstimateEnabled && (
          <SidebarPropertyListItem icon={EstimatePropertyIcon} label={t("common.estimate")}>
            <EstimateDropdown
              value={issue.estimate_point ?? undefined}
              onChange={(val) =>
                void issueOperations.update(workspaceSlug, projectId, issueId, { estimate_point: val })
              }
              projectId={projectId}
              disabled={disabled}
              buttonVariant="transparent-with-text"
              className="w-full grow group"
              buttonContainerClassName="w-full text-left h-7.5"
              buttonClassName={`text-body-xs-medium ${issue?.estimate_point !== undefined ? "" : "text-placeholder"}`}
              placeholder="None"
              hideIcon
              dropdownArrow
              dropdownArrowClassName="h-3.5 w-3.5 hidden group-hover:inline"
            />
          </SidebarPropertyListItem>
        )}

        {projectDetails?.module_view && (
          <SidebarPropertyListItem icon={ModuleIcon} label={t("common.modules")}>
            <IssueModuleSelect
              className="w-full grow"
              workspaceSlug={workspaceSlug}
              projectId={projectId}
              issueId={issueId}
              issueOperations={issueOperations}
              disabled={disabled}
            />
          </SidebarPropertyListItem>
        )}

        {projectDetails?.cycle_view && (
          <SidebarPropertyListItem
            icon={CycleIcon}
            label={t("common.cycle")}
            appendElement={<TransferHopInfo workItem={issue} />}
          >
            <IssueCycleSelect
              className="w-full grow h-7.5"
              workspaceSlug={workspaceSlug}
              projectId={projectId}
              issueId={issueId}
              issueOperations={issueOperations}
              disabled={disabled}
            />
          </SidebarPropertyListItem>
        )}

        <SidebarPropertyListItem icon={ParentPropertyIcon} label={t("common.parent")}>
          <IssueParentSelectRoot
            className="w-full h-7.5 grow"
            disabled={disabled}
            issueId={issueId}
            issueOperations={issueOperations}
            projectId={projectId}
            workspaceSlug={workspaceSlug}
          />
        </SidebarPropertyListItem>

        <SidebarPropertyListItem icon={LabelPropertyIcon} label={t("common.labels")}>
          <IssueLabel workspaceSlug={workspaceSlug} projectId={projectId} issueId={issueId} disabled={disabled} />
        </SidebarPropertyListItem>
        {/* GitHub Link */}
        <SidebarPropertyListItem icon={GithubIcon} label={"GitHub"}>
          <input
            type="text"
            className="w-full px-3 py-2 bg-transparent text-body-xs-medium border-none outline-none focus:ring-0 focus:border-0 disabled:cursor-not-allowed disabled:opacity-60"
            placeholder={"Add GitHub link (e.g. https://github.com/oqva/default-repo.git)"}
            disabled={disabled}
            value={githubLink}
            onChange={(e) => setGithubLink(e.target.value)}
            onBlur={() => {
              const normalized = githubLink.trim() || null;
              if (normalized !== (issue.github_link ?? null)) {
                void issueOperations.update(workspaceSlug, projectId, issueId, {
                  github_link: normalized,
                });
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                (e.target as HTMLInputElement).blur();
              }
            }}
          />
        </SidebarPropertyListItem>
        {/* Agent */}
        <SidebarPropertyListItem icon={UserIcon} label={"Agent"}>
          <input
            type="text"
            className="w-full px-3 py-2 bg-transparent text-body-xs-medium border-none outline-none focus:ring-0 focus:border-0 disabled:cursor-not-allowed disabled:opacity-60"
            placeholder={"Add Agent (e.g. claude)"}
            disabled={disabled}
            value={agent}
            onChange={(e) => setAgent(e.target.value)}
            onBlur={() => {
              const normalized = agent.trim() || null;
              if (normalized !== (issue.agent ?? null)) {
                void issueOperations.update(workspaceSlug, projectId, issueId, {
                  agent: normalized,
                });
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                (e.target as HTMLInputElement).blur();
              }
            }}
          />
        </SidebarPropertyListItem>
        <IssueWorklogProperty
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          issueId={issueId}
          disabled={disabled}
        />

        <WorkItemAdditionalSidebarProperties
          workItemId={issue.id}
          workItemTypeId={issue.type_id}
          projectId={projectId}
          workspaceSlug={workspaceSlug}
          isEditable={!disabled}
          isPeekView
        />
      </div>
    </div>
  );
});
