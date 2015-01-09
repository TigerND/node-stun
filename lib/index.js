var Client = require('./client'),
    Packet = require('./packet');

exports.connect = function connect(port, host, callback) {
    var client = new Client(port, host);
    return client.connect(callback)
};

exports.method    = Packet.METHOD;
exports.attribute = Packet.ATTR;
