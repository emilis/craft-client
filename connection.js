/*
    Copyright 2014 Emilis Dambauskas

    This file is part of craft-client for NodeJS.

    craft-client is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    craft-client is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with craft-client. If not, see <http://www.gnu.org/licenses/>.
*/

/*
    This module keeps a persistent connection to the game server, reconnects
     when needed and emits events for packets sent from server.
*/

/// Requirements: --------------------------------------------------------------

var events =    require( "events" );
var net =       require( "net" );

/// Constants: -----------------------------------------------------------------

var ENCODING =          "ascii";
var MSGSEP =            0x0a;
var ENDMSG =            String.fromCharCode( MSGSEP );
var ARGSEP =            ",";
var RECONNECT_DELAY =   10000;
var KEEPALIVE =         30000;
var TIMEOUT =           60000;
var VERSION =           1;

var parsers =   {
    U:  "IFFFFF",
    N:  "IS",
    P:  "IFFFFF",
    D:  "I",
    B:  "IIIIII",
    C:  "III",
    K:  "III",
    S:  "IIIIIIS",
    /// Not needed, as handled automaticly:
    /// V:  "S",
    /// T:  "S",
};

/// Exports: -------------------------------------------------------------------

module.exports =    {
    open:           openConnection
};

/// openConnection: ------------------------------------------------------------

function openConnection( host, port, onConnectCb ){

    var socket;
    var emitter;

    var connected =     false;
    var closed =        false;
    var connecting =    false;

    var keepalive;
    var sendQueue =     [];
    var lastBuffer;

    emitter =   new events.EventEmitter();
    emitter.on( "error", debug.bind( this, "Emitting error." ));
    onConnectCb && emitter.on( "reconnect", onConnectCb );

    connect();

    keepalive =     setInterval( sendVersion, KEEPALIVE );

    return {
        on:         emitter.on.bind( emitter ),
        once:       emitter.once.bind( emitter ),
        off:        emitter.removeListener.bind( emitter ),
        close:      close,
        send:       send,
        /// for debug only:
        emitter:    emitter,
        socket:     socket,
        keepalive:  keepalive,
    };

    /// Functions: -------------------------------------------------------------

    function close(){

        closed =     true;
        connected = false;

        socket.end();
        socket.destroy();
        emitter.removeAllListeners();
    }///

    function send(){

        sendQueue.push( Array.prototype.slice.call( arguments ));
        process.nextTick( processQueue );
    }///

    function processQueue(){

        try {
            while ( socket && connected && sendQueue.length ){
                socket.write( pack( sendQueue.shift() ));
            }
        } catch (e) {
            onError( e );
        }
    }///

    function connect(){

        if ( closed || connecting ){
            return;
        }

        connected = false;
        socket =    new net.Socket();

        socket.on( "connect",   onConnect );
        socket.on( "data",      onData );
        socket.on( "drain",     onDrain );

        socket.on( "end",       onEnd );
        socket.on( "close",     onClose );

        socket.on( "timeout",   onTimeout );
        socket.on( "error",     onError );

        socket.setTimeout( TIMEOUT );
        socket.setKeepAlive( true, KEEPALIVE );

        try {
            debug( "Connecting to", host, port );
            socket.connect( port, host );
        } catch (e){
            debug( "Failed to connect to", host, port );
        }
    }///

    function onConnect(){

        connected =     true;
        connecting =    false;
        emitter.emit( "connect" );
        emitter.emit( "reconnect" );
        debug( "Socket connected to", host, port );
    }///

    function onData( data ){

        if ( !connected || closed ){
            return;
        }

        emitter.emit( "data", data );

        var len =       data.length;
        var lastStart = 0;

        for ( var i=0; i<len; i++ ){
            if ( data[i] === MSGSEP ){
                if ( lastStart || !lastBuffer ){
                    onMsg( data.toString( ENCODING, lastStart, i ));
                } else {
                    onMsg( Buffer.concat([ lastBuffer, data.slice( 0, i )], lastBuffer.length + i ).toString( ENCODING ));
                    lastBuffer = false;
                }
                lastStart = i + 1;
            }
        }

        if ( lastStart !== len ){
            if ( lastStart ){
                lastBuffer =    new Buffer( len - lastStart );
                data.copy( lastBuffer, 0, lastStart, len );
            } else {
                lastBuffer =    Buffer.concat([ lastBuffer, data ], lastBuffer.length + len );
            }
        }
    }///

    /**
     *  This should receive strings with newlines removed.
     */
    function onMsg( str ){

        var cmd =       str[0];

        if ( str[1] !== ARGSEP ){
            onMsgError( "Command is longer than 1 char.", str );
        } else if ( parsers[cmd] ){
            emitter.emit.apply( emitter, parseCmd( cmd, str ));
        } else {
            emitter.emit( cmd, str.slice( 2 ));
        }
        
    }///


    function parseCmd( cmd, str ){
            
        var parser =            parsers[cmd];
        var data =              [ cmd ];
        var strStart =          2;
        var strEnd;
        var arg;

        for ( var pi=0,plen=parser.length; pi<plen; pi++ ){
            if ( parser[pi] === "S" ){

                data.push( str.slice( strStart ));
                return data;
            } else {

                if ( strEnd === -1 ){
                    onMsgError( "Parsing after last comma?", strStart, strEnd, arg, str );
                }
                
                strEnd =        str.indexOf( ARGSEP, strStart );
                if ( strEnd === -1 ){
                    arg =       str.slice( strStart );
                } else {
                    arg =       str.slice( strStart, strEnd );
                    strStart =  strEnd + 1;
                }

                if ( parser[pi] === "F" ){
                    arg =       parseFloat( arg );
                } else if ( parser[pi] === "I" ){
                    arg =       parseInt( arg, 10 );
                }

                if ( isNaN( arg )){
                    throw onMsgError( "Argument is not a number.", arg, str );
                } else {
                    data.push( arg );
                }
            }
        }

        return data;
    }///

    function onMsgError( str ){

        var msg =   "Unable to parse server message: " + Array.prototype.join.call( arguments, "/" );
        onError( msg );
        return new Error( msg );
    }///


    function onDrain(){

        emitter.emit( "drain" );
    }///

    function onEnd(){

        connected = false;
        emitter.emit( "end" );
    }///

    function onClose(){

        connected = false;
        debug( "Socket disconnected from", host, port );
        emitter.emit( "close" );
        closed || setTimeout( connect, RECONNECT_DELAY );
    }///

    function onTimeout(){

        connected = false;
        emitter.emit( "timeout" );
        try {
            socket.destroy();
        } catch (e){
            debug( "#onTimeout", "Error destroying socket", host, port );
        }
    }///

    function onError( msg ){

        connected = false;
        debug( "Socket error", host, port, msg );
        emitter.emit( "error", msg );

        try {
            socket.destroy();
        } catch (e){
            debug( "#onError", "Error destroying socket", host, port, msg );
        }
    }///

    function sendVersion(){

        if ( connected ){
            send( "V", VERSION );
        }
    }///
}///

/// Other functions: -----------------------------------------------------------

function pack( msg ){

    return new Buffer( msg.join( ARGSEP ) + ENDMSG, ENCODING );
}///

function debug(){

    var args =  Array.prototype.slice.call( arguments, 0 );
    args.unshift( module.id );
    console.info.apply( console, args );
}///
