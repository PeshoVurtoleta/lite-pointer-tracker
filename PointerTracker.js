/**
 * lite-pointer-tracker — Lightweight Pointer Events Manager
 *
 * Unifies mouse, touch, and pen interactions into a clean start/move/end API.
 *
 * Features:
 * - Prevents mobile Safari gesture hijacking via programmatic `touch-action: none`
 * - Safely cleans up all event listeners using `AbortController`
 * - Handles macOS ghost-drag (button released outside window)
 * - Handles lost pointer capture (element removed mid-drag, capture stolen)
 * - Tracks captured pointerId for reliable release
 * - Passes raw PointerEvent to handlers for zero-allocation performance,
 *   preserving native access to stylus `pressure`, `tiltX`, and `pointerType`.
 */

export class PointerTracker {
    constructor(target, handlers = {}) {
        this.target = target;
        this.onStart = handlers.onStart || (() => {});
        this.onMove  = handlers.onMove  || (() => {});
        this.onEnd   = handlers.onEnd   || (() => {});

        this.isActive = false;
        this._destroyed = false;
        this._capturedPointerId = null;
        this._abortController = new AbortController();

        // Prevent browser from claiming the gesture before we get pointermove.
        // Stores original touch-action for clean restore on destroy.
        this._originalTouchAction = target.style.touchAction;
        target.style.touchAction = 'none';

        this._bindEvents();
    }

    _bindEvents() {
        const el = this.target;
        const signal = this._abortController.signal;

        const stop = (e) => {
            if (!this.isActive) return;
            this.isActive = false;

            // Release capture using the stored pointerId (not the event's,
            // which could theoretically differ in coalesced scenarios)
            if (this._capturedPointerId !== null) {
                try {
                    el.releasePointerCapture(this._capturedPointerId);
                } catch {
                    // Ignore: capture may have already been released or element detached
                }
                this._capturedPointerId = null;
            }

            this.onEnd(e);
        };

        el.addEventListener('pointerdown', (e) => {
            if (this.isActive || e.button !== 0) return;
            this.isActive = true;
            this._capturedPointerId = e.pointerId;
            el.setPointerCapture(e.pointerId);
            this.onStart(e);
        }, { signal, passive: false });

        el.addEventListener('pointermove', (e) => {
            if (!this.isActive) return;

            // macOS ghost-drag: button released but browser didn't fire pointerup
            if (!(e.buttons & 1)) {
                stop(e);
                return;
            }

            if (e.cancelable) e.preventDefault();
            this.onMove(e);
        }, { signal, passive: false });

        el.addEventListener('pointerup', stop, { signal });
        el.addEventListener('pointercancel', stop, { signal });

        // Safety net: if the browser forcibly releases capture (element removed
        // from DOM mid-drag, or another setPointerCapture steals it), pointerup
        // may never fire. lostpointercapture is the definitive signal.
        el.addEventListener('lostpointercapture', (e) => {
            if (this.isActive) {
                this.isActive = false;
                this._capturedPointerId = null;
                this.onEnd(e);
            }
        }, { signal });
    }

    destroy() {
        if (this._destroyed) return;
        this._destroyed = true;
        this.isActive = false;
        this._capturedPointerId = null;
        this._abortController.abort();

        // Restore original touch-action so we don't leave side effects
        if (this._originalTouchAction !== undefined) {
            this.target.style.touchAction = this._originalTouchAction;
        }

        this.target = null;
    }
}

export default PointerTracker;
