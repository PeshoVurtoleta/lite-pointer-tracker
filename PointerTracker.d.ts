/**
 * lite-pointer-tracker — Lightweight Pointer Events Manager
 */

export interface PointerTrackerHandlers {
    /** Called on primary button pointerdown. Receives the raw PointerEvent. */
    onStart?: (event: PointerEvent) => void;
    /** Called on pointermove while active. Receives the raw PointerEvent. */
    onMove?: (event: PointerEvent) => void;
    /** Called on pointerup, pointercancel, lostpointercapture, or ghost-drag detection. */
    onEnd?: (event: PointerEvent) => void;
}

export class PointerTracker {
    /** Whether a pointer interaction is currently in progress. */
    isActive: boolean;

    /**
     * Create a pointer tracker on the given element.
     *
     * Sets `touch-action: none` on the target to prevent browser gesture
     * hijacking. The original value is restored on `destroy()`.
     *
     * @param target The DOM element to track pointer events on.
     * @param handlers Callback functions for start, move, and end events.
     */
    constructor(target: HTMLElement, handlers?: PointerTrackerHandlers);

    /**
     * Stop tracking, remove all event listeners, restore `touch-action`,
     * and release the target reference. Idempotent.
     */
    destroy(): void;
}

export default PointerTracker;
