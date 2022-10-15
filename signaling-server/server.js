const dotenv = require('dotenv');
dotenv.config();

const express = require('express');

const app = express();

const server = require('http').Server(app)

const io = require('socket.io')(server, {
    cors:{
        origin: "*",
        methods: ["GET", "POST"]
    }
})

io.on("connection", function(socket){
  
    socket.on("new-peer", function(peerId){
        console.log(`New peer connected ${peerId}`);

        socket.broadcast.emit('new-peer', peerId);

        socket.on('disconnect', function(){
            console.log(`Peer disconnected ${peerId}`);

            socket.broadcast.emit('peer-disconnected', peerId)

        })
    })
})

const PORT = 3000;

server.listen(PORT, function(){
    console.log("Server is up, listening on port:", PORT)
})