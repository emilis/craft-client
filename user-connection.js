/// Requirements: --------------------------------------------------------------

var connection =    require( "./connection" );
var request =       require( "request" );

/// Constants: -----------------------------------------------------------------

var AUTH_URL =      "https://craft.michaelfogleman.com/api/1/identity";

/// Exports: -------------------------------------------------------------------

module.exports =    {
    open:           openConnection,
    wrap:           wrapConnection,
    getAuthToken:   getAuthToken,
};

/// Functions: -----------------------------------------------------------------

function openConnection( host, port, username, identityToken ){

    var conn =  connection.open( host, port );

    return wrapConnection( conn, username, identityToken );
}///

function wrapConnection( conn, username, identityToken ){

    var userInfo =  {
        pid:    0,
        name:   "",
        x:      0,
        y:      0,
        z:      0,
        rx:     0,
        ry:     0
    };

    conn.on( "connect", identify );
    conn.on( "U", onUserInfo );
    conn.on( "P", onPlayerPos );
    conn.on( "N", onPlayerNick );
    conn.on( "T", onText );

    var api =       Object.create( conn );
    api.info =      userInfo;
    api.identify =  identify;

    return api;

    function identify(){

        getAuthToken( username, identityToken, onAuthToken );
    }///

    function onAuthToken( err, authToken ){

        err || conn.send( "A", username, authToken );
    }///

    function onUserInfo( pid, x, y, z, rx, ry ){

        userInfo.pid =  pid;
        conn.emit( "user/pid", username, pid );
        updatePos.apply( this, arguments );
    }///

    function updatePos( pid, x, y, z, rx, ry ){

        userInfo.x =    x;
        userInfo.y =    y;
        userInfo.z =    z;
        userInfo.rx =   rx;
        userInfo.ry =   ry;

        conn.emit( "user/position", userInfo.name, x, y, z, rx, ry );
    }///

    function onPlayerPos( pid, x, y, z, rx, ry ){

        if ( pid === userInfo.pid ){
            updatePos.apply( this, arguments );
        }
    }///

    function onPlayerNick( pid, name ){

        if ( pid === userInfo.pid ){
            userInfo.name = name;
            conn.emit( "user/name", username, name, pid );
        }
    }///

    function onText( text ){

        if ( userInfo.name ){
            var privMsg = text.match( new RegExp( "^(\\S+)> @" + userInfo.name + "\\s+(.*)$" ));

            if ( privMsg ){
                conn.emit( "user/private-message", userInfo.name, privMsg[1], privMsg[2] );
            }
        }
    }///
}///

function getAuthToken( username, identityToken, cb ){

    request.post( AUTH_URL, { form: { username:username, identity_token:identityToken }}, onPost );

    function onPost( err, response, body ){

        if ( err || !body || response.statusCode !== 200 ){
            cb( err, response );
        } else {
            cb( err, body );
        }
    }///
}///
