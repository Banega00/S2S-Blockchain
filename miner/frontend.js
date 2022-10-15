const MINE_RATE = 1000*1000 //1000 sec
const INITIAL_DIFFICULTY = 12;

const GENESIS_DATA = {
    timestamp: 1,
    previousHash: '-----',
    hash: 'hash-one',
    difficulty: INITIAL_DIFFICULTY,
    nonce: 0
}

const STARTING_BALANCE = 0;
const REWARD_INPUT = {address: '*authorized-reward'}
const MINING_REWARD = 50;
/////////////////////////////////////////////////////////////

var miningInProgres = false;
var PEER_ID;


let SIGNALING_SERVER_URL = 'http://10.1.5.106:3000'
let isSynchronized = false;

var peers = {}

const myPeer = new Peer(undefined, {
    host: '10.1.5.106',
    port: '123456'
})

myPeer.on('open', function(id){
    console.log('Connected to singaling server')

    const socket = io(SIGNALING_SERVER_URL);
    PEER_ID = id;

    socket.emit('new-peer', id);

    socket.on('new-peer', function(peerId){

        connectToNewPeer(peerId);
    })

    socket.on('peer-disconnected', function(peerId){
        removePeerFromOnlinePeers(peerId)
    })
})

function connectToNewPeer(peerId){
    const connection = myPeer.connect(peerId);
    
    connection.on('open', function(){
        console.log('Connection:', connection.connectionId)
    })

    //TODO: send message to new peer

    connection.on('data', function(data){

        receiveMessage(peerId, data);
    })

    connection.on('close', function(){

        removePeerFromOnlinePeers(connection.peer)
    })

    peers[peerId] = connection;
}

function sendMessage(peerId, messageObj){
    var messageStr = JSON.stringify(messageObj);
    peers[peerId].send(messageStr)
}

function broadcastMessage(messageObj){
    for(var peerId in peers){
        sendMessage(peerId, messageObj);
    }
}

function receiveMessage(peerId, messageStr){
    const messageObj = JSON.parse();

    //TODO define actions for events
    switch(messageObj.event){
        case 'sync-request':
            break;
        case 'sync-response':
            break;
        case 'transaction':
            break;
        case 'blockchain':
            break;
    }
}

function removePeerFromOnlinePeers(peerId){
    console.log('Peer disconnected', peerId)

    if(peers[peerId]){
        peers[peerId].close();
        delete peers[peerId];
    }
}

////////////////////////////////////////
const ec = require('elliptic').ec;
const ellipticCurve = new ec('secp256k1');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
var hexToBin = require('hex-to-binary');

class Wallet{
    balance;
    keyPair;
    publicKey;

    constructor(wallet){
        this.balance = wallet?.balance ?? STARTING_BALANCE;

        if(wallet?.keyPair){
            this.keyPair = ellipticCurve.keyFromPrivate(wallet.keyPair.priv)
        }else{
            this.keyPair = ellipticCurve.genKeyPair();
        }

        this.publicKey = this.keyPair.getPublic().encode('hex', true);

        console.log('Keys generated')
    }
}

