import { useMemo, useState } from "react";
import { observer } from "mobx-react";
// components
import { FilterHeader, FilterOption } from "@/components/issues/issue-layouts/filters";

type Props = {
  appliedFilters: string[] | null;
  handleUpdate: (val: string) => void;
  searchQuery: string;
  options: string[];
};

export const FilterDocumentType = observer(function FilterDocumentType(props: Props) {
  const { appliedFilters, handleUpdate, searchQuery, options } = props;
  const [previewEnabled, setPreviewEnabled] = useState(true);

  const appliedFiltersCount = appliedFilters?.length ?? 0;

  const filteredOptions = useMemo(() => {
    const list = options ?? [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((opt) => opt.toLowerCase().includes(q));
  }, [options, searchQuery]);

  return (
    <>
      <FilterHeader
        title={`Document type${appliedFiltersCount > 0 ? ` (${appliedFiltersCount})` : ""}`}
        isPreviewEnabled={previewEnabled}
        handleIsPreviewEnabled={() => setPreviewEnabled(!previewEnabled)}
      />
      {previewEnabled && (
        <div>
          {filteredOptions.map((option) => (
            <FilterOption
              key={`document-type-${option}`}
              isChecked={appliedFilters?.includes(option) ?? false}
              onClick={() => handleUpdate(option)}
              title={option}
            />
          ))}
        </div>
      )}
    </>
  );
});
