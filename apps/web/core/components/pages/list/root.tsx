import { useEffect, useState } from "react";
import { observer } from "mobx-react";
// types
import type { TPageNavigationTabs } from "@plane/types";
// components
import { ListLayout } from "@/components/core/list";
// plane web hooks
import type { EPageStoreType } from "@/plane-web/hooks/store";
import { usePageStore } from "@/plane-web/hooks/store";
// local imports
import { PageListBlock } from "./block";
import { PagesBulkActionsBar } from "./bulk-actions-bar";

type TPagesListRoot = {
  pageType: TPageNavigationTabs;
  storeType: EPageStoreType;
};

export const PagesListRoot = observer(function PagesListRoot(props: TPagesListRoot) {
  const { pageType, storeType } = props;
  // store hooks
  const { getCurrentProjectFilteredPageIdsByTab } = usePageStore(storeType);
  const filteredPageIds = getCurrentProjectFilteredPageIdsByTab(pageType);

  const [selectedPageIds, setSelectedPageIds] = useState<string[]>([]);

  // Ensure selection only contains ids that are currently visible
  useEffect(() => {
    if (!filteredPageIds) {
      setSelectedPageIds([]);
      return;
    }
    setSelectedPageIds((prev) => prev.filter((id) => filteredPageIds.includes(id)));
  }, [filteredPageIds]);

  const handleToggleSelection = (pageId: string) => {
    setSelectedPageIds((prev) => (prev.includes(pageId) ? prev.filter((id) => id !== pageId) : [...prev, pageId]));
  };

  const handleClearSelection = () => {
    setSelectedPageIds([]);
  };

  if (!filteredPageIds) return <></>;
  return (
    <ListLayout>
      <PagesBulkActionsBar
        pageType={pageType}
        storeType={storeType}
        selectedPageIds={selectedPageIds}
        onClearSelection={handleClearSelection}
      />
      {filteredPageIds.map((pageId) => (
        <PageListBlock
          key={pageId}
          pageId={pageId}
          storeType={storeType}
          isSelected={selectedPageIds.includes(pageId)}
          onToggleSelection={handleToggleSelection}
        />
      ))}
    </ListLayout>
  );
});
