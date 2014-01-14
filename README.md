# craft-client

NodeJS client modules for [Craft](fogleman/Craft).

## Usage

Right now only *connection* module is available:

```javascript
var connection =    require( "craft-client/connection" );
var myConn =          connection.open( "michaelfogleman.com", 4080 );
myConn.on( "T", console.log );
myConn.send( "T", "Hi, players!" );
myConn.close();
```

See `scripts/test-connection` for more details.

## About

### License

This is free software, and you are welcome to redistribute it under certain conditions; see LICENSE.txt for details.

### Author

Emilis Dambauskas <emilis.d@gmail.com>, <http://emilis.github.io/>.
