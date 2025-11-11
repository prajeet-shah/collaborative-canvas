export function createSocket(handlers) {
  const socket = io();

  socket.on("connect", () => {
  
    setInterval(() => {
      const t0 = performance.now();
      socket.emit("ping:now");
      socket.once("pong:now", () =>
        handlers.onPong?.(Math.round(performance.now() - t0))
      );
    }, 2000);
  });


  socket.on("room:init", handlers.onInit);
  socket.on("user:joined", handlers.onUserJoin);
  socket.on("user:left", handlers.onUserLeft);

  socket.on("stroke:start", handlers.onStrokeStart);
  socket.on("stroke:point", handlers.onStrokePoint);
  socket.on("stroke:end", handlers.onStrokeEnd);

  socket.on("cursor:move", handlers.onCursorMove);

  socket.on("history:replace", handlers.onHistoryReplace);

 
  return socket;
}
