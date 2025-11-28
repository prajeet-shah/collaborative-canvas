export function createSocket(handlers) {
  const socket = io();

  socket.on("connect", () => {
    console.log('✅ Connected to server');
    
    // Start latency monitoring
    setInterval(() => {
      const t0 = performance.now();
      socket.emit("ping:now");
      socket.once("pong:now", () =>
        handlers.onPong?.(Math.round(performance.now() - t0))
      );
    }, 2000);
  });

  socket.on("disconnect", () => {
    console.log('❌ Disconnected from server');
  });

  socket.on("error", (error) => {
    console.error('💥 Socket error:', error);
    handlers.onError?.(error);
  });

  // Room events
  socket.on("room:init", handlers.onInit);
  socket.on("user:joined", handlers.onUserJoin);
  socket.on("user:left", handlers.onUserLeft);
  socket.on("room:updateUsers", handlers.onRoomUpdateUsers);

  // Drawing events
  socket.on("stroke:start", handlers.onStrokeStart);
  socket.on("stroke:point", handlers.onStrokePoint);
  socket.on("stroke:end", handlers.onStrokeEnd);

  // Cursor events
  socket.on("cursor:move", handlers.onCursorMove);

  // History events
  socket.on("history:replace", handlers.onHistoryReplace);

  // Canvas events
  socket.on("canvas:cleared", handlers.onCanvasCleared);

  return socket;
}