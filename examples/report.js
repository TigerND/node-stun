/* -*- coding: utf-8 -*-
============================================================================= */
/*jshint asi: true*/

var dgram = require('dgram'),
    stun  = require('../lib');

var peer = [];

// STUN Server (by Google)
//var port = 19302;
//var host = 'stun.l.google.com';

// STUN Server (by PlexRay)
var port = 3478;
//var host = 'stun.plexrayinc.com'; // IPv4 & IPv6
//var host = 'stun4.plexrayinc.com'; // IPv4 Only
var host = 'stun6.plexrayinc.com'; // IPv6 Only
//var host = '79.143.181.186'; // IPv4 Address
//var host = '2a02:c200:0:10:2:3:3407:1'; // IPv6 Address

var onRequest = function(err, bytes) {
    if (err) {
        console.log('Failed to send a STUN packet');
    } else {
        console.log('Sent a STUN packet (size is ' + bytes + ')');
    }
};

var onError = function(err) {
    console.log('Error:', err);
};

// Create STUN Client 
var client1 = stun.connect(port, host, function() {
    client1.on('error', onError);

    // Client1: STUN Response event handler
    client1.on('response', function(packet){
        console.log('Received STUN packet:', packet);
        
        var addr = packet.address
        
        console.log('NAT Address:', addr)
        peer.push(addr);
    });
    
    // Sending STUN request
    client1.request(onRequest);
})

var dummy = dgram.createSocket('udp4')
dummy.bind(1234);