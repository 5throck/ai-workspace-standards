---
name: presenter-mode
description: >
  Dual-window presenter state synchronization using browser BroadcastChannel API,
  syncing slide index, speaker notes, timer, current/next slide preview.
version: 1.0.1
last_reviewed: 2026-08-16
status: active
scope: co-deck
l2_propagate: true
owner: html-build
prerequisites: HTML presentation deck with BroadcastChannel API support
metadata:
  type: presentation-sync
  triggers:
    - presenter-mode
    - /presenter-mode
    - dual-window sync
    - presenter view
---

# Skill: presenter-mode

## Context

In high-impact presentations and lecture delivery (`co-deck`), presenting slides across multiple screens requires real-time synchronization between what the audience sees (Main Presentation Window) and what the speaker controls (Presenter Dashboard Window).

`presenter-mode` defines the browser-native dual-window state synchronization standard using the **BroadcastChannel API**. It provides sub-50ms synchronization latency without requiring external WebSocket servers or network infrastructure, keeping presentation decks zero-dependency and fully self-contained.

## When to Use

- Presenting slide decks across dual screens (Audience view + Presenter view) in `co-deck`.
- Synchronizing slide navigation, speaker notes, and presentation timers without external servers.
- Launching or re-connecting presenter dashboard windows mid-presentation.
- Reviewing next-slide previews and elapsed timers during live presentations.

## Execution Steps

1. **Initialize Channel**: Establish a named `BroadcastChannel` instance (`co-deck-presenter-channel`).
2. **State Registration**: Set up state listeners for `STATE_UPDATE`, `NAVIGATE`, `TIMER_TOGGLE`, `TIMER_RESET`, and `SYNC_REQUEST` events.
3. **Dispatch Navigation**: On slide transition, parse speaker notes and broadcast `STATE_UPDATE` to connected windows.
4. **Dashboard Synchronization**: Open Presenter Dashboard window, send `SYNC_REQUEST`, and hydrate UI controls with synced state.

## Output Format

State updates are dispatched as JSON messages matching the `PresenterStateMessage` contract over `BroadcastChannel`:

```json
{
  "type": "STATE_UPDATE",
  "deckId": "co-deck-presentation",
  "currentSlide": 3,
  "totalSlides": 12,
  "speakerNotes": "Highlight key architectural design decisions for Phase 1.",
  "timer": { "elapsedSeconds": 145, "isRunning": true, "startTime": 1722943200000 },
  "timestamp": 1722943345000
}
```

## Related Skills

- `render-pdf-deck`: Renders HTML presentation decks into paginated PDF files using Playwright.
- `explain-me`: Generates executive presentation summaries and documentation dashboards.

## Core Architecture & State Model

The presenter synchronization engine operates over a named `BroadcastChannel` (e.g., `co-deck-presenter-channel`). Both windows connect to the same channel context and exchange structured JSON event messages.

```
+-----------------------------------+         BroadcastChannel API        +-----------------------------------+
|         Audience Window           |   ("co-deck-presenter-channel")     |         Presenter Window          |
|      (Main Slide Viewport)        | <=================================> |       (Speaker Dashboard)         |
|  - Renders active slide           |   - STATE_UPDATE                    |  - Speaker notes view             |
|  - Listens to nav events          |   - NAVIGATE                        |  - Current & Next slide preview   |
|  - Emits slide index change       |   - TIMER_TOGGLE / RESET            |  - Presentation timer             |
+-----------------------------------+   - SYNC_REQUEST                    +-----------------------------------+
```

### Message Schema (`PresenterStateMessage`)

All messages sent across the `BroadcastChannel` MUST adhere to the following contract:

```typescript
export type PresenterMessageType =
  | 'STATE_UPDATE'   // Broadcast full current state
  | 'NAVIGATE'       // Request navigation to specific slide index
  | 'TIMER_TOGGLE'   // Pause / resume presentation timer
  | 'TIMER_RESET'    // Reset presentation timer to zero
  | 'SYNC_REQUEST';  // Request state broadcast from active window

export interface PresenterStateMessage {
  type: PresenterMessageType;
  deckId: string;
  currentSlide: number;
  totalSlides: number;
  speakerNotes: string;
  currentSlideTitle?: string;
  nextSlidePreview?: {
    index: number;
    title: string;
    snippet?: string;
  } | null;
  timer: {
    elapsedSeconds: number;
    isRunning: boolean;
    startTime: number | null;
  };
  timestamp: number;
}
```

## Dual-Window Workflow

### 1. Audience Window (Main Display)
- Primary display focused on full-screen slide rendering.
- Handles user key events (`ArrowRight`, `ArrowLeft`, `Space`, `PageDown`, `PageUp`).
- On slide change: parses slide notes (`<aside class="notes">` or `data-notes` attribute), extracts next slide title/preview, and posts `STATE_UPDATE` to the channel.
- Responds to `NAVIGATE` requests received from the Presenter window.
- Responds to `SYNC_REQUEST` by broadcasting its current state immediately.

### 2. Presenter Window (Speaker Dashboard)
- Opened via keyboard shortcut (e.g., press `P`) or explicit button on main window (`window.open('?mode=presenter')`).
- Renders:
  1. **Current Slide View**: High-fidelity view or thumbnail of active slide.
  2. **Next Slide Preview**: Preview of upcoming slide to allow seamless verbal transitions.
  3. **Speaker Notes**: Formatted markdown/HTML notes parsed from the current slide markup.
  4. **Presentation Timer**: Elapsed time clock, start/pause toggle, and reset controls.
  5. **Navigation Controls**: Next, Previous, Direct Jump grid for rapid access.
- On launch: sends `SYNC_REQUEST` to synchronize immediately with the already running Audience window.

## Canonical Implementation Patterns

### Pattern 1: Initializing BroadcastChannel & State Dispatcher

```javascript
// presenter-sync.js
const CHANNEL_NAME = 'co-deck-presenter-channel';
const channel = new BroadcastChannel(CHANNEL_NAME);

// Broadcast state from Audience window to Presenter window
function broadcastState(currentSlideIndex, totalSlides, notes, nextSlideInfo, timerState) {
  const message = {
    type: 'STATE_UPDATE',
    deckId: document.title || 'co-deck-presentation',
    currentSlide: currentSlideIndex,
    totalSlides: totalSlides,
    speakerNotes: notes || '',
    nextSlidePreview: nextSlideInfo ? {
      index: nextSlideInfo.index,
      title: nextSlideInfo.title,
    } : null,
    timer: timerState,
    timestamp: Date.now(),
  };
  channel.postMessage(message);
}
```

### Pattern 2: Incoming Event Handling & Navigation Request

```javascript
// Listen for messages across windows
channel.onmessage = (event) => {
  const data = event.data;
  if (!data || !data.type) return;

  switch (data.type) {
    case 'NAVIGATE':
      if (typeof data.currentSlide === 'number') {
        goToSlide(data.currentSlide);
      }
      break;

    case 'STATE_UPDATE':
      updatePresenterDashboard(data);
      break;

    case 'SYNC_REQUEST':
      // Respond with active state if this is the Audience window
      if (!isPresenterWindow) {
        broadcastState(currentIndex, totalSlides, currentNotes, nextSlide, currentTimerState);
      }
      break;

    case 'TIMER_TOGGLE':
      toggleTimerState();
      break;

    case 'TIMER_RESET':
      resetTimerState();
      break;
  }
};
```

### Pattern 3: Auto-Resync & Mid-Presentation Window Launch

```javascript
// Execute on Presenter Window initialization
function initPresenterDashboard() {
  // Request immediate state sync from Audience window
  channel.postMessage({
    type: 'SYNC_REQUEST',
    timestamp: Date.now(),
  });

  // Local Storage Fallback if BroadcastChannel message missed
  const cachedState = localStorage.getItem('co_deck_last_presenter_state');
  if (cachedState) {
    try {
      updatePresenterDashboard(JSON.parse(cachedState));
    } catch (e) {
      // Ignore parse errors
    }
  }
}
```

## Quality Gate Checklist

Before finalizing presenter mode implementation in presentation decks:

- [ ] `BroadcastChannel` is initialized with a consistent channel identifier across windows.
- [ ] Changing slides in Audience window updates Presenter window in under 50ms.
- [ ] Speaker notes contained in `<aside class="notes">` update dynamically upon navigation.
- [ ] Opening Presenter window mid-presentation automatically retrieves state via `SYNC_REQUEST`.
- [ ] Timer start/stop/reset actions sync correctly between both windows.
- [ ] Closing either window does not break execution or crash event handlers in the remaining window.
