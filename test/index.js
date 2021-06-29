const assert = require('assert')
const stream = require('stream')
const FakeTimers = require('@sinonjs/fake-timers')
const jscribe = require('..')

describe('jscribe', () => {
  beforeEach(() => {
    this.clock = FakeTimers.install()
    this.msg = { foo: 'bar', baz: true }
    this.stream = new stream.PassThrough()
  })

  afterEach(() => {
    this.clock.uninstall()
  })

  describe('#register()', () => {
    it('returns stream', () => {
      const result = jscribe.register(this.stream, () => {})
      assert.deepStrictEqual(result, this.stream)
    })

    it('throws if stream isn\'t readable', () => {
      try {
        jscribe.register({})
        assert.fail('Should throw')
      } catch ({ message }) {
        assert.strictEqual(message, 'stream must be a readable')
      }
    })

    it('throws if cb isn\'t function', () => {
      try {
        jscribe.register(this.stream, [])
        assert.fail('Should throw')
      } catch ({ message }) {
        assert.strictEqual(message, 'cb must be a function')
      }
    })

    it('throws if opts isn\'t object literal', () => {
      try {
        jscribe.register(this.stream, Object.create(null), () => {})
        assert.fail('Should throw')
      } catch ({ message }) {
        assert.strictEqual(message, 'opts must be an object literal')
      }
    })

    it('throws if opts.maxBufferSize isn\'t whole number', () => {
      try {
        jscribe.register(this.stream, { maxBufferSize: -1 }, () => {})
        assert.fail('Should throw')
      } catch ({ message }) {
        assert.strictEqual(message, 'opts.maxBufferSize must be a whole number')
      }
    })

    it('throws if opts.once isn\'t boolean', () => {
      try {
        jscribe.register(this.stream, { once: 1 }, () => {})
        assert.fail('Should throw')
      } catch ({ message }) {
        assert.strictEqual(message, 'opts.once must be a boolean')
      }
    })

    it('handles message', async () => {
      let cb

      const promise = new Promise((resolve, reject) => {
        cb = (err, msg) => {
          err ? reject(err) : resolve(msg)
        }
      })

      jscribe.register(this.stream, cb, true)
      this.stream.write(Buffer.from([0, 0, 0, 1, '1'.charCodeAt(0)]))

      const msg = await promise
      assert.strictEqual(msg, 1)
    })

    it('errors if message invalid', async () => {
      let cb

      const promise = new Promise((resolve, reject) => {
        cb = (err, msg) => {
          err ? reject(err) : resolve(msg)
        }
      })

      jscribe.register(this.stream, { once: true }, cb)
      this.stream.write(Buffer.from([0, 0, 0, 2, '"'.charCodeAt(0), '1'.charCodeAt(0)]))

      try {
        await promise
        assert.fail('Should reject')
      } catch ({ message }) {
        assert.strictEqual(message, 'Invalid JSON message: `"1`')
      }
    })

    it('errors if maxBufferSize exceeded', async () => {
      let cb

      const promise = new Promise((resolve, reject) => {
        cb = (err, msg) => {
          err ? reject(err) : resolve(msg)
        }
      })

      const opts = {
        maxBufferSize: 5,
        once: true
      }

      jscribe.register(this.stream, opts, cb)
      this.stream.write(Buffer.from([0, 0, 0, 2, '1'.charCodeAt(0), '2'.charCodeAt(0)]))

      try {
        await promise
        assert.fail('Should reject')
      } catch ({ message }) {
        assert.strictEqual(message, 'handleData(): exceeded maxBufferSize (0.005 KB)')
      }
    })
  })

  describe('#send()', () => {
    it('sends message', async () => {
      let cb

      const promise = new Promise((resolve, reject) => {
        cb = (err, msg) => {
          err ? reject(err) : resolve(msg)
        }
      })

      jscribe.register(this.stream, cb, true)
      jscribe.send(this.stream, this.msg)

      const result = await promise

      assert.deepStrictEqual(result, this.msg)
    })

    it('throws if stream not writable', () => {
      try {
        jscribe.send({})
        assert.fail('Should throw')
      } catch ({ message }) {
        assert.strictEqual(message, 'stream must be a writable')
      }
    })
  })

  describe('#receive()', () => {
    it('receives message', async () => {
      const promise = jscribe.receive(this.stream)

      jscribe.send(this.stream, this.msg)

      const result = await promise

      assert.deepStrictEqual(result, this.msg)
    })

    it('throws if stream not readable', async () => {
      const EventEmitter = require('events')

      try {
        await jscribe.receive(new EventEmitter())
        assert.fail('Should throw')
      } catch ({ message }) {
        assert.strictEqual(message, 'stream must be a readable')
      }
    })

    it('throws if timeout not whole number', async () => {
      try {
        await jscribe.receive(this.stream, 10.1)
        assert.fail('Should throw')
      } catch ({ message }) {
        assert.strictEqual(message, 'timeout must be a whole number')
      }
    })

    it('times out', async () => {
      const promise = jscribe.receive(this.stream, 10)

      this.clock.tick(10)

      try {
        await promise
        assert.fail('Should reject')
      } catch ({ message }) {
        assert.strictEqual(message, 'receive(): Timed out waiting for message (10 ms)')
      }
    })

    it('rejects if invalid message', async () => {
      const promise = jscribe.receive(this.stream)

      this.stream.write(Buffer.from([0, 0, 0, 2, '"'.charCodeAt(0), '1'.charCodeAt(0)]))

      try {
        await promise
        assert.fail('Should reject')
      } catch ({ message }) {
        assert.strictEqual(message, 'Invalid JSON message: `"1`')
      }
    })
  })
})
