/**
 * User: samoin
 * Date: 13-5-14
 * Time: 上午10:32
 * desc: code how to start server
 */
var cmdObj = {"connect":1 , "disconnect" : 2};
var cluster = require('cluster');
var server = function(){};
/**
 * logLv : socketio-loglevel
 * port : socketio-port
 * slaveCount : cluster-slavecount
 * transports : socketio-transports
 * syncSec : cluster-syncCurrentInfoToSlave
 *
 */
server.slave = {};
server.configrue = {logLv:0,port:443,slaveCount:1 , 'transports': ["websocket"],syncSec : 1};
server.serverCluster = {};
server.app = {};
server.url = {};
server.io = {};
server.fs = {};
var userMap = {};
var userMapAll = {};
var masterTalkSlaveKey = "mTalkS";
// add event listener to slave(process,worker)
server.configSlave = function(slave){
    var slavePid = slave.pid;
    console.log('slave ' + slavePid + ' created ...');
    // SLAVE will recieve message from cluster here
    slave.on('message', function(m) {
        if (m && m.pcmd) {
            if (m.pcmd == masterTalkSlaveKey) {
                //console.log(slave.pid + ':CHILD got message:', m);
                if(m.type == "sync"){
                    userMapAll = m.msg;
                    //console.log(process.pid ," get sync info from cluster : ", JSON.stringify(userMapAll));
                }
                if(m.type == "sync2"){
                    userMap = m.msg;
                    //console.log(process.pid ," get sync info from cluster : ", JSON.stringify(userMap));
                }
                if(m.type == "userconnect"){
                    console.log(process.pid ," get sync info from cluster : ", JSON.stringify(userMap));
                }
                if(m.type == "userdisconnect"){
                    console.log(process.pid ," get sync info from cluster : ", JSON.stringify(userMap));
                }
            }
        }
    });
    server.slave = slave;
    slave.send({pcmd : masterTalkSlaveKey ,  type:"connect" , pid : slave.pid});
}
// add evnet listener to cluster
server.addOnToSlave = function(slave){
    // cluster will recieve message from slave here
    slave.on('message', function(m) {
        if (m && m.pcmd) {
            if (m.pcmd == masterTalkSlaveKey) {
                //console .log(process.pid + ':PARENT got message:', m);
                if(m.type == "connect"){
                    server.emitAllSlave({pcmd : masterTalkSlaveKey  ,  type:"talk",msg :m.pid + " connected"});
                    if(!userMap[m.pid]){
                        userMap[m.pid] = {};
                    }
                }
                if(m.type == "disconnect"){
                    server.emitAllSlave({pcmd : masterTalkSlaveKey  ,  type:"talk",msg :m.pid + " disconnected"});
                    delete(userMap[m.pid]);
                }
                if(m.type == "msgs"){
                    //console.log("PARENT got msgs : " , m);
                    var cmd = m.msg.cmd;
                    var msg = m.msg.msg;
                    if(cmd == cmdObj["connect"]){
                        var uqKey = msg.uqKey;
                        var uName = msg.uName;
                        var module = msg.module;
                        var type = msg.type;
                        if(!userMap[m.pid][module]){
                             userMap[m.pid][module] = {};
                        }
                        if(!userMapAll[module]){
                            userMapAll[module] = {};
                        }
                        if(!userMap[m.pid][module][uqKey]){
                            userMap[m.pid][module][uqKey] = 0;
                        }
                        userMap[m.pid][module][uqKey] = userMap[m.pid][module][uqKey] + 1;
                        if(!userMapAll[module][uqKey]){
                            userMapAll[module][uqKey] = 0;
                        }
                        userMapAll[module][uqKey] = userMapAll[module][uqKey] + 1;
                    }
                    if(cmd == cmdObj["disconnect"]){
                        var uqKey = msg.uqKey;
                        var uName = msg.uName;
                        var module = msg.module;
                        var type = msg.type;
                        userMap[m.pid][module][uqKey] = userMap[m.pid][module][uqKey] - 1;
                        userMapAll[module][uqKey] = userMapAll[module][uqKey] - 1;
                    }
                }
            }
        }

    });
}
server.countUserMap =  function (userMapAll){
    var count = 0;
    var userMapEnd = {};
    for(key in userMapAll){
        var value = userMapAll[key];
        if(value instanceof Object){
            for(k in value){
                if(value[k] > 0){
                    count++;
                }
            }
            userMapEnd[key] = count;
            count=0;
        }

    }
    return userMapEnd;
}
// create server with cluster
server.createServer = function(configrue){
    if(configrue){
        server.configrue = configrue;
    }
    if (cluster.isMaster) {
        for ( var i = 0; i < server.configrue.slaveCount; i++) {
            var slave = cluster.fork();
            server.addOnToSlave(slave);
        }
        server.serverCluster = cluster.workers;
        //  this is for version 0.6.x
        cluster.on('death', function(worker) {
             addDeathEventToCluster(worker);
        });
        //  this is for version 0.8.x +
        cluster.on('exit', function(worker, code, signal) {
            addDeathEventToCluster(worker);
        });
        setInterval(function(){
            //console.log("sync info : ", JSON.stringify(userMap));
            server.emitAllSlave({pcmd : masterTalkSlaveKey , msg :server.countUserMap(userMapAll) , type:"sync"});
            server.emitAllSlave({pcmd : masterTalkSlaveKey , msg :userMap , type:"sync2"});
        } , 1000 * server.configrue.syncSec);
    } else if (cluster.isWorker){
        server.configSlave(process);
        server.createSlave(server.configrue);
        setInterval(function(){
            console.log(process.pid ," get sync info-userMapAll from cluster : ", JSON.stringify(userMapAll));
            console.log(process.pid ," get sync info-userMap from cluster : ", JSON.stringify(userMap));
        } , 1000 * server.configrue.syncSec);
    }
    // add dead event to cluster
    function addDeathEventToCluster(worker){
        var workerPid = worker.pid;
        if(!workerPid){
            workerPid = worker.process.pid;
        }
        delete (userMap[workerPid]);
        server.emitAllSlave({pcmd : masterTalkSlaveKey , pid :workerPid , type:"disconnect"});
        console.log('slave ' + workerPid + ' died , fork new slave ...');
        var slave = cluster.fork();
        server.addOnToSlave(slave);
    }
}
// tell all slave by msg
server.emitAllSlave = function (msgObj) {
    for(key in server.serverCluster){
        server.serverCluster[key].send(msgObj);
    }
}
// create one slave ,that provides serve by socket.io ,at port 443(common)
server.createSlave = function(configObj){
    server.app = require('http').createServer(server.handler);
    server.url = require('url');
    server.io = require('socket.io').listen(server.app);
    server.fs = require('fs');
    server.app.listen(configObj.port);

    server.io.set('log level', configObj.logLv);// see https://github.com/LearnBoost/Socket.IO/wiki/Configuring-Socket.IO

    server.io.configure(function() {
        server.io.set('transports', configObj.transports);
    });
    server.io.sockets.on('connection', function(socket) {
        socket.on('onlineList', function(data) {
            /**socket.emit('news', {
                cmd : 3,
                msg : JSON.stringify(userMap)
            });*/
        });
        socket.on('msgs', function(data) {
            //console.log(process.pid," " ,server.slave.pid," get msgs : " + JSON.stringify(data));
            socket["uqKey"] = data.msg["uqKey"];
            socket["uName"] = data.msg["uName"];
            socket["module"] = data.msg["module"];
            //console.log(socket["uqKey"] + ":" + socket["uName"] + ":" + socket["module"] );
            server.slave.send({pcmd : masterTalkSlaveKey ,  type:"msgs" , pid : server.slave.pid , msg : data});
        });
        socket.on('disconnect', function() {
            //console.log(socket["uqKey"] + ":" + socket["uName"] + ":" + socket["module"] );
            server.slave.send({pcmd : masterTalkSlaveKey ,  type:"msgs" , pid : server.slave.pid , msg : {cmd:cmdObj["disconnect"],msg:{uqKey:socket["uqKey"],uName:socket["uName"],module:socket["module"]}}});
        });
    });

    server.io.sockets.on('error', function() {
        console.log(">>> error");
    });
}
server.getWorkerByPid = function(pid){
    var worker;
    console.log(pid , server.serverCluster);
    for(key in server.serverCluster){
        var tmp = server.serverCluster[key];
        console.log(pid , "-" , tmp.pid, "-" ,tmp.process.pid );
        if(tmp.pid == pid || tmp.process.pid == pid){
            worker = tmp;
            break;
        }
    }
    return worker;
}
// provide http serve with socket.io
// http module
server.handler = function handler(req, res) {
    var path = server.url.parse(req.url).pathname;
    var params = getParams(server.url.parse(req.url).query);
    /**if (params) {
     console.log(">>> path : " + path + ", params : " +  JSON.stringify(params));
     }*/
    switch (path) {
        case '/all':
            res.writeHead(200, {
                'Content-Type' : 'text/html'
            });
            res.write(renderEndHtml(userMapAll));
            res.end();
            break;
        default:
            send404(res);
    }
}
function renderEndHtml(obj) {
    var str = "<script>";
    str += "var result = '" + JSON.stringify(obj) + "';";
    str += "result = decodeURI(result ,'utf-8');";
    str += "document.write(result);"
    str += "</script>";
    return str;
}
send404 = function(res) {
    res.writeHead(404);
    res.write('404');
    res.end();
};

function getParams(params) {
    if (params) {
        var arr1 = params.split("&");
        var map = {};
        for ( var i = 0; i < arr1.length; i++) {
            var arr2 = arr1[i].split("=");
            map[arr2[0]] = arr2.length > 1 ? arr2[1] : "";
        }
        return map;
    }
}
module.exports = {
    servers : server
}