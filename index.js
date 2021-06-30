const { Readable, Writable } = require('stream')
const Ajv = require('ajv')

const ajv = new Ajv()
const isObjectLiteral = x => x?.constructor?.name === 'Object'

/**
 * @namespace
 *
 * @desc   Register a readable stream with jscribe.
 *         Callback is called when there's an error or a message received.
 *
 * @param  {stream.Readable} stream
 * @param  {Object}          [opts = {}]
 * @param  {Boolean}         [opts.destroyOnError = false] - destroy stream if there's an error
 * @param  {Number}          [opts.maxBufferSize = 0]      - in bytes (error in callback if exceeded)
 * @param  {Boolean}         [opts.once = false]           - callback can only be called once
 * @param  {Object}          [opts.schema]                 - JSON schema for message validation
 * @param  {Function}        cb                            - has signature `function (err, msg)`
 *
 * @return {stream.Readable}
 */
const jscribe = (stream, opts, cb) => {
  if (!(stream instanceof Readable)) {
    throw new Error('Expected stream to be a readable')
  }

  if (typeof opts === 'function') {
    [cb, opts] = [opts, {}]
  }

  if (typeof cb !== 'function') {
    throw new Error('Expected cb to be a function')
  }

  if (!isObjectLiteral(opts)) {
    throw new Error('Expected opts to be an object literal')
  }

  const invalidDestroyOnError = (
    opts.hasOwnProperty('destroyOnError') &&
    typeof opts.destroyOnError !== 'boolean'
  )

  if (invalidDestroyOnError) {
    throw new Error('Expected opts.destroyOnError to be a boolean')
  }

  const invalidMaxBufferSize = (
    opts.hasOwnProperty('maxBufferSize') &&
    (
      !Number.isInteger(opts.maxBufferSize) ||
      opts.maxBufferSize < 0
    )
  )

  if (invalidMaxBufferSize) {
    throw new Error('Expected opts.maxBufferSize to be a whole number')
  }

  const invalidOnce = (
    opts.hasOwnProperty('once') &&
    typeof opts.once !== 'boolean'
  )

  if (invalidOnce) {
    throw new Error('Expected opts.once to be a boolean')
  }

  const invalidSchema = (
    opts.hasOwnProperty('schema') &&
    !isObjectLiteral(opts.schema)
  )

  if (invalidSchema) {
    throw new Error('Expected opts.schema to be an object literal')
  }

  const destroyOnError = opts.destroyOnError || false
  const maxBufferSize = opts.maxBufferSize || 0
  const once = opts.once || false
  const validate = opts.schema && ajv.compile(opts.schema)

  let data = Buffer.alloc(0)
  let len = 0

  const handleData = chunk => {
    if (chunk) {
      data = Buffer.concat([data, chunk])

      if (maxBufferSize && data.byteLength > maxBufferSize) {
        cb(new Error(`handleData(): Exceeded maxBufferSize (${maxBufferSize / 1e3} KB)`))
        destroyOnError && stream.destroy()
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

        if (validate) {
          const valid = validate(msg)

          if (!valid) {
            const [error] = validate.errors
            cb(new Error('Message violates schema: ' + JSON.stringify(error, null, 2)))
            destroyOnError && stream.destroy()
            return
          }
        }

        cb(null, msg)
      } catch {
        cb(new Error(`Invalid JSON message: \`${str}\``))
        destroyOnError && stream.destroy()
      }
    }
  }

  const method = once ? 'once' : 'on'

  stream[method]('data', handleData)
  stream[method]('error', cb)

  return stream
}

/**
 * @func
 * @desc   Receive a message from a readable stream, with an optional timeout.
 *
 * @param  {stream.Readable} stream
 * @param  {Object}          [opts = {}]
 * @param  {Number}          [opts.timeout = 0] - in milliseconds (0 means no timeout)
 * @param  {*}               [opts....]         - other options for jscribe()
 *
 * @return {Promise}         resolves message {*}
 */
jscribe.receive = (stream, opts = {}) => {
  return new Promise((resolve, reject) => {
    if (!(stream instanceof Readable)) {
      reject(new Error('Expected stream to be a readable'))
      return
    }

    if (!isObjectLiteral(opts)) {
      throw new Error('Expected opts to be an object literal')
    }

    const timeout = opts.timeout || 0

    if (!Number.isInteger(timeout) || timeout < 0) {
      reject(new Error('Expected opts.timeout to be a whole number'))
      return
    }

    const cb = (err, msg) => err ? reject(err) : resolve(msg)

    jscribe(stream, { ...opts, once: true }, cb)

    timeout && setTimeout(() => {
      reject(new Error(`receive(): Timed out waiting for message (${timeout} ms)`))
    }, timeout)
  })
}

/**
 * @func
 * @desc   Write a message to a writable stream.
 *
 * @param  {stream.Writable} stream
 * @param  {*}               msg
 *
 * @return {Boolean}         see return value for stream#writable.write()
 *
 */
jscribe.send = (stream, msg) => {
  if (!(stream instanceof Writable)) {
    throw new Error('Expected stream to be a writable')
  }

  const payload = Buffer.from(JSON.stringify(msg))

  const len = Buffer.alloc(4)
  len.writeUint32BE(payload.byteLength)

  return stream.write(Buffer.concat([len, payload]))
}

module.exports = jscribe
