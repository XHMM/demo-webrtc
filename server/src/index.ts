import * as express from "express";
import * as https from "https";
import * as socketIO from "socket.io";
import * as fs from "fs";
import * as path from "path";


const app = express();
const server = https.createServer({
  key: fs.readFileSync(path.join(process.cwd(), 'src/server.key')),
  cert:fs.readFileSync(path.join(process.cwd(), 'src/server.cert')),
}, app);
const io = socketIO(server);

const users = new Map();
const inRoomUsers = new Map();
io.on("connection", socket => {
  socket.on("clientJoin", args => {
    users.set(socket.id, args);
    io.sockets.emit("clientCountChange", Array.from(users.values()));
  });

  socket.on("clientJoinRoom", args => {
    const oldInRoomIds = Array.from(inRoomUsers.values());
    inRoomUsers.set(socket.id, args);
    io.sockets.emit(
      "inRoomClientCountChange",
      Array.from(inRoomUsers.values())
    );
    socket.emit('connectToOtherClients', oldInRoomIds)
  })
  ;
  socket.on("clientLeave", (isIn: boolean) => {
    users.delete(socket.id);
    io.sockets.emit("clientCountChange", Array.from(users.values()));
    if (isIn) {
      inRoomUsers.delete(socket.id);
      io.sockets.emit(
        "inRoomClientCountChange",
        Array.from(inRoomUsers.values())
      );
    }
    socket.leave(socket.id);
  });

  socket.on("inRoomClientLeave", () => {
    const peerId = inRoomUsers.get(socket.id);
    inRoomUsers.delete(socket.id);
    io.sockets.emit(
      "inRoomClientCountChange",
      Array.from(inRoomUsers.values())
    );
    socket.broadcast.emit('clientDisconnected', peerId)
  });

  socket.on('textMessage', (text) => {
    const id = users.get(socket.id);
    io.sockets.emit('textMessage', {id, text})
  })
});
app.use(express.static(path.join(process.cwd(), './parcelBuild')))
app.get('/', (req, res) =>{
  res.sendFile(path.join(process.cwd(), './parcelBuild/index.html'))
})
const PORT = 8080;
server.listen(PORT, () => {
  console.log(`listening on port ${PORT}`);
});
