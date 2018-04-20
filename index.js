const insights = require('applicationinsights')
insights.setup('465adfc2-7b7b-49c7-ad85-880e9d6884c9') // replace with your own ikey here
insights.start()

const app = require('express')()
const http = require('http').Server(app)
const io = require('socket.io')(http)
const knex = require('knex')
const path = require('path')

const port = process.env.PORT || 3000

function trackException () {
  console.log('throw custom exception')
  insights.defaultClient.trackException({ exception: new Error('test error') })
  setTimeout(trackException, 60000)
}
trackException()

const db = require('knex')({
  dialect: 'sqlite3',
  connection: { filename: path.join(__dirname, './messages.db') }
})

// passes initial message data to connected socket
async function init () {
  const messages = await db.table('messages').select('url').limit(100).orderBy('created_at', 'desc')
  return messages
}

async function main () {
  try {
    await db.schema.createTable('messages', function (table) {
      table.increments('id')
      table.string('url')
      table.timestamp('created_at')
    })
  } catch (error) {
    // swallow error like a pro 😎
  }

  app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html')
  })

  app.get('/cleanup', function (req, res) {
    // TODO implement db cleanup...
    res.send({ ok: true })
  })

  io.on('connection', function (socket) {
    init().then(msg => socket.emit('init', msg))

    socket.on('chat message', async function (msg) {
      const start = process.hrtime()
      db.table('messages').insert({ url: msg, created_at: db.fn.now() }).then(() => null)
      io.emit('chat message', msg)
      const elapsed = process.hrtime(start)
      insights.defaultClient.trackRequest({ name: 'chat message', url: 'https://gab-2018-chat.azurewebsites.net/', duration: elapsed[0] * 1000 + elapsed[1] / 1000000, resultCode: 200, success: true })
    })
  })

  http.listen(port, function () {
    console.log(`listening on *:${port}`)
  })
}

main()
