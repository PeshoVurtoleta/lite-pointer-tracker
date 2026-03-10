# lite-pointer-tracker

[![npm version](https://img.shields.io/npm/v/lite-pointer-tracker.svg?style=for-the-badge&color=latest)](https://www.npmjs.com/package/lite-pointer-tracker)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/lite-pointer-tracker?style=for-the-badge)](https://bundlephobia.com/result?p=lite-pointer-tracker)
![TypeScript](https://img.shields.io/badge/TypeScript-Types-informational)
![Zero Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

A lightweight, zero-dependency pointer events manager that unifies mouse, touch, and pen interactions into a clean start/move/end API.

Built for canvas apps, scratch cards, drawing tools, and any UI where you need reliable drag tracking without fighting the browser.

## Features

- **Unified API** — one handler set for mouse, touch, and pen
- **Mobile Safari safe** — programmatic `touch-action: none` prevents gesture hijacking
- **Ghost-drag detection** — handles macOS edge case where button is released outside the window
- **Lost capture recovery** — detects when the browser forcibly releases pointer capture
- **Pointer capture** — all events route through the target element, even when the pointer leaves it
- **Zero allocation** — passes the raw `PointerEvent` to handlers (no wrapper objects)
- **Stylus-aware** — native access to `pressure`, `tiltX`, `tiltY`, `pointerType`
- **Clean teardown** — `AbortController`-based listener cleanup, restores original `touch-action`

## Installation

```bash
npm install lite-pointer-tracker
```

Or drop the single file into your project.

## Quick Start

```javascript
import { PointerTracker } from 'lite-pointer-tracker';

const canvas = document.querySelector('canvas');

const tracker = new PointerTracker(canvas, {
    onStart(e) {
        console.log('Down at', e.offsetX, e.offsetY);
    },
    onMove(e) {
        console.log('Move to', e.offsetX, e.offsetY);
        // e.pressure available for stylus
    },
    onEnd(e) {
        console.log('Up');
    },
});

// Later: clean up
tracker.destroy();
```

## API

### `new PointerTracker(target, handlers?)`

| Parameter | Type | Description |
|-----------|------|-------------|
| `target` | `HTMLElement` | The element to track pointer events on |
| `handlers.onStart` | `(e: PointerEvent) => void` | Called on primary button pointerdown |
| `handlers.onMove` | `(e: PointerEvent) => void` | Called on pointermove while active |
| `handlers.onEnd` | `(e: PointerEvent) => void` | Called on pointerup, pointercancel, lostpointercapture, or ghost-drag |

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `.isActive` | `boolean` | Whether a pointer interaction is in progress |

### Methods

| Method | Description |
|--------|-------------|
| `.destroy()` | Remove all listeners, restore `touch-action`, release target. Idempotent. |

## How It Works

**Pointer capture:** On `pointerdown`, the tracker calls `setPointerCapture()` so all subsequent `pointermove` and `pointerup` events route through the target element — even if the pointer moves outside it. This is what makes drag tracking reliable.

**Ghost-drag detection:** On macOS, if the user releases the mouse button while the cursor is outside the browser window, `pointerup` never fires. The tracker detects this by checking `e.buttons & 1` on every `pointermove` — if the primary button is no longer held, it synthesizes an end event.

**Lost capture recovery:** If the browser forcibly releases pointer capture (element removed from DOM mid-drag, or another element calls `setPointerCapture`), `pointerup` may never fire. The tracker listens for `lostpointercapture` as a safety net to ensure `onEnd` is always called.

**Touch-action:** The constructor sets `touch-action: none` on the target to prevent mobile browsers from interpreting pointer events as scroll or zoom gestures. The original value is saved and restored on `destroy()`.

**Cleanup:** All event listeners use the same `AbortController` signal. `destroy()` calls `abort()` once, removing everything in a single operation.

## Edge Cases Handled

| Scenario | Behavior |
|----------|----------|
| Right-click / secondary button | Ignored (`button !== 0` check) |
| Second finger while first is active | Ignored (`isActive` guard) |
| Button released outside window (macOS) | Detected via `buttons` bitmask on move |
| Element removed from DOM mid-drag | `lostpointercapture` fires `onEnd` |
| Another element steals pointer capture | `lostpointercapture` fires `onEnd` |
| `destroy()` called twice | No-op (idempotent) |
| `destroy()` called mid-drag | `isActive` set to false, listeners removed |

## TypeScript

Full type definitions included:

```typescript
import { PointerTracker, type PointerTrackerHandlers } from 'lite-pointer-tracker';

const handlers: PointerTrackerHandlers = {
    onStart(e) { console.log(e.pressure); },
    onMove(e) { console.log(e.tiltX); },
    onEnd() { console.log('done'); },
};

const tracker = new PointerTracker(myCanvas, handlers);
```

## License

MIT
