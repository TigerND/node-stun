var ip = require('ip');
var xor = require('bitwise-xor')

// Packet Class
var Packet = function(stun_class, method, attrs) {
    this.class  = stun_class;
    this.method = method;
    this.attrs  = attrs || {};
    this.tid    = this._getTransactionId();
    
    Object.defineProperty(this, 'address', {
        get: function() {
            return this._getAddress();
        }
    });

    Object.defineProperty(this, 'software', {
        get: function() {
            return this._getSoftware();
        }
    });
};

// Packet header length
Packet.HEADER_LENGTH = 20;
// STUN magic key
Packet.MAGIC_KEY = 0x2112A442;
// Max transaction ID (32bit)
Packet.TID_MAX = Math.pow(2,32);

// Binding Class
Packet.BINDING_CLASS  = 0x0001;
// STUN Method Mask
Packet.METHOD_MASK = 0x0110;
// STUN Method
Packet.METHOD = {
    REQUEST:    0x0000,
    INDICATION: 0x0010,
    RESPONSE_S: 0x0100,
    RESPONSE_E: 0x0110
};

// Attributes
Packet.ATTR = {
    MAPPED_ADDRESS:     0x0001,
    USERNAME:           0x0006,
    MESSAGE_INTEGRITY:  0x0008,
    ERROR_CODE:         0x0009,
    UNKNOWN_ATTRIBUTES: 0x000A,
    REALM:              0x0014,
    NONCE:              0x0015,
    XOR_MAPPED_ADDRESS: 0x0020,
    SOFTWARE:           0x8022,
    ALTERNATE_SERVER:   0x8023,
    FINGERPRINT:        0x8028
};

// Error code
Packet.ERROR_CODE = {
    300: 'Try Alternate',
    400: 'Bad Request',
    401: 'Unauthorized',
    420: 'Unknown Attribute',
    438: 'Stale Nonce',
    500: 'Server Error'
};

// Get address
Packet.prototype._getAddress = function _getAddress() {
    return this.attrs[Packet.ATTR.MAPPED_ADDRESS] || this.attrs[Packet.ATTR.XOR_MAPPED_ADDRESS];
};

// Get software
Packet.prototype._getSoftware = function _getSoftware() {
    return this.attrs[Packet.ATTR.SOFTWARE];
};

// Generate tansaction ID
Packet.prototype._getTransactionId = function _getTransactionId() {
    return (Math.random() * Packet.TID_MAX);
};

// Encode packet
Packet.prototype.encode = function encode() {
    var encoded_attrs = this._encodeAttributes();
    var encoded_header = this._encodeHeader(encoded_attrs.length);

    return Buffer.concat([encoded_header, encoded_attrs]);
};

// Encode packet header
Packet.prototype._encodeHeader = function _encodeHeader(length) {
    var type = this.method | this.class;
    var encoded_header = new Buffer(Packet.HEADER_LENGTH);

    encoded_header.writeUInt16BE((type & 0x3fff), 0);
    encoded_header.writeUInt16BE(length, 2);
    encoded_header.writeUInt32BE(Packet.MAGIC_KEY, 4);
    encoded_header.writeUInt32BE(0, 8);
    encoded_header.writeUInt32BE(0, 12);
    encoded_header.writeUInt32BE(this.tid, 16);

    return encoded_header;
};

// Encode packet attributes
Packet.prototype._encodeAttributes = function _encodeAttributes() {
    var encoded_attrs = new Buffer(0);

    // TODO: Not implemented yet

    return encoded_attrs;
};

// Determines whether STUN Packet
Packet._isStunPacket = function _isStunPacket(buffer) {
    var block = buffer.readUInt8(0);
    var bit1 = block & 0x80;
    var bit2 = block & 0x40;

    return (bit1 === 0 && bit2 === 0) ? true : false;
};

// Decode packet
Packet.decode = function decode(buffer) {
    if (Packet._isStunPacket(buffer) === false) {
        return null;
    }

    var buffer_header = buffer.slice(0, Packet.HEADER_LENGTH);
    var header = Packet._decodeHeader(buffer_header);

    var buffer_attrs = buffer.slice(Packet.HEADER_LENGTH, buffer.length);
    var attrs = Packet._decodeAttributes(buffer_header, buffer_attrs);

    var packet = new Packet(Packet.BINDING_CLASS, header.method, attrs);
    packet.tid = header.tid;

    return packet;
};

// Decode packet header
Packet._decodeHeader = function _decodeHeader(buffer) {
    var header = {};
    header.method     = buffer.readUInt16BE(0) & Packet.METHOD_MASK;
    header.length     = buffer.readUInt16BE(2);
    header.magick_key = buffer.readUInt32BE(4);
    header.tid        = buffer.readUInt32BE(16);

    return header;
};

// Decode packet attributes
Packet._decodeAttributes = function _decodeAttributes(buffer_header, buffer) {
    var attrs = {};
    var offset = 0;

    while (offset < buffer.length) {
        var type = buffer.readUInt16BE(offset);
        offset += 2;

        var length = buffer.readUInt16BE(offset);
        var block_out = length % 4;
        if (block_out > 0) {
            length += 4 - block_out;
        }
        offset += 2;

        var value = buffer.slice(offset, offset + length);
        offset += length;

        switch (type) {
        case Packet.ATTR.MAPPED_ADDRESS:
            value = this._decodeMappedAddress(value);
            break;
        case Packet.ATTR.XOR_MAPPED_ADDRESS:
            value = this._decodeXorMappedAddress(buffer_header, value);
            break;
        case Packet.ATTR.SOFTWARE:
            value = this._decodeSoftware(value);
            break;
        case Packet.ATTR_ERROR_CODE:
            value = this._decodeErrorCode(value);
            break;
        case Packet.UNKNOWN_ATTRIBUTES:
            value = this._decodeUnknownAttributes(value);
            break;
        }

        attrs[type] = value;
    }

    return attrs;
};

// Decode MAPPED-ADDRESS value
Packet._decodeMappedAddress = function _decodeMappedAddress(buffer) {
    var family = (buffer.readUInt16BE(0) === 0x02) ? 6 : 4;

    return {
        family:  family,
        port:    buffer.readUInt16BE(2),
        address: ip.toString(buffer, 4, family == 4 ? 4 : 16)
    };
};

// Decode XOR-MAPPED-ADDRESS value
Packet._decodeXorMappedAddress = function _decodeXorMappedAddress(buffer_header, buffer) {
    var family = (buffer.readUInt16BE(0) === 0x02) ? 6 : 4;

    // https://tools.ietf.org/html/rfc5389#section-15.2
    var addr;
    if (family == 4) {
        addr = xor(buffer.slice(4, 4 + 4), buffer_header.slice(4, 4 + 4));
    } else {
        addr = xor(buffer.slice(4, 4 + 16), buffer_header.slice(4, 4 + 16));
    }
    var port = xor(buffer.slice(2, 2 + 2), buffer_header.slice(4, 4 + 2)).readUInt16BE(0);

    return {
        family:  family,
        port:    port,
        address: ip.toString(addr, 0, family == 4 ? 4 : 16)
    };
};

// Decode ERROR-CODE value
Packet._decodeErrorCode = function _decodeErrorCode(buffer) {
    var block = buffer.readUInt32BE(0);
    var code = (block & 0x700) * 100 + block & 0xff;
    var reason = buffer.readUInt32BE(4);

    return {
        code: code,
        reason: reason
    };
};

// Decode SOFTWARE
Packet._decodeSoftware = function _decodeSoftware(buffer) {

    // https://tools.ietf.org/html/rfc5389#section-15.10
    return buffer.toString();
};

// Decode UNKNOWN-ATTRIBUTES value
Packet._decodeUnknownAttributes = function _decodeUnknownAttributes(buffer) {
    var unknown_attrs = [];
    var offset = 0;

    while (offset < buffer.length) {
        unknown_attrs.push(buffer.readUInt16BE(offset));
        offset += 2;
    }

    return unknown_attrs;
};

module.exports = Packet;
