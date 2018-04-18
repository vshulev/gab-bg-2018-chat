const app = require('express')()
const http = require('http').Server(app)
const io = require('socket.io')(http)
const knex = require('knex')
const path = require('path')

const port = process.env.PORT || 3000

const db = require('knex')({
  dialect: 'sqlite3',
  connection: { filename: path.join(__dirname, '../messages.db') }
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

  io.on('connection', function (socket) {
    init().then(msg => socket.emit('init', msg))

    socket.on('chat message', async function (msg) {
      db.table('messages').insert({ url: msg, created_at: db.fn.now() }).then(() => null)
      io.emit('chat message', msg)
    })
  })

  http.listen(port, function () {
    console.log(`listening on *:${port}`)
  })
}

main()
