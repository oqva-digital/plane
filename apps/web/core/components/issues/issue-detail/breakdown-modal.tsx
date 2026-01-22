import { useState, useEffect } from "react";
import { observer } from "mobx-react";
import { X } from "lucide-react";
// plane imports
import { ChevronDownIcon } from "@plane/propel/icons";
import { IconButton } from "@plane/propel/icon-button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Button, Input, TextArea, EModalWidth, EModalPosition, ModalCore, Checkbox, Badge } from "@plane/ui";
import type { TTaskBreakdownPriority } from "@/types/breakdown";

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
};

// NOTE: This component currently uses mocked data and should be wired to the real Task Master
// integration once the backend contract is available.
export const BreakdownModal = observer(function BreakdownModal(props: Props) {
  const { isOpen, onClose, onConfirm, initialTasks = [], isSubmitting = false } = props;
  const [tasks, setTasks] = useState<TMockBreakdownTask[]>(initialTasks);
  const [expandedDependencies, setExpandedDependencies] = useState<Set<string>>(new Set());
  const [linkToParent, setLinkToParent] = useState<boolean>(true);
  const [setParentAsEpic, setSetParentAsEpic] = useState<boolean>(false);

  // Update tasks when initialTasks changes
  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  const handleClose = () => {
    setTasks(initialTasks);
    onClose();
  };

  const handleToggleSelect = (id: string) => {
    setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, selected: !task.selected } : task)));
  };

  const handleChangeField = (id: string, field: "title" | "description", value: string) => {
    setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, [field]: value } : task)));
  };

  const handleRemoveTask = (id: string) => {
    setTasks((prev) => prev.filter((task) => task.id !== id));
  };

  const handleAddTask = () => {
    const id = `temp-${Date.now()}`;
    setTasks((prev) => [
      ...prev,
      {
        id,
        title: "",
        description: "",
        selected: true,
        isNew: true,
        dependencies: [],
        tags: [],
      },
    ]);
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

  const getDependencyTasks = (_taskId: string, dependencyIds: string[]): TMockBreakdownTask[] => {
    return tasks.filter((task) => dependencyIds.includes(task.id));
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
      <div className="flex flex-col gap-4 p-5 max-h-[80vh]">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-medium text-primary">AI task breakdown</h2>
            <p className="text-xs text-secondary mt-1">
              Review, edit and select which tasks you want to create from this PRD. This is using mocked data and will
              be connected to Task Master later.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 overflow-y-auto pr-1 min-w-full">
          {tasks.map((task) => {
            const hasDependencies = task.dependencies && task.dependencies.length > 0;
            const isDependenciesExpanded = expandedDependencies.has(task.id);
            const dependencyTasks = hasDependencies ? getDependencyTasks(task.id, task.dependencies!) : [];

            return (
              <div
                key={task.id}
                className="flex flex-col gap-3 rounded-lg border border-custom-border-200 bg-custom-background-100 p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="pt-0.5 shrink-0">
                    <Checkbox
                      checked={task.selected}
                      onChange={() => handleToggleSelect(task.id)}
                      aria-label="Select task to create"
                    />
                  </div>
                  <div className="flex flex-col gap-3 flex-1 min-w-0">
                    <div className="flex flex-col gap-2">
                      <Input
                        value={task.title}
                        onChange={(e) => handleChangeField(task.id, "title", e.target.value)}
                        placeholder="Task title"
                        className="w-full text-sm font-medium"
                      />
                      <TextArea
                        value={task.description ?? ""}
                        onChange={(e) => handleChangeField(task.id, "description", e.target.value)}
                        placeholder="Add an optional description or acceptance criteria"
                        className="text-xs min-h-16 resize-none w-full"
                      />
                    </div>

                    {/* Dependencies section */}
                    {hasDependencies && (
                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleDependencyExpansion(task.id);
                          }}
                          className="flex items-center gap-1.5 text-xs text-secondary hover:text-primary transition-colors w-fit"
                        >
                          <ChevronDownIcon
                            className={`h-3.5 w-3.5 transition-transform ${isDependenciesExpanded ? "rotate-180" : ""}`}
                          />
                          <span className="font-medium">Dependencies ({task.dependencies!.length})</span>
                        </button>
                        {isDependenciesExpanded && hasDependencies && dependencyTasks.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pl-5">
                            {dependencyTasks.map((depTask) => (
                              <Badge
                                key={depTask.id}
                                variant="neutral"
                                size="sm"
                                className="text-xs font-normal cursor-default"
                              >
                                {depTask.title || `Task ${depTask.id}`}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Metadata badges */}
                    {(task.priority || task.estimated_hours || (task.tags && task.tags.length > 0)) && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {task.priority && (
                          <Badge variant="primary" size="sm" className="text-xs">
                            Priority: {task.priority}
                          </Badge>
                        )}
                        {task.estimated_hours && (
                          <Badge variant="primary" size="sm" className="text-xs">
                            {task.estimated_hours}h estimated
                          </Badge>
                        )}
                        {task.tags && task.tags.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {task.tags.map((tag, idx) => (
                              <Badge key={idx} variant="primary" size="sm" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <IconButton
                    variant="ghost"
                    size="sm"
                    icon={X}
                    onClick={() => handleRemoveTask(task.id)}
                    className="shrink-0 mt-0.5 text-custom-text-400 hover:text-danger-500"
                    aria-label="Remove task"
                  />
                </div>
              </div>
            );
          })}
          {!tasks.length && (
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
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={setParentAsEpic}
                  onChange={() => setSetParentAsEpic(!setParentAsEpic)}
                  aria-label="Set parent as epic"
                />
                <span className="text-xs text-secondary cursor-pointer">Set parent as epic</span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <Button variant="link-neutral" size="sm" onClick={handleAddTask}>
              Add task
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="neutral-primary" size="sm" onClick={handleClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  void handleConfirm();
                }}
                loading={isSubmitting}
              >
                Confirm
              </Button>
            </div>
          </div>
        </div>
      </div>
    </ModalCore>
  );
});
