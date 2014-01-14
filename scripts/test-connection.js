var HOST =          "michaelfogleman.com";
var PORT =          4080;

var connection =    require("../connection").open( HOST, PORT );

connection.on( "U", console.log );
connection.on( "N", console.log );
connection.on( "T", console.log );

var talk =          connection.send.bind( this, "T" );

/// Start REPL: ----------------------------------------------------------------

console.log([
    "---------------------------------------------------------------------------------------",
    "This is a script to interactively test connection module.",
    "You should shortly connect to the server and see some of the data the server sends you.",
    "To communicate with the server, use 'connection' object and 'talk()' function.",
    "---------------------------------------------------------------------------------------",
    ].join( "\n" ));

global.connection = connection;
global.talk =       talk;

require( "repl" ).start({
    prompt:         ">> ",
    useGlobal:      true,
}).on( "exit", process.exit.bind( process, 0 ));
