import { useRef } from "react";
import { observer } from "mobx-react";
import { Logo } from "@plane/propel/emoji-icon-picker";
import { PageIcon } from "@plane/propel/icons";
// plane imports
import { getPageName } from "@plane/utils";
// components
import { ListItem } from "@/components/core/list";
import { MultipleSelectEntityAction } from "@/components/core/multiple-select/entity-select-action";
import { BlockItemAction } from "@/components/pages/list/block-item-action";
// hooks
import { usePlatformOS } from "@/hooks/use-platform-os";
import type { TSelectionHelper } from "@/hooks/use-multiple-select";
// plane web hooks
import type { EPageStoreType } from "@/plane-web/hooks/store";
import { usePage } from "@/plane-web/hooks/store";

type TPageListBlock = {
  pageId: string;
  storeType: EPageStoreType;
  selectionHelpers?: TSelectionHelper;
  groupId?: string;
};

export const PageListBlock = observer(function PageListBlock(props: TPageListBlock) {
  const { pageId, storeType, selectionHelpers, groupId = "default" } = props;
  // refs
  const parentRef = useRef(null);
  // hooks
  const page = usePage({
    pageId,
    storeType,
  });
  const { isMobile } = usePlatformOS();
  // handle page check
  if (!page) return null;
  // derived values
  const { name, logo_props, getRedirectionLink } = page;

  return (
    <ListItem
      prependTitleElement={
        <>
          {selectionHelpers && (
            <MultipleSelectEntityAction
              groupId={groupId}
              id={pageId}
              selectionHelpers={selectionHelpers}
            />
          )}
          {logo_props?.in_use ? (
            <Logo logo={logo_props} size={16} type="lucide" />
          ) : (
            <PageIcon className="h-4 w-4 text-tertiary" />
          )}
        </>
      }
      title={getPageName(name)}
      itemLink={getRedirectionLink()}
      actionableItems={<BlockItemAction page={page} parentRef={parentRef} storeType={storeType} />}
      isMobile={isMobile}
      parentRef={parentRef}
    />
  );
});
