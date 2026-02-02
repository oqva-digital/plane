import React from "react";
import { observer } from "mobx-react";
import { FileText } from "lucide-react";
import type { TIssueServiceType } from "@plane/types";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { IssueDetailWidgetButton } from "../widget-button";

type Props = {
  customButton?: React.ReactNode;
  disabled?: boolean;
  issueServiceType: TIssueServiceType;
};

export const IssueAddPageActionButton = observer(function IssueAddPageActionButton(props: Props) {
  const { customButton, disabled = false, issueServiceType } = props;
  const { toggleAddPageModal } = useIssueDetail(issueServiceType);

  const handleOnClick = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    e.preventDefault();
    e.stopPropagation();
    toggleAddPageModal(true);
  };

  return (
    <button type="button" onClick={handleOnClick} disabled={disabled}>
      {customButton ?? (
        <IssueDetailWidgetButton
          title="Add page"
          icon={<FileText className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={2} />}
          disabled={disabled}
        />
      )}
    </button>
  );
});
