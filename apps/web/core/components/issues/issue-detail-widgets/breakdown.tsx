// plane imports
import type { TIssueServiceType } from "@plane/types";
// local imports
import { BreakdownButton } from "../issue-detail/breakdown-button";

type Props = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  disabled: boolean;
  issueServiceType: TIssueServiceType;
};

// Wrapper component that integrates BreakdownButton into the action buttons list
// The BreakdownButton already handles its own modal state and UI
export const BreakdownActionButton: FC<Props> = function BreakdownActionButton(props: Props) {
  const { workspaceSlug, projectId, issueId, disabled } = props;

  return <BreakdownButton workspaceSlug={workspaceSlug} projectId={projectId} issueId={issueId} disabled={disabled} />;
};
