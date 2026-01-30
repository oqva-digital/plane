import { useMemo } from "react";
import { observer } from "mobx-react";
import { FileText } from "lucide-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import type { TIssueServiceType } from "@plane/types";
import { CollapsibleButton } from "@plane/ui";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
// local imports
import { IssueLinksActionButton } from "./quick-action-button";

type Props = {
  isOpen: boolean;
  issueId: string;
  disabled: boolean;
  issueServiceType: TIssueServiceType;
};

export const IssueLinksCollapsibleTitle = observer(function IssueLinksCollapsibleTitle(props: Props) {
  const { isOpen, issueId, disabled, issueServiceType } = props;
  // translation
  const { t } = useTranslation();
  // store hooks
  const {
    issue: { getIssueById },
    toggleAddPageModal,
  } = useIssueDetail(issueServiceType);

  // derived values
  const issue = getIssueById(issueId);

  const linksCount = issue?.link_count ?? 0;

  // indicator element
  const indicatorElement = useMemo(
    () => (
      <span className="flex items-center justify-center ">
        <p className="text-14 text-tertiary !leading-3">{linksCount}</p>
      </span>
    ),
    [linksCount]
  );

  return (
    <CollapsibleButton
      isOpen={isOpen}
      title={t("common.links")}
      indicatorElement={indicatorElement}
      actionItemElement={
        !disabled && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="grid h-7 w-7 place-items-center rounded-sm p-1 outline-none duration-300 hover:bg-surface-2"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleAddPageModal(true);
              }}
              title="Add page"
            >
              <FileText className="h-4 w-4" />
            </button>
            <IssueLinksActionButton issueServiceType={issueServiceType} disabled={disabled} />
          </div>
        )
      }
    />
  );
});
