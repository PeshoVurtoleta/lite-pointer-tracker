import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PointerTracker } from './PointerTracker.js';

/**
 * Helper: create a PointerEvent-like object.
 * jsdom's PointerEvent constructor is incomplete, so we use plain objects
 * with the properties the tracker actually reads.
 */
function createPointerEvent(type, overrides = {}) {
    return {
        type,
        button: 0,
        buttons: 1,
        pointerId: 1,
        cancelable: true,
        preventDefault: vi.fn(),
        ...overrides,
    };
}

describe('🎯 PointerTracker', () => {
    let el;
    let handlers;
    let tracker;

    beforeEach(() => {
        el = document.createElement('div');
        el.setPointerCapture = vi.fn();
        el.releasePointerCapture = vi.fn();
        document.body.appendChild(el);

        handlers = {
            onStart: vi.fn(),
            onMove: vi.fn(),
            onEnd: vi.fn(),
        };
    });

    afterEach(() => {
        tracker?.destroy();
        el.remove();
    });

    function create(opts = {}) {
        tracker = new PointerTracker(el, { ...handlers, ...opts });
        return tracker;
    }

    /** Dispatch a real DOM event (goes through addEventListener) */
    function dispatch(type, overrides = {}) {
        const { cancelable = true, ...props } = overrides;
        const e = new Event(type, { bubbles: true, cancelable });
        Object.assign(e, { button: 0, buttons: 1, pointerId: 1, preventDefault: vi.fn(), ...props });
        el.dispatchEvent(e);
        return e;
    }

    // ═══════════════════════════════════════════════
    //  Constructor
    // ═══════════════════════════════════════════════

    describe('constructor', () => {
        it('sets touch-action to none on the target', () => {
            create();
            expect(el.style.touchAction).toBe('none');
        });

        it('preserves original touch-action for restore', () => {
            el.style.touchAction = 'pan-y';
            create();
            expect(el.style.touchAction).toBe('none');
            expect(tracker._originalTouchAction).toBe('pan-y');
        });

        it('starts inactive', () => {
            create();
            expect(tracker.isActive).toBe(false);
        });

        it('defaults handlers to no-ops', () => {
            tracker = new PointerTracker(el);
            expect(tracker.onStart).toBeTypeOf('function');
            expect(tracker.onMove).toBeTypeOf('function');
            expect(tracker.onEnd).toBeTypeOf('function');
        });
    });

    // ═══════════════════════════════════════════════
    //  Pointer Down
    // ═══════════════════════════════════════════════

    describe('pointerdown', () => {
        it('activates on primary button down', () => {
            create();
            dispatch('pointerdown');
            expect(tracker.isActive).toBe(true);
            expect(handlers.onStart).toHaveBeenCalledTimes(1);
        });

        it('calls setPointerCapture with the event pointerId', () => {
            create();
            dispatch('pointerdown', { pointerId: 7 });
            expect(el.setPointerCapture).toHaveBeenCalledWith(7);
        });

        it('stores the captured pointerId', () => {
            create();
            dispatch('pointerdown', { pointerId: 42 });
            expect(tracker._capturedPointerId).toBe(42);
        });

        it('ignores non-primary buttons (right click)', () => {
            create();
            dispatch('pointerdown', { button: 2 });
            expect(tracker.isActive).toBe(false);
            expect(handlers.onStart).not.toHaveBeenCalled();
        });

        it('ignores second pointerdown while active', () => {
            create();
            dispatch('pointerdown');
            dispatch('pointerdown', { pointerId: 2 });
            expect(handlers.onStart).toHaveBeenCalledTimes(1);
        });
    });

    // ═══════════════════════════════════════════════
    //  Pointer Move
    // ═══════════════════════════════════════════════

    describe('pointermove', () => {
        it('calls onMove while active', () => {
            create();
            dispatch('pointerdown');
            dispatch('pointermove');
            expect(handlers.onMove).toHaveBeenCalledTimes(1);
        });

        it('ignores moves when not active', () => {
            create();
            dispatch('pointermove');
            expect(handlers.onMove).not.toHaveBeenCalled();
        });

        it('calls preventDefault on cancelable moves', () => {
            create();
            dispatch('pointerdown');
            const e = dispatch('pointermove', { cancelable: true });
            expect(e.preventDefault).toHaveBeenCalled();
        });

        it('skips preventDefault on non-cancelable moves', () => {
            create();
            dispatch('pointerdown');
            const e = dispatch('pointermove', { cancelable: false });
            expect(e.preventDefault).not.toHaveBeenCalled();
        });
    });

    // ═══════════════════════════════════════════════
    //  Pointer Up
    // ═══════════════════════════════════════════════

    describe('pointerup', () => {
        it('deactivates and calls onEnd', () => {
            create();
            dispatch('pointerdown');
            dispatch('pointerup');
            expect(tracker.isActive).toBe(false);
            expect(handlers.onEnd).toHaveBeenCalledTimes(1);
        });

        it('releases pointer capture using stored pointerId', () => {
            create();
            dispatch('pointerdown', { pointerId: 5 });
            dispatch('pointerup', { pointerId: 99 }); // different id

            // Should release 5 (stored), not 99 (event's)
            expect(el.releasePointerCapture).toHaveBeenCalledWith(5);
        });

        it('clears _capturedPointerId', () => {
            create();
            dispatch('pointerdown');
            dispatch('pointerup');
            expect(tracker._capturedPointerId).toBeNull();
        });

        it('ignores pointerup when not active', () => {
            create();
            dispatch('pointerup');
            expect(handlers.onEnd).not.toHaveBeenCalled();
        });
    });

    // ═══════════════════════════════════════════════
    //  Pointer Cancel
    // ═══════════════════════════════════════════════

    describe('pointercancel', () => {
        it('deactivates and calls onEnd', () => {
            create();
            dispatch('pointerdown');
            dispatch('pointercancel');
            expect(tracker.isActive).toBe(false);
            expect(handlers.onEnd).toHaveBeenCalledTimes(1);
        });
    });

    // ═══════════════════════════════════════════════
    //  Ghost-Drag Detection
    // ═══════════════════════════════════════════════

    describe('ghost-drag (macOS)', () => {
        it('ends interaction when buttons bitmask shows no primary button', () => {
            create();
            dispatch('pointerdown');

            // Move with buttons = 0 (button already released outside window)
            dispatch('pointermove', { buttons: 0 });

            expect(tracker.isActive).toBe(false);
            expect(handlers.onEnd).toHaveBeenCalledTimes(1);
            expect(handlers.onMove).not.toHaveBeenCalled();
        });
    });

    // ═══════════════════════════════════════════════
    //  Lost Pointer Capture
    // ═══════════════════════════════════════════════

    describe('lostpointercapture', () => {
        it('ends interaction when capture is forcibly released', () => {
            create();
            dispatch('pointerdown');
            dispatch('lostpointercapture');

            expect(tracker.isActive).toBe(false);
            expect(handlers.onEnd).toHaveBeenCalledTimes(1);
        });

        it('clears _capturedPointerId', () => {
            create();
            dispatch('pointerdown', { pointerId: 10 });
            dispatch('lostpointercapture');
            expect(tracker._capturedPointerId).toBeNull();
        });

        it('ignores when not active', () => {
            create();
            dispatch('lostpointercapture');
            expect(handlers.onEnd).not.toHaveBeenCalled();
        });
    });

    // ═══════════════════════════════════════════════
    //  Release Capture Error Handling
    // ═══════════════════════════════════════════════

    describe('releasePointerCapture error handling', () => {
        it('swallows error if capture already released', () => {
            create();
            el.releasePointerCapture = vi.fn(() => {
                throw new DOMException('InvalidStateError');
            });

            dispatch('pointerdown');
            expect(() => dispatch('pointerup')).not.toThrow();
            expect(handlers.onEnd).toHaveBeenCalled();
        });
    });

    // ═══════════════════════════════════════════════
    //  Destroy
    // ═══════════════════════════════════════════════

    describe('destroy()', () => {
        it('restores original touch-action', () => {
            el.style.touchAction = 'pan-x';
            create();
            expect(el.style.touchAction).toBe('none');

            tracker.destroy();
            expect(el.style.touchAction).toBe('pan-x');
        });

        it('restores empty string touch-action', () => {
            el.style.touchAction = '';
            create();
            tracker.destroy();
            expect(el.style.touchAction).toBe('');
        });

        it('sets isActive to false', () => {
            create();
            dispatch('pointerdown');
            tracker.destroy();
            expect(tracker.isActive).toBe(false);
        });

        it('nulls target reference', () => {
            create();
            tracker.destroy();
            expect(tracker.target).toBeNull();
        });

        it('removes event listeners (no callbacks after destroy)', () => {
            create();
            tracker.destroy();
            handlers.onStart.mockClear();
            dispatch('pointerdown');
            expect(handlers.onStart).not.toHaveBeenCalled();
        });

        it('is idempotent', () => {
            create();
            tracker.destroy();
            expect(() => tracker.destroy()).not.toThrow();
        });

        it('clears _capturedPointerId', () => {
            create();
            dispatch('pointerdown', { pointerId: 3 });
            tracker.destroy();
            expect(tracker._capturedPointerId).toBeNull();
        });
    });

    // ═══════════════════════════════════════════════
    //  Full Interaction Flow
    // ═══════════════════════════════════════════════

    describe('full interaction flow', () => {
        it('start → move → move → end', () => {
            create();
            dispatch('pointerdown');
            dispatch('pointermove');
            dispatch('pointermove');
            dispatch('pointerup');

            expect(handlers.onStart).toHaveBeenCalledTimes(1);
            expect(handlers.onMove).toHaveBeenCalledTimes(2);
            expect(handlers.onEnd).toHaveBeenCalledTimes(1);
            expect(tracker.isActive).toBe(false);
        });

        it('can restart after end', () => {
            create();
            dispatch('pointerdown');
            dispatch('pointerup');
            expect(tracker.isActive).toBe(false);

            dispatch('pointerdown');
            expect(tracker.isActive).toBe(true);
            expect(handlers.onStart).toHaveBeenCalledTimes(2);
        });

        it('cancel mid-drag, then restart', () => {
            create();
            dispatch('pointerdown');
            dispatch('pointermove');
            dispatch('pointercancel');
            expect(tracker.isActive).toBe(false);

            dispatch('pointerdown');
            dispatch('pointermove');
            dispatch('pointerup');

            expect(handlers.onStart).toHaveBeenCalledTimes(2);
            expect(handlers.onEnd).toHaveBeenCalledTimes(2);
        });
    });
});
