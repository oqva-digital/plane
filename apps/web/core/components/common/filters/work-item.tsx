import { useMemo, useState } from "react";
import { sortBy } from "lodash-es";
import { observer } from "mobx-react";
// components
import { FilterHeader, FilterOption } from "@/components/issues/issue-layouts/filters";

type WorkItemOption = { id: string; name: string };

type Props = {
  appliedFilters: string[] | null;
  handleUpdate: (val: string) => void;
  searchQuery: string;
  workItems: WorkItemOption[];
};

export const FilterWorkItem = observer(function FilterWorkItem(props: Props) {
  const { appliedFilters, handleUpdate, searchQuery, workItems } = props;
  const [itemsToRender, setItemsToRender] = useState(5);
  const [previewEnabled, setPreviewEnabled] = useState(true);

  const appliedFiltersCount = appliedFilters?.length ?? 0;

  const sortedOptions = useMemo(() => {
    const filtered = workItems.filter((item) => item.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return sortBy(filtered, [(item) => !(appliedFilters ?? []).includes(item.id), (item) => item.name.toLowerCase()]);
  }, [workItems, searchQuery, appliedFilters]);

  const handleViewToggle = () => {
    if (itemsToRender === sortedOptions.length) setItemsToRender(5);
    else setItemsToRender(sortedOptions.length);
  };

  return (
    <>
      <FilterHeader
        title={`Work item${appliedFiltersCount > 0 ? ` (${appliedFiltersCount})` : ""}`}
        isPreviewEnabled={previewEnabled}
        handleIsPreviewEnabled={() => setPreviewEnabled(!previewEnabled)}
      />
      {previewEnabled && (
        <div>
          {sortedOptions.length > 0 ? (
            <>
              {sortedOptions.slice(0, itemsToRender).map((item) => (
                <FilterOption
                  key={`work-item-${item.id}`}
                  isChecked={appliedFilters?.includes(item.id) ?? false}
                  onClick={() => handleUpdate(item.id)}
                  title={item.name}
                />
              ))}
              {sortedOptions.length > 5 && (
                <button
                  type="button"
                  className="text-caption-sm-medium text-accent-primary hover:underline"
                  onClick={handleViewToggle}
                >
                  {itemsToRender === sortedOptions.length ? "Show less" : "Show more"}
                </button>
              )}
            </>
          ) : (
            <div className="text-caption-sm-regular text-tertiary px-1.5 py-1">No work items linked to pages yet.</div>
          )}
        </div>
      )}
    </>
  );
});
