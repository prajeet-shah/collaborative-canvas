export class DrawingState {
  constructor() {
    this.history = [];
    this.redoStack = [];
    this.nextOpId = 1;
    this.inProgress = new Map();
  }

  getSnapshot() {
    return {
      history: this.history,
      nextOpId: this.nextOpId,
    };
  }

  beginStroke(user, stroke) {
    const op = {
      opId: this.nextOpId++,
      userId: user.id,
      userName: user.name,
      tool: stroke.tool,
      color: stroke.color,
      width: stroke.width,
      brushStyle: stroke.brushStyle || "solid",
      points: [stroke.start],
      timestamp: Date.now()
    };
    
    this.inProgress.set(user.id, op);
    this.redoStack.length = 0;
    
    return op;
  }

  appendPoint(user, segment) {
    const op = this.inProgress.get(user.id);
    if (!op) return null;
    
    op.points.push(segment);
    return { opId: op.opId, point: segment };
  }

  endStroke(user) {
    const op = this.inProgress.get(user.id);
    if (!op) return null;
    
    this.inProgress.delete(user.id);
    this.history.push(op);
    
    return { opId: op.opId };
  }

  undo() {
    if (this.history.length === 0) return null;
    const removed = this.history.pop();
    this.redoStack.push(removed);
    return this._makeReplacePayload();
  }

  redo() {
    if (this.redoStack.length === 0) return null;
    const restored = this.redoStack.pop();
    this.history.push(restored);
    return this._makeReplacePayload();
  }

  clear() {
    this.history = [];
    this.redoStack = [];
    this.inProgress.clear();
    return this._makeReplacePayload();
  }

  _makeReplacePayload() {
    return { 
      history: this.history, 
      nextOpId: this.nextOpId 
    };
  }

  // Statistics
  getStats() {
    return {
      totalStrokes: this.history.length,
      totalPoints: this.history.reduce((sum, stroke) => sum + stroke.points.length, 0),
      activeUsers: this.inProgress.size
    };
  }
}