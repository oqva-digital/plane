import type { MutableRefObject } from "react";
import { useOutsideClickDetector } from "@plane/hooks";

type Props = {
  containerRef: MutableRefObject<HTMLElement | null>;
  onClearSelection: () => void;
  children: React.ReactNode;
};

/**
 * Wraps layout content and clears selection when user clicks outside the container.
 * Used to exit selection mode on outside click.
 */
export function SelectionClearOnOutsideClick(props: Props) {
  const { containerRef, onClearSelection, children } = props;
  useOutsideClickDetector(containerRef, onClearSelection);
  return <>{children}</>;
}
