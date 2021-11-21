const WebSocket = require('ws')
const http = require('http')
const wss = new WebSocket.Server({ noServer: true })
const server = http.createServer()
const jwt = require('jsonwebtoken')

const timeInterval = 1000
//多聊天室的功能
//roomid ->对应想要的roomid进行广播消息
let group = {}
wss.on('connection', function connection (ws) {
  ws.isAlive = true
  //初始的心跳连接状态
  console.log('one client is connected');

  //接收客户端的消息
  ws.on('message', function (msg) {
    const msgObj = JSON.parse(msg)
    if (msgObj.event === 'enter') {
      ws.name = msgObj.message
      ws.roomid = msgObj.roomid
      if (typeof group[ws.roomid] === 'undefined') {
        group[ws.roomid] = 1
      } else {
        group[ws.roomid]++
      }

    }

    //鉴权
    if (msgObj.event === 'auth') {
      jwt.verify(msgObj.message, 'secret', (err, decode) => {
        if (err) {
          //webSocket返回前端鉴权失败的消息
          ws.send(JSON.stringify({
            event: 'noauth',
            message: 'please auth again'
          }))
          console.log('auth error');
          return
        } else {
          //鉴权通过
          console.log(decode);
          ws.isAuth = true
          return
        }
      })
      return
    }

    //拦截非鉴权的请求
    if (!ws.isAuth) {

      return
    }

    //心跳检测
    if (msgObj.event === 'heartbeat' && msgObj.message === 'pong') {
      ws.isAlive = true
      return
    }
    //主动发送消息给客户端
    // ws.send('server:' + msg)

    //广播
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN && client.roomid === ws.roomid) {
        msgObj.name = ws.name
        msgObj.num = group[ws.roomid]
        client.send(JSON.stringify(msgObj))
      }

    })
  })


  ws.on('close', () => {
    if (ws.name) {
      group[ws.roomid]--
    }


    let msgObj = {}
    //广播
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN && client.roomid === ws.roomid) {
        msgObj.name = ws.name
        msgObj.num = group[ws.roomid]
        msgObj.event = 'out'
        client.send(JSON.stringify(msgObj))
      }

    })
  })
})

server.on('upgrade', function upgrade (request, socket, head) {
  console.log('TCL:upgrade -> request', request.headers);
  // This function is not defined on purpose. Implement it with your own logic.
  // authenticate(request, (err, client) => {
  //   if (err || !client) {
  //     socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
  //     socket.destroy();
  //     return;
  //   }

  wss.handleUpgrade(request, socket, head, function done (ws) {
    wss.emit('connection', ws, request);
  });
  // });
});

server.listen(3000);

setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive && ws.roomid) {
      console.log('in');
      group[ws.roomid]--
      delete ws['roomid']
      //终止或关闭websocket
      return ws.terminate()
    }
    //主动发送心跳请求
    //当客户端返回了消息之后，设置flag为在线
    ws.isAlive = false
    ws.send(JSON.stringify({
      event: 'heartbeat',
      message: 'ping',
      num: group[ws.roomid]
    }))
  })
}, timeInterval)