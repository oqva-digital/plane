import { useEffect, useState } from "react";
import { observer } from "mobx-react";
// plane imports
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { CustomSelect } from "@plane/ui";
// helpers
import { PreferencesSection } from "@/components/preferences/section";
import {
  getBreakdownMaxTasks,
  setBreakdownMaxTasks,
  DEFAULT_MAX_TASKS_VALUE,
  MIN_MAX_TASKS_VALUE,
  MAX_MAX_TASKS_VALUE,
} from "@/helpers/breakdown-max-tasks";

// Generate options from 5 to 50
const MAX_TASKS_OPTIONS = Array.from({ length: MAX_MAX_TASKS_VALUE - MIN_MAX_TASKS_VALUE + 1 }, (_, i) => {
  const value = MIN_MAX_TASKS_VALUE + i;
  return {
    value,
    label: value.toString(),
  };
});

export const BreakdownMaxTasksPreference = observer(function BreakdownMaxTasksPreference(props: {
  option: { title: string; description: string };
}) {
  const [maxTasks, setMaxTasks] = useState<number>(DEFAULT_MAX_TASKS_VALUE);

  // Load from localStorage on mount
  useEffect(() => {
    setMaxTasks(getBreakdownMaxTasks());
  }, []);

  const handleMaxTasksChange = (val: number) => {
    try {
      setBreakdownMaxTasks(val);
      setMaxTasks(val);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Success",
        message: "Maximum tasks setting updated successfully",
      });
    } catch (_error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Update failed",
        message: "Please try again later.",
      });
    }
  };

  return (
    <PreferencesSection
      title={props.option.title}
      description={props.option.description}
      control={
        <div className="">
          <CustomSelect
            value={maxTasks}
            label={maxTasks.toString()}
            onChange={handleMaxTasksChange}
            input
            maxHeight="lg"
          >
            <>
              {MAX_TASKS_OPTIONS.map((option) => (
                <CustomSelect.Option key={option.value} value={option.value}>
                  {option.label}
                </CustomSelect.Option>
              ))}
            </>
          </CustomSelect>
        </div>
      }
    />
  );
});
