import { observer } from "mobx-react";
import { CloseIcon } from "@plane/propel/icons";

type Props = {
  handleRemove: (val: string) => void;
  values: string[];
  editable: boolean | undefined;
  getLabel?: (val: string) => string;
};

export const AppliedValuesFilters = observer(function AppliedValuesFilters(props: Props) {
  const { handleRemove, values, editable, getLabel = (v) => v } = props;

  return (
    <>
      {values.map((val) => (
        <div key={val} className="flex items-center gap-1 rounded-sm bg-layer-1 py-1 px-1.5 text-11">
          <span className="normal-case">{getLabel(val)}</span>
          {editable && (
            <button
              type="button"
              className="grid place-items-center text-tertiary hover:text-secondary"
              onClick={() => handleRemove(val)}
            >
              <CloseIcon height={10} width={10} strokeWidth={2} />
            </button>
          )}
        </div>
      ))}
    </>
  );
});
