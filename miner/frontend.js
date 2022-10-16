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
    port: '12345'
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
    const messageObj = JSON.parse(messageStr);

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

    sing(data){
        const digSign = this.keyPair.sign(calculateHash(concatAndStringify(data)));
        return digSign;
    }

    createTransaction(obj){
        const {recipient ,amount, chain} = obj;

        if(chain){
            this.balance = Wallet.calculateBalance({
                chain,
                address: this.publicKey
            })

        }

        if(this.balance < amount){
            alert('Amount exceeds balance!');
            throw new Error('Amount exceeds balance');
        }

        return new Transaction({senderWallet: this, recipient, amount})

    }

    static calculateBalance(obj) {
        const { chain, address } = obj;
    
        let hasConductedTransaction = false;
        let outputsTotal = 0;
    
        for (let i=chain.length-1; i>=0; i--) {
          const block = chain[i];
    
          for (let transaction of block.data) {
    
            //is this address sender of the transaction
            if (transaction.input.address === address) {
              hasConductedTransaction = true;
            }
    
            const addressOutput = transaction.outputMap[address];
    
            if (addressOutput) {
              outputsTotal = outputsTotal + addressOutput;
            }
          }
    
          if (hasConductedTransaction) {
            break;
          }
        }
    
        return hasConductedTransaction ? outputsTotal : STARTING_BALANCE + outputsTotal;
      }
}

function calculateHash(data){
    var hash = crypto.createHash('sha256').update(data).digest('hex').toString();

    return hexToBin(hash);
}

function concatAndStringify(...inputs){
    return inputs.map(input => JSON.stringify(input)).sort().join(' ');
}

function verifySignature({publicKey, data, signature}){
    const keyFromPublic = ellipticCurve.keyFromPublic(publicKey, 'hex');

    return keyFromPublic.verify(calculateHash(concatAndStringify(data)), signature)

}
