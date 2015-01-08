/* -*- coding: utf-8 -*-
============================================================================= */
/*jshint asi: true*/

var dgram = require('dgram'),
    stun  = require('../lib');

var peer = [];

// STUN Server (by Google)
var port = 19302;
var host = 'stun.l.google.com';

var onRequest = function(){
    console.log('Sending STUN packet');
};

var onError = function(err) {
    console.log('Error:', err);
};

// Create STUN Client
var client1 = stun.connect(port, host);
client1.on('error', onError);

// Client1: STUN Response event handler
client1.on('response', function(packet){
    console.log('Received STUN packet:', packet);
    
    var addr = packet.attrs[stun.attribute.MAPPED_ADDRESS] || packet.attrs[stun.attribute.XOR_MAPPED_ADDRESS]
    
    console.log('NAT Address:', addr)
    peer.push(addr);
});

// Sending STUN request
client1.request(onRequest);
