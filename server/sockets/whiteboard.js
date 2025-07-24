// Update to use ES module syntax
export default (io, socket) => {
  // Handle draw events
  socket.on("draw", (data) => {
    const { roomId, x, y, dragging } = data;
    // Broadcast the drawing data to other users in the room
    socket.to(roomId).emit("draw", { x, y, dragging });
  });

  // Handle clearCanvas events
  socket.on("clearCanvas", (data) => {
    const { roomId } = data;
    // Broadcast the clearCanvas event to other users in the room
    socket.to(roomId).emit("clearCanvas");
  });
};