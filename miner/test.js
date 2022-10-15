const crypto = require('crypto');
var hexToBin = require('hex-to-binary');

function calculateHash(data){
    var hash = crypto.createHash('sha256').update(data).digest('hex').toString();

    return hexToBin(hash);
}

function concatAndStringify(...inputs){
    return inputs.map(input => JSON.stringify(input)).sort().join(' ');
}

const data = {
    transaction1: 'abc'
}

const hash = calculateHash(concatAndStringify(data))

console.log(hash)