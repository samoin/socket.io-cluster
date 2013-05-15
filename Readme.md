# socket.io-cluster

socket.io-cluster is a Node.JS project that used socket.io , by cluster ,it can provide more connections

## How to Install

```bash
npm install socket.io-cluster
```

## How to use

var server = require("./server");
var onlineServers = server.servers;
onlineServers.createServer();//if you want change configuration , site a proObject here

#### Server side

```js
var server = require("./server");
var onlineServers = server.servers;
onlineServers.createServer({logLv:0,port:443,slaveCount:2, 'transports': ["websocket", 'flashsocket' , "xhr-polling" , "jsonp-polling"],syncSec : 10});
```

#### Client side

```html
<script>
  var socket = io.connect('http://localhost:443');

  socket.on('connect', function () {
    socket.emit('set nickname', prompt('What is your nickname?'));
    socket.on('ready', function () {
      console.log('Connected !');
      socket.emit('msg', prompt('What is your message?'));
    });
  });
</script>
```

