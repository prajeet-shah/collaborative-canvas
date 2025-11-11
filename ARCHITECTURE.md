
### `ARCHITECTURE.md` (starter)
```md
# Architecture

## Data Flow
Pointer events → canvas local draw (prediction) → stream via WS:
- `stroke:start` (server assigns `opId`)
- `stroke:point` (throttled)
- `stroke:end`

Server relays events to room; clients render remote segments.
On undo/redo, server emits `history:replace` with full history; clients clear+replay.

## WebSocket Protocol
Client → Server:
- `join { username, roomId }`
- `cursor:move { x, y }`
- `stroke:start { tool,color,width,start:{x,y,t} }`
- `stroke:point { x,y,t }`
- `stroke:end`
- `history:undo`, `history:redo`
- `ping:now`

Server → Client:
- `room:init { roomId, users:[...], history:[ops], nextOpId }`
- `user:joined { id,name,color }`
- `user:left { userId }`
- `cursor:move { userId,color,x,y }`
- `stroke:start { opId, userId, tool,color,width, points:[{x,y,t}] }`
- `stroke:point { opId, point:{x,y,t} }`
- `stroke:end { opId }`
- `history:replace { history:[ops], nextOpId }`
- `pong:now`

## Undo/Redo Strategy (Global)
- Server keeps `history` (ops) + `redoStack`.
- Undo = pop last op → redoStack.
- Redo = pop redoStack → history.
- Server broadcasts `history:replace` for deterministic replay.
- Eraser equals `destination-out` strokes (non-destructive composition).

## Performance Decisions
- Throttle point messages (~8ms).
- Quadratic smoothing between consecutive points.
- Redraw only on init/undo/redo; incremental for live drawing.
- Single canvas for simplicity; offscreen layer could be added if needed.

## Conflict Resolution
- Z-order by `opId` (later wins).
- Eraser strokes cut previous pixels via compositing.
