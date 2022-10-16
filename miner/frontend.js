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


let SIGNALING_SERVER_URL = 'http://192.168.82.203:3000'
let isSynchronized = false;

var peers = {}

const myPeer = new Peer(undefined, {
    host: '192.168.82.203',
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
    sendMessage(connection.peer, 
        {
          event: 'sync',
          data:{
            blockchain: transactionMiner.blockchain,
            transactionPool: transactionMiner.transactionPool
          }  
        })

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
            sendMessage(peerId, 
                {
                  event: 'sync-response',
                  data:{
                    blockchain: transactionMiner.blockchain,
                    transactionPool: transactionMiner.transactionPool
                  }  
                })
            break;
        case 'sync-response':
            transactionMiner.blockchain 
                = new Blockchain(messageObj.data.blockchain)
            transactionMiner.transactionPool 
                = new TransactionPool(messageObj.data.transactionPool)

            removeAllBlocksFromPage();
            clearTransactionPoolOnPage();
        
            addBlockchainToPage(transactionMiner.blockchain.chain);
            addTransactionPoolToPage(transactionMiner.transactionPool)
            addWalletInfoOnPage(transactionMiner.wallet); 
            break;
        case 'transaction':
            transactionReceived(messageObj.data)
            break;
        case 'blockchain':
            blockchainReceived(messageObj.data)
            break;
    }
}

function transactionReceived(transaction){
    var newTransaction = new Transaction(transaction);
    transactionMiner.transactionPool.setTransaction(newTransaction);

    addTransactionToPage(transaction);

    saveBlockchainState();
}

function blockchainReceived(blockchainData){
    const chain = blockchainData.chain;

    transactionMiner.blockchain.replaceChain(chain, true, function(){

        transactionMiner.transactionPool.clearBlockchainTransactions({ chain })
    
        clearTransactionPoolOnPage();

        //remove all current blocks
        removeAllBlocksFromPage();

        addBlockchainToPage(chain);

        addWalletInfoOnPage(transactionMiner.wallet);

        saveBlockchainState();
    })
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
const { time } = require('console');

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

    sign(data){
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


class Block{
    timestamp;
    previousHash;
    hash;
    data;
    nonce;
    difficulty;

    constructor(obj){
        this.timestamp = obj.timestamp;
        this.previousHash = obj.previousHash;
        this.hash = obj.hash;
        this.data = obj.data;
        this.nonce = obj.nonce;
        this.difficulty = obj.difficulty;
    }

    static genesis(){
        return new Block(GENESIS_DATA)
    }

    static mineBlock({ lastBlock, data}){
        
        const previousHash = lastBlock.hash;
        var hash, timestamp;
        var difficulty = lastBlock.difficulty;
        var nonce = 0;

        miningInProgres = true;

        do{
            nonce++;
            timestamp = Date.now();

            difficulty = Block.adjustDifficulty({lastBlock, timestamp})

            hash = calculateHash(concatAndStringify(timestamp, previousHash, data, nonce, difficulty))
        
            console.log(hash);
        }while(hash.substring(0,difficulty) !== '0'.repeat(difficulty));
        
        miningInProgres = false;

        return new Block({timestamp, previousHash, data, difficulty, nonce, hash})
    }

    static adjustDifficulty({originalBlock, timestamp}){
        const difficulty = originalBlock.difficulty;

        if(difficulty <= 1) return 1;
        
        if((timestamp - originalBlock.timestamp) > MINE_RATE) return difficulty-1;

        return difficulty+1;
    }

    getHash(){
        return calculateHash(concatAndStringify
            (this.timestamp, this.previousHash, this.data, this.nonce, this.difficulty))
    }
}

class Transaction {
    id;
    outputMap;
    input;

    constructor(obj) {
        const { id, senderWallet, recipient, amount, outputMap, input } = obj;
        this.id = id ?? uuidv4()
        this.outputMap = outputMap || this.createOutputMap({ senderWallet, recipient, amount });
        this.input = input || this.createInput({ senderWallet, outputMap: this.outputMap });

    }

    createOutputMap({ senderWallet, recipient, amount }) {
        const outputMap = {};

        outputMap[recipient] = amount;
        outputMap[senderWallet.publicKey] = senderWallet.balance - amount;

        return outputMap;
    }

    createInput({ senderWallet, outputMap }) {
        return {
            timestamp: Date.now(),
            amount: senderWallet.balance,
            address: senderWallet.publicKey,
            signature: senderWallet.sign(outputMap)
        };
    }

    update({ senderWallet, recipient, amount }) {
        if (amount > this.outputMap[senderWallet.publicKey]) {
            throw new Error('Amount exceeds balance');
        }

        if (!this.outputMap[recipient]) {
            this.outputMap[recipient] = amount;//if recipient is new
        } else {
            this.outputMap[recipient] = this.outputMap[recipient] + amount;//if same recipient already exists in transaction
        }

        this.outputMap[senderWallet.publicKey] =
            this.outputMap[senderWallet.publicKey] - amount;//reduce sender remaining value

        this.input = this.createInput({ senderWallet, outputMap: this.outputMap });
    }

    static validTransaction(transaction) {
        const { input: { address, amount, signature }, outputMap } = transaction;

        const outputTotal = Object.values(outputMap)
            .reduce((total, outputAmount) => total + outputAmount);

        if (amount !== outputTotal) {
            console.error(`Invalid transaction from ${address}`);
            return false;
        }

        if (!verifySignature({ publicKey: address, data: outputMap, signature })) {
            console.error(`Invalid signature from ${address}`);
            return false;
        }

        return true;
    }

    static rewardTransaction(obj) {
        const { minerWallet } = obj;
        return new this({
            input: REWARD_INPUT,
            outputMap: { [minerWallet.publicKey]: MINING_REWARD }
        });
    }
}


class Blockchain{
    chain; //array of blocks

    constructor(chain){
        this.chain = chain ?? [Block.genesis()];
    }

    addBlock({data}){
        const newBlock = Block.mineBlock({
            lastBlock: this.chain[this.chain.length-1],
            data
        })

        this.chain.push(newBlock);

        //TODO add on html page

    }

    replaceChain(chain, validateTransactions = true, onSuccess){
        if(chain.length <= this.chain.length){
            console.error('Incoming chain must be longer');
            return;
        }

        if(!Blockchain.isValidChain(chain)){
            console.log("Incoming chain is invalid!")
            return;
        }

        if(validateTransactions){
            if(!this.validTransactionData({chain})){
                console.log("Incoming chain has invalid data")
                return;
            }
        }

        if(onSuccess) onSuccess();
    }

    validTransactionData({ chain }) {
        for (let i = 1; i < chain.length; i++) {
            const block = chain[i];
            const transactionSet = new Set();
            let rewardTransactionCount = 0;

            for (let transaction of block.data) {
                if (transaction.input.address === REWARD_INPUT.address) {
                    rewardTransactionCount += 1;

                    if (rewardTransactionCount > 1) {
                        console.error('Miner rewards exceed limit');
                        return false;
                    }

                    if (Object.values(transaction.outputMap)[0] !== MINING_REWARD) {
                        console.error('Miner reward amount is invalid');
                        return false;
                    }
                } else {
                    if (!Transaction.validTransaction(transaction)) {
                        console.error('Invalid transaction');
                        return false;
                    }

                    const trueBalance = Wallet.calculateBalance({
                        chain: this.chain.slice(0, i),
                        address: transaction.input.address
                    });

                    console.log(transaction)

                    if (transaction.input.amount !== trueBalance) {
                        console.log(transaction.input.amount)
                        console.log(trueBalance)
                        console.error('Invalid input amount');
                        return false;
                    }

                    if (transactionSet.has(transaction)) {
                        console.error('An identical transaction appears more than once in the block');
                        return false;
                    } else {
                        transactionSet.add(transaction);
                    }
                }
            }
        }

        return true;
    }

    static isValidChain(chain) {

        for (let i = 1; i < chain.length; i++) {
            //validate every single block
            const { timestamp, previousHash, hash, nonce, difficulty, data } = chain[i];
            const actualLastHash = chain[i - 1].hash;
            const lastDifficulty = chain[i - 1].difficulty;

            if (previousHash !== actualLastHash) return false;

            const validatedHash = calculateHash(concatAndStringify(timestamp, previousHash, data, nonce, difficulty));

            if (hash !== validatedHash) return false;

            if (Math.abs(lastDifficulty - difficulty) > 1) return false;

        }

        return true;
    }
}


class TransactionPool {
    transactionMap;

    constructor(transactionMap) {
        if (transactionMap) {
            Object.entries(transactionMap).forEach(([key, value]) => {
                transactionMap[key] = new Transaction({ ...value });
            })

        }

        this.transactionMap = transactionMap ?? {}

    }

    clear() {
        this.transactionMap = {};
    }

    setTransaction(transaction) {
        this.transactionMap[transaction.id] = transaction;
    }

    setMap(transactionMap) {
        this.transactionMap = transactionMap;
    }

    existingTransaction({ inputAddress }) {
        const transactions = Object.values(this.transactionMap);

        return transactions.find(transaction => transaction.input.address === inputAddress);
    }

    validTransactions() {
        return Object.values(this.transactionMap).filter(
            transaction => Transaction.validTransaction(transaction)
        );
    }

    clearBlockchainTransactions({ chain }) {
        for (let i = 1; i < chain.length; i++) {
            const block = chain[i];

            for (let transaction of block.data) {
                if (this.transactionMap[transaction.id]) {
                    delete this.transactionMap[transaction.id];
                }
            }
        }
    }
}

class TransactionMiner{
  blockchain;
  transactionPool;
  wallet;
  communication;

  constructor(object) {
    const {blockchain, transactionPool, wallet, communication } = object;
    this.communication = communication;
    this.blockchain = blockchain;
    this.transactionPool = transactionPool;
    this.wallet = wallet;
  }

  mineTransactions() {
    const validTransactions = this.transactionPool.validTransactions();

    if(!validTransactions || validTransactions.length <= 0){
      throw new Error('No transaction in transaction pool')
    }

    validTransactions.push(
      Transaction.rewardTransaction({ minerWallet: this.wallet })
    );

    this.blockchain.addBlock({ data: validTransactions });

    this.communication.broadcastChain();

    this.transactionPool.clear();

    saveBlockchainState();

    addWalletInfoOnPage(this.wallet)
  }
}

class Communication{
    transactionMiner;

    broadcastChain(){
        broadcastMessage
        ({event:'blockchain', data: this.transactionMiner.blockchain});
    }

    broadcastTransaction(transaction){
        broadcastMessage({event:'transaction', data: transaction})
    }
}

// Wallet elements
const walletDiv = document.querySelector('.wallet')

const addressDiv = walletDiv.querySelector('.address')
const balanceDiv = walletDiv.querySelector('.balance')

const amountDiv = document.getElementById('amount')
const recipientDiv = document.getElementById('recipient')

const submitBtn = document.querySelector('.submitBtn')

submitBtn.addEventListener('click', submitTransaction)


// Transaction elements
const transactionPoolDiv = document.querySelector('.transaction-pool')
var guessedHashDiv = document.querySelector('.guessed-hash');
// USER FUNCTIONS

function submitTransaction() {
  const amount = +amountDiv.value;

  if (isNaN(amount) || amount <= 0) {
    alert('Amount has to be number greater than 0')
    return;
  }


  const recipient = recipientDiv.value;

  if(recipient.trim() == transactionMiner.wallet.publicKey){
    alert(`You cannot send transactions to your own wallet`);
    return;
  }

  //check if transaction already exists in transaction pool
  let transaction = transactionMiner.transactionPool.existingTransaction({inputAddress: wallet.publicKey});

  if(transaction){ //transaction exists in pool
    transaction = new Transaction({...transaction});
    transaction.update({ senderWallet: transactionMiner.wallet, recipient, amount })
  }else{ //transaction doesn't exists in pool
    transaction = wallet.createTransaction({
      recipient,
      amount,
      chain: transactionMiner.blockchain.chain
  });
  }

  transactionMiner.transactionPool.setTransaction(transaction);

  addTransactionToPage(transaction);

  clearTransactionForm();

  communication.broadcastTransaction(transaction);

  saveBlockchainState();

  console.log("TRANSACTION POOL MI JE", transactionMiner.transactionPool)
  console.log(transactionMiner.transactionPool)
}

function clearTransactionForm(){
  amountDiv.value='';
  recipientDiv.value='';
}

function addTransactionToPage(transaction){
  const transactionElement = document.createElement('div');
  transactionElement.classList.add('transaction')

  transactionElement.setAttribute('transactionid', transaction.id);

  transactionElement.innerHTML = 
  `
    <div>
       <div>
            <b>${transaction.id}</b> - ${new Date(transaction.input.timestamp).toLocaleString()}
            </div>

            <div>
                <b>Sender:</b> ${transaction.input.address}
            </div>

            <div>
                Total amount: <b>${Object.entries(transaction.outputMap).reduce((prevValue,[currKey,currValue])=>{
                  if(currKey == transaction.input.address) return prevValue;
                  return prevValue+currValue;
              },0)}</b>
            </div>
            <details>
                <summary>
                    Transactions
                </summary>
                <p>
                    <hr>
                    ${Object.keys(transaction.outputMap).filter(key => key != transaction.input.address).map((key,index)=>{
                      return( 
                      `
                      <div class="transfer">
                        <div>${index+1}</div>
                        <div class="transfer-address">${ key }</div> 
                        <div><b>${transaction.outputMap[key]}<b></div> 
                      </dvi>
                      `)
                    }).join('')}
                </p>
            </details>
            <br>
    </div>
  `

  const sameTransaction = transactionPoolDiv.querySelector(`.transaction[transactionid="${transaction.id}"]`)

  if(sameTransaction) sameTransaction.remove();

  transactionPoolDiv.appendChild(transactionElement)
}

function addTransactionPoolToPage(transactionPool){
  for(const transaction in transactionPool.transactionMap){
    addTransactionToPage(transactionPool.transactionMap[transaction])
  }
}

document.querySelector('.mine-button').addEventListener('click', mineTransactions)


function mineTransactions(){
  if(miningInProgress) return;

  transactionMiner.mineTransactions();
  transactionMiner.transactionPool.clear();

  clearTransactionPoolOnPage();
}

function clearTransactionPoolOnPage(){
  const transactionsDivs = transactionPoolDiv.querySelectorAll('.transaction');

  for(let transactionDiv of transactionsDivs){
    transactionDiv.remove();
  }

}

// Blockchain elements

var blockchainLedgerDiv = document.querySelector('.blockchain-ledger');

function addBlockToPage(block, index){
  const blockDiv = document.createElement('div');
  blockDiv.classList.add('block');

  blockDiv.innerHTML = `
    <div>
      <b>#${index}</b> - ${new Date(block.timestamp).toLocaleString()}
      <hr>
      <details>
        <summary>
            Current block hash
        </summary>
        <p>
            ${block.hash}
        </p>
      </details>
      <details>
        <summary>
            Previous block hash
        </summary>
        <p>
            ${block.previousHash}
        </p>
      </details>
      <hr>
      <details>
        <summary>
            Transactions
        </summary>
        <p>
            ${block.data.map( transaction =>{
              return (
                `
                  <div class="transaction">
                    <div>
                       <div>
                            <b>${transaction.id}</b> - ${new Date(transaction.input.timestamp).toLocaleString()}
                            </div>

                            <div>
                              <b>Sender:</b> ${transaction.input.address}
                            </div>

                            <div>
                                Total amount: ${Object.entries(transaction.outputMap).reduce((prevValue,[currKey,currValue])=>{
                                  if(currKey == transaction.input.address) return prevValue;
                                  return prevValue+currValue;
                              },0)}
                            </div>
                            <details>
                                <summary>
                                    Transactions
                                </summary>
                                <p>
                                    <hr>
                                    ${Object.keys(transaction.outputMap).filter(key => key != transaction.input.address).map((key, index) => {
                                      return (
                                        `
                                      <div class="transfer">
                                        <div>${index + 1}</div>
                                        <div class="transfer-address">${key}</div> 
                                        <div><b>${transaction.outputMap[key]}<b></div> 
                                      </dvi>
                                      `)
                                    }).join('')}
                                </p>
                            </details>
                            <br>
                    </div>
                  </div>
                `
              )
            })}
        </p>
      </details>       
      <hr>
      <div>
        Nonce: ${ block.nonce }
      </div>
      <div>
        Difficulty: ${ block.difficulty }
      </div>
    </div>
  `

  blockchainLedgerDiv.appendChild(blockDiv)
}

function transactionReceived(transaction){

  const {id , outputMap, input} = transaction
  const newTransaction = new Transaction({ id, outputMap, input });
  transactionMiner.transactionPool.setTransaction(newTransaction);

  addTransactionToPage(transaction);

  saveBlockchainState();
}


function blockchainReceived(blockchainData){
  const chain = blockchainData.chain;
  transactionMiner.blockchain.replaceChain(chain, true, function(){
    
    transactionMiner.transactionPool.clearBlockchainTransactions(
      { chain: chain }
    );

    clearTransactionPoolOnPage();

    //remove all current blocks
    removeAllBlocksFromPage();

    addBlockchainToPage(chain);

    addWalletInfoOnPage(transactionMiner.wallet);

    saveBlockchainState();
  });
}

function removeAllBlocksFromPage(){
  const blocksDivs = blockchainLedgerDiv.querySelectorAll('.block');

  for(const blockDiv of blocksDivs){
    blockDiv.remove();
  }
} 

function addBlockchainToPage(chain) {
  for (let i = chain.length-1; i >= 0; i--) {
    addBlockToPage(chain[i], i + 1)
    
  }
}