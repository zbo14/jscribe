'use strict'

const EventEmitter = require('events')
const net = require('net')
const jscribe = require('.')

const main = async () => {
  const server = net.createServer()

  server.listen(12345)

  const serverPromise = EventEmitter
    .once(server, 'connection')
    .then(([conn]) => conn)

  const clientConn = net.connect(12345)
  const clientPromise = EventEmitter.once(clientConn, 'connect')
  const [serverConn] = await Promise.all([serverPromise, clientPromise])

  const promise = jscribe.receive(clientConn, {
    maxBufferSize: 4096,
    timeout: 3e3
  })

  const opts = {
    maxBufferSize: 4096,

    schema: {
      type: 'object',

      properties: {
        foo: { type: 'integer' },
        bar: { type: 'string' }
      },

      required: ['foo'],
      additionalProperties: false
    }
  }

  jscribe(serverConn, opts, (err, msg) => {
    if (err) {
      console.error('[SERVER]', err)
      return
    }

    jscribe.send(serverConn, { baz: true })
    console.log('[SERVER]', 'Message from client:', JSON.stringify(msg))
  })

  jscribe.send(clientConn, { bar: 'baz' })
  jscribe.send(clientConn, { foo: 1, bar: 'baz' })

  const msg = await promise

  console.log('[CLIENT]', 'Message from server:', JSON.stringify(msg))
  process.exit()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
