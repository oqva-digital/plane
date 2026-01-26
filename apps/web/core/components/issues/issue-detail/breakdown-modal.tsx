import { useState, useEffect } from "react";
import { observer } from "mobx-react";
// plane imports
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Button, EModalWidth, EModalPosition, ModalCore, Checkbox, Loader } from "@plane/ui";
import type { TTaskBreakdownPriority } from "@/types/breakdown";
// local imports
import { BreakdownTaskCard } from "./breakdown-task-card";

export type TMockBreakdownTask = {
  id: string;
  title: string;
  description?: string;
  selected: boolean;
  isNew?: boolean;
  priority?: TTaskBreakdownPriority;
  estimated_hours?: number;
  dependencies?: string[];
  tags?: string[];
};

export type TBreakdownConfirmOptions = {
  link_to_parent: boolean;
  set_parent_as_epic: boolean;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (tasks: TMockBreakdownTask[], options: TBreakdownConfirmOptions) => Promise<void> | void;
  initialTasks?: TMockBreakdownTask[];
  isSubmitting?: boolean;
  isLoading?: boolean;
};

// NOTE: This component currently uses mocked data and should be wired to the real Task Master
// integration once the backend contract is available.
export const BreakdownModal = observer(function BreakdownModal(props: Props) {
  const { isOpen, onClose, onConfirm, initialTasks = [], isSubmitting = false, isLoading = false } = props;
  const [tasks, setTasks] = useState<TMockBreakdownTask[]>(initialTasks);
  const [expandedDependencies, setExpandedDependencies] = useState<Set<string>>(new Set());
  const [linkToParent, setLinkToParent] = useState<boolean>(true);
  const [setParentAsEpic, _setSetParentAsEpic] = useState<boolean>(false);

  // Update tasks when initialTasks changes
  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  const handleClose = () => {
    setTasks(initialTasks);
    onClose();
  };

  const handleToggleSelect = (id: string) => {
    setTasks((prev) => {
      const task = prev.find((t) => t.id === id);
      if (!task) return prev;

      const newSelected = !task.selected;
      const updatedTasks = [...prev];

      // Find the task index
      const taskIndex = updatedTasks.findIndex((t) => t.id === id);
      if (taskIndex === -1) return prev;

      // Toggle the selected task
      updatedTasks[taskIndex] = { ...updatedTasks[taskIndex], selected: newSelected };

      if (newSelected) {
        // When selecting: also select all dependencies recursively
        const selectDependencies = (depIds: string[]) => {
          depIds.forEach((depId) => {
            const depIndex = updatedTasks.findIndex((t) => t.id === depId);
            if (depIndex !== -1 && !updatedTasks[depIndex].selected) {
              updatedTasks[depIndex] = { ...updatedTasks[depIndex], selected: true };
              // Recursively select dependencies of this dependency
              if (updatedTasks[depIndex].dependencies && updatedTasks[depIndex].dependencies.length > 0) {
                selectDependencies(updatedTasks[depIndex].dependencies);
              }
            }
          });
        };

        // Select all dependencies of this task
        if (task.dependencies && task.dependencies.length > 0) {
          selectDependencies(task.dependencies);
        }
      } else {
        // When deselecting: also deselect all tasks that depend on this one recursively
        const deselectDependents = (taskId: string) => {
          updatedTasks.forEach((t, index) => {
            if (t.dependencies && t.dependencies.includes(taskId) && t.selected) {
              updatedTasks[index] = { ...updatedTasks[index], selected: false };
              // Recursively deselect tasks that depend on this one
              deselectDependents(t.id);
            }
          });
        };

        deselectDependents(id);

        // After deselecting, check if dependencies are still needed by other selected tasks
        // and recursively deselect them if not needed
        const checkAndDeselectDependency = (depId: string) => {
          // Check if this dependency is still needed by any other selected task
          const isStillNeeded = updatedTasks.some(
            (t) => t.selected && t.dependencies && t.dependencies.includes(depId) && t.id !== id
          );

          if (!isStillNeeded) {
            const depIndex = updatedTasks.findIndex((t) => t.id === depId);
            if (depIndex !== -1 && updatedTasks[depIndex].selected) {
              updatedTasks[depIndex] = { ...updatedTasks[depIndex], selected: false };
              // Recursively check and deselect dependencies of this dependency
              const depTask = updatedTasks[depIndex];
              if (depTask.dependencies && depTask.dependencies.length > 0) {
                depTask.dependencies.forEach((nestedDepId) => {
                  checkAndDeselectDependency(nestedDepId);
                });
              }
            }
          }
        };

        // Check each dependency of the deselected task
        if (task.dependencies && task.dependencies.length > 0) {
          task.dependencies.forEach((depId) => {
            checkAndDeselectDependency(depId);
          });
        }
      }

      return updatedTasks;
    });
  };

  const handleUpdateTask = (id: string, field: "title" | "description", value: string) => {
    setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, [field]: value } : task)));
  };

  const handleRemoveTask = (id: string) => {
    setTasks((prev) => prev.filter((task) => task.id !== id));
  };

  const toggleDependencyExpansion = (taskId: string) => {
    setExpandedDependencies((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const handleConfirm = async () => {
    const selectedTasks = tasks.filter((task) => task.selected && task.title.trim().length > 0);
    if (!selectedTasks.length) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "No tasks selected",
        message: "Please select at least one task to create.",
      });
      return;
    }
    await onConfirm(selectedTasks, {
      link_to_parent: linkToParent,
      set_parent_as_epic: setParentAsEpic,
    });
  };

  return (
    <ModalCore isOpen={isOpen} handleClose={handleClose} position={EModalPosition.TOP} width={EModalWidth.XL}>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        className="flex flex-col gap-4 p-5 max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-medium text-primary">AI task breakdown</h2>
            <p className="text-xs text-secondary mt-1">
              Review, edit and select which tasks you want to create from this PRD. This is using mocked data and will
              be connected to Task Master later.
            </p>
            <p className="text-xs text-tertiary mt-1.5 italic">
              Tip: Double click on the title or description to edit.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 overflow-y-auto pr-1 min-w-full">
          {isLoading ? (
            // Skeleton loading state - simple list style
            <Loader>
              {Array.from({ length: 3 }).map((_, idx) => (
                <div key={`skeleton-${idx}`} className="flex items-start gap-3 py-2">
                  <div className="pt-0.5 shrink-0">
                    <Loader.Item height="16px" width="16px" className="rounded" />
                  </div>
                  <div className="flex flex-col gap-2 flex-1 min-w-0">
                    <Loader.Item height="24px" width="100%" className="rounded-md" />
                    <Loader.Item height="64px" width="100%" className="rounded-md" />
                    <div className="flex items-center gap-2 flex-wrap mt-1">
                      <Loader.Item height="20px" width="80px" className="rounded-full" />
                      <Loader.Item height="20px" width="100px" className="rounded-full" />
                    </div>
                  </div>
                  <Loader.Item height="24px" width="24px" className="rounded shrink-0 mt-0.5" />
                </div>
              ))}
            </Loader>
          ) : (
            tasks.map((task) => {
              const isDependenciesExpanded = expandedDependencies.has(task.id);

              return (
                <BreakdownTaskCard
                  key={task.id}
                  task={task}
                  allTasks={tasks}
                  isDependenciesExpanded={isDependenciesExpanded}
                  onToggleSelect={handleToggleSelect}
                  onUpdateTask={handleUpdateTask}
                  onRemoveTask={handleRemoveTask}
                  onToggleDependencies={toggleDependencyExpansion}
                />
              );
            })
          )}
          {!isLoading && !tasks.length && (
            <div className="rounded-md border border-dashed border-custom-border-200 bg-custom-background-90 p-3 text-xs text-secondary">
              No suggested tasks yet. This will be populated from Task Master once the integration is connected.
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 pt-1">
          <div className="flex flex-col gap-2 border-t border-custom-border-200 pt-3">
            <div className="text-xs font-medium text-secondary">Options</div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={linkToParent}
                  onChange={() => setLinkToParent(!linkToParent)}
                  aria-label="Link tasks to parent work item"
                />
                <span className="text-xs text-secondary cursor-pointer">Link tasks to parent work item</span>
              </div>
              {/* Temporarily hidden */}
              {/* <div className="flex items-center gap-2">
                <Checkbox
                  checked={setParentAsEpic}
                  onChange={() => setSetParentAsEpic(!setParentAsEpic)}
                  aria-label="Set parent as epic"
                />
                <span className="text-xs text-secondary cursor-pointer">Set parent as epic</span>
              </div> */}
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button variant="neutral-primary" size="lg" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="lg"
              onClick={() => {
                void handleConfirm();
              }}
              loading={isSubmitting}
              disabled={isLoading || isSubmitting}
            >
              Confirm
            </Button>
          </div>
        </div>
      </div>
    </ModalCore>
  );
});
