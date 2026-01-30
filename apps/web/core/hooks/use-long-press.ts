import { useCallback, useEffect, useRef } from "react";

type Options = {
  delayMs?: number;
  /** Delay before capturing pointer (ms). Only capture after this so quick clicks on checkbox/ellipsis work. Default 200. */
  captureDelayMs?: number;
};

/**
 * Hook for detecting long-press (e.g. 1s) on an element.
 * Use with pointer events; when the user holds for delayMs, onLongPress is called
 * and longPressHandledRef.current is set to true so the next click can be suppressed.
 * Pointer capture is delayed by captureDelayMs so quick clicks (checkbox, ellipsis) are not intercepted.
 */
export function useLongPress(
  onLongPress: () => void,
  options: Options = {}
): {
  longPressHandledRef: React.MutableRefObject<boolean>;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
  onPointerLeave: (e: React.PointerEvent) => void;
} {
  const { delayMs = 1000, captureDelayMs = 200 } = options;
  const longPressHandledRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const targetRef = useRef<HTMLElement | null>(null);
  const onLongPressRef = useRef(onLongPress);
  useEffect(() => {
    onLongPressRef.current = onLongPress;
  }, [onLongPress]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const clearCaptureTimer = useCallback(() => {
    if (captureTimerRef.current) {
      clearTimeout(captureTimerRef.current);
      captureTimerRef.current = null;
    }
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      longPressHandledRef.current = false;
      clearTimer();
      clearCaptureTimer();
      const target = e.currentTarget;
      if (target instanceof HTMLElement) {
        targetRef.current = target;
        pointerIdRef.current = e.pointerId;
        // Only capture after a short delay so quick clicks on checkbox/ellipsis work
        captureTimerRef.current = setTimeout(() => {
          captureTimerRef.current = null;
          if (
            targetRef.current &&
            pointerIdRef.current !== null &&
            typeof targetRef.current.setPointerCapture === "function"
          ) {
            targetRef.current.setPointerCapture(pointerIdRef.current);
          }
        }, captureDelayMs);
      }
      timerRef.current = setTimeout(() => {
        longPressHandledRef.current = true;
        onLongPressRef.current();
        clearTimer();
      }, delayMs);
    },
    [clearTimer, clearCaptureTimer, delayMs, captureDelayMs]
  );

  const releaseAndClear = useCallback(
    (e: React.PointerEvent) => {
      clearTimer();
      clearCaptureTimer();
      const target = e.currentTarget;
      if (target instanceof HTMLElement && typeof target.releasePointerCapture === "function") {
        try {
          target.releasePointerCapture(e.pointerId);
        } catch {
          // ignore if already released
        }
      }
      pointerIdRef.current = null;
      targetRef.current = null;
    },
    [clearTimer, clearCaptureTimer]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      releaseAndClear(e);
    },
    [releaseAndClear]
  );

  const onPointerCancel = useCallback(
    (e: React.PointerEvent) => {
      releaseAndClear(e);
    },
    [releaseAndClear]
  );

  // Do NOT clear timer on leave - slight movement (scroll/jitter) would cancel long-press.
  // Only pointer up/cancel should end the gesture.
  const onPointerLeave = useCallback((_e: React.PointerEvent) => {
    // no-op: keep timer running so long-press still fires if user holds
  }, []);

  return {
    longPressHandledRef,
    onPointerDown,
    onPointerUp,
    onPointerCancel,
    onPointerLeave,
  };
}
