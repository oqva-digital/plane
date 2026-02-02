import type { TPlacement } from "@plane/propel/utils/placement";
import type { TIssue } from "@plane/types";
import type { TSelectionHelper } from "@/hooks/use-multiple-select";

export interface IQuickActionProps {
  parentRef: React.RefObject<HTMLElement>;
  issue: TIssue;
  handleDelete: () => Promise<void>;
  handleUpdate?: (data: TIssue) => Promise<void>;
  handleRemoveFromView?: () => Promise<void>;
  handleArchive?: () => Promise<void>;
  handleRestore?: () => Promise<void>;
  handleMoveToIssues?: () => Promise<void>;
  customActionButton?: React.ReactElement;
  portalElement?: HTMLDivElement | null;
  readOnly?: boolean;
  placements?: TPlacement;
  selectionHelpers?: TSelectionHelper;
  groupId?: string;
}

export type TRenderQuickActions = (props: {
  issue: TIssue;
  parentRef: React.RefObject<HTMLElement>;
  customActionButton?: React.ReactElement;
  placement?: TPlacement;
  portalElement?: HTMLDivElement | null;
  selectionHelpers?: TSelectionHelper;
  groupId?: string;
}) => React.ReactNode;
