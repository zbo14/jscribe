const { Readable, Writable } = require('stream')

/** @module jscribe */

/**
 * Register a readable stream with jscribe.
 * The callback is called when there's an error or a message.
 *
 * @param  {stream.Readable} stream
 * @param  {Object}          [opts = {}]
 * @param  {Number}          [opts.maxBufferSize = 0] - in bytes (error in callback if exceeded)
 * @param  {Boolean}         [opts.once = false]      - callback can only be called once
 * @param  {Function}        cb                       - has signature (err, msg)
 *
 * @return {stream.Readable}
 */
const register = (stream, opts, cb) => {
  if (!(stream instanceof Readable)) {
    throw new Error('stream must be a readable')
  }

  if (typeof opts === 'function') {
    [cb, opts] = [opts, {}]
  }

  if (typeof cb !== 'function') {
    throw new Error('cb must be a function')
  }

  if (opts?.constructor?.name !== 'Object') {
    throw new Error('opts must be an object literal')
  }

  const invalidMaxBufferSize = (
    opts.hasOwnProperty('maxBufferSize') &&
    (
      !Number.isInteger(opts.maxBufferSize) ||
      opts.maxBufferSize < 0
    )
  )

  if (invalidMaxBufferSize) {
    throw new Error('opts.maxBufferSize must be a whole number')
  }

  const invalidOnce = (
    opts.hasOwnProperty('once') &&
    typeof opts.once !== 'boolean'
  )

  if (invalidOnce) {
    throw new Error('opts.once must be a boolean')
  }

  const maxBufferSize = opts.maxBufferSize || 0
  const once = opts.once || false

  let data = Buffer.alloc(0)
  let len = 0

  const handleData = chunk => {
    if (chunk) {
      data = Buffer.concat([data, chunk])

      if (maxBufferSize && data.byteLength > maxBufferSize) {
        cb(new Error(`handleData(): exceeded maxBufferSize (${maxBufferSize / 1e3} KB)`))
        return
      }
    }

    if (!len && data.byteLength >= 4) {
      len = data.readUint32BE()
    }

    if (len && data.byteLength - 4 >= len) {
      const str = data.slice(4, 4 + len).toString()

      data = data.slice(4 + len)
      len = 0

      handleData()

      try {
        const msg = JSON.parse(str)
        cb(null, msg)
      } catch {
        cb(new Error(`Invalid JSON message: \`${str}\``))
      }
    }
  }

  const method = once ? 'once' : 'on'

  stream[method]('data', handleData)
  stream[method]('error', cb)

  return stream
}

/**
 * Receive a single message from a readable stream, with an optional timeout.
 *
 * @param  {stream.Readable} stream
 * @param  {Number}          [timeout = 0] - in milliseconds (0 means no timeout)
 *
 * @return {Promise} resolves msg {*}
 */
const receive = (stream, timeout = 0) => {
  return new Promise((resolve, reject) => {
    if (!(stream instanceof Readable)) {
      reject(new Error('stream must be a readable'))
      return
    }

    if (!Number.isInteger(timeout) || timeout < 0) {
      reject(new Error('timeout must be a whole number'))
      return
    }

    const cb = (err, msg) => err ? reject(err) : resolve(msg)

    register(stream, cb, true)

    timeout && setTimeout(() => {
      reject(new Error(`receive(): Timed out waiting for message (${timeout} ms)`))
    }, timeout)
  })
}

/**
 * Write a message to a writable stream.
 *
 * @param  {stream.Writable} stream
 * @param  {*}               msg
 *
 * @return {Boolean} see return value for writable.write()
 */
const send = (stream, msg) => {
  if (!(stream instanceof Writable)) {
    throw new Error('stream must be a writable')
  }

  const payload = Buffer.from(JSON.stringify(msg))

  const len = Buffer.alloc(4)
  len.writeUint32BE(payload.byteLength)

  return stream.write(Buffer.concat([len, payload]))
}

module.exports = {
  register,
  receive,
  send
}
