import  express from 'express';
import {Server} from 'socket.io';
import {createServer} from 'node:http'

const app = express();
const server = createServer(app);

server.listen(8081, function() {
    console.log('server running on port 8081');
});


const io =new Server(server,{
    cors: {
      origin: "http://localhost:8080"
    }
  });

io.on('connection', function(socket) {
    socket.send("message", "Hello World")
    
});