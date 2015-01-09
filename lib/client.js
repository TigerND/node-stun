var dgram  = require('dgram'),
    events = require('events'),
    util   = require('util'),
    dns   = require('dns'),
    net   = require('net');

var Packet = require('./packet');

// Client Class
var Client = function(port, host, family){
    events.EventEmitter.call(this);

    this._host = host;
    this._port = port;
    this._family = family || net.isIPv6(this._host) ? 6 : (net.isIPv4(this._host) ? 4: undefined);
};

// Inherit EventEmitter
util.inherits(Client, events.EventEmitter);

Client.prototype._connect = function(callback) {
    var socket = dgram.createSocket(this._family == 6 ? 'udp6' : 'udp4');
    this._socket = socket;
    socket.on('message', this._onMessage());
    socket.on('error',   this._onError());
    setImmediate(function() {
        callback();
    });
};

Client.prototype.connect = function(callback) {
    var self = this;
    callback = callback || function() {};
    if (!self._family) {
        dns.lookup(self._host, function(err, host, family) {
            if (!self._family) {
                if (err) {
                    setImmediate(function() {
                        self.emit('error', err);
                        callback(err);
                    });
                } else {
                    self._host = host;
                    self._family = family;
                    self._connect(callback);
                }
            }
        });
    } else {
        self._connect(callback);
    }
    return this;
};

// Close client
Client.prototype.close = function close() {
    this._socket.close();
};

// Send UDP message
Client.prototype.send = function send(buffer, offset, length, port, host, cb) {
    this._socket.send(buffer, offset, length, port, host, cb);
};

// Send STUN request
Client.prototype.request = function request(cb) {
    var packet = new Packet(Packet.BINDING_CLASS, Packet.METHOD.REQUEST, {});
    var message = packet.encode();
    this._socket.send(message, 0, message.length, this._port, this._host, cb);
};

// Send STUN indication
Client.prototype.indicate = function indicate(cb) {
    var packet = new Packet(Packet.BINDING_CLASS, Packet.METHOD.INDICATION, {});
    var message = packet.encode();
    this._socket.send(message, 0, message.length, this._port, this._host, cb);
};

// Receive message handler
Client.prototype._onMessage = function() {
    var self = this;

    return function _onMessage(msg, rinfo) {
        var packet = Packet.decode(msg);

        if (packet === null) {
            self.emit('message', msg, rinfo);
        } else if (packet.method === Packet.METHOD.RESPONSE_E) {
            self.emit('error_response', packet);
        } else {
            self.emit('response', packet);
        }
    };
};

// Error handler
Client.prototype._onError = function() {
    var self = this;

    return function _onError(err) {
        self.emit('error', err);
    };
};

module.exports = Client;
