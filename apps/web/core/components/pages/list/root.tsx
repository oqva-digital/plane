import { observer } from "mobx-react";
// types
import type { TPageNavigationTabs } from "@plane/types";
// components
import { ListLayout } from "@/components/core/list";
// hooks
import type { TSelectionHelper } from "@/hooks/use-multiple-select";
// plane web hooks
import type { EPageStoreType } from "@/plane-web/hooks/store";
import { usePageStore } from "@/plane-web/hooks/store";
// local imports
import { PageListBlock } from "./block";

type TPagesListRoot = {
  pageType: TPageNavigationTabs;
  storeType: EPageStoreType;
  selectionHelpers?: TSelectionHelper;
};

export const PagesListRoot = observer(function PagesListRoot(props: TPagesListRoot) {
  const { pageType, storeType, selectionHelpers } = props;
  // store hooks
  const { getCurrentProjectFilteredPageIdsByTab } = usePageStore(storeType);
  const filteredPageIds = getCurrentProjectFilteredPageIdsByTab(pageType);

  if (!filteredPageIds) return <></>;
  return (
    <ListLayout>
      {filteredPageIds.map((pageId) => (
        <PageListBlock
          key={pageId}
          pageId={pageId}
          storeType={storeType}
          selectionHelpers={selectionHelpers}
          groupId="default"
        />
      ))}
    </ListLayout>
  );
});
