const bodyParser = require('body-parser')

const express = require('express');
const cors = require('cors');

const fs = require('fs')

const app = express();

const server = require('http').Server(app);

const io = require('socket.io')(server, {
    cors:{
        origin: "*",
        methods: ["GET", "POST"]
    }
})

app.use(cors());
app.use(bodyParser.json());

app.use(express.static('public'))


app.get('/miner-data', async function(request, response){

})

app.post('/save-miner-data', async function(request, response){

})

const PORT = 3001;

server.listen(PORT, function(){
    console.log("Server is up, listening on port:", PORT)
})