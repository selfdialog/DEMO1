const WebSocket = require('ws')
const http = require('http')
const wss = new WebSocket.Server({ noServer: true })
const server = http.createServer()
const jwt = require('jsonwebtoken')

//多聊天室的功能
//roomid ->对应想要的roomid进行广播消息
let group = {}
wss.on('connection', function connection (ws) {
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
          console.log('auth error');
          return
        } else {
          //鉴权通过
          console.log(decode);
          ws.isAuth = true
          return
        }
      })
    }

    //拦截非鉴权的请求
    if (!ws.isAuth) {
      ws.send(JSON.stringify({
        event: 'noauth',
        message: 'please auth again'
      }))
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