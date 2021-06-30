const assert = require('assert')
const stream = require('stream')
const FakeTimers = require('@sinonjs/fake-timers')
const jscribe = require('..')

describe('jscribe', () => {
  beforeEach(() => {
    this.clock = FakeTimers.install()
    this.msg = { foo: 1, bar: 'baz' }
    this.stream = new stream.PassThrough()

    this.schema = {
      type: 'object',

      properties: {
        foo: { type: 'integer' },
        bar: { type: 'string' }
      },

      required: ['foo'],
      additionalProperties: false
    }
  })

  afterEach(() => {
    this.clock.uninstall()
  })

  describe('#jscribe()', () => {
    it('returns stream', () => {
      const result = jscribe(this.stream, () => {})
      assert.deepStrictEqual(result, this.stream)
    })

    it('throws if stream isn\'t readable', () => {
      try {
        jscribe({})
        assert.fail('Should throw')
      } catch ({ message }) {
        assert.strictEqual(message, 'Expected stream to be a readable')
      }
    })

    it('throws if cb isn\'t function', () => {
      try {
        jscribe(this.stream, [])
        assert.fail('Should throw')
      } catch ({ message }) {
        assert.strictEqual(message, 'Expected cb to be a function')
      }
    })

    it('throws if opts isn\'t object literal', () => {
      try {
        jscribe(this.stream, Object.create(null), () => {})
        assert.fail('Should throw')
      } catch ({ message }) {
        assert.strictEqual(message, 'Expected opts to be an object literal')
      }
    })

    it('throws if opts.destroyOnError isn\'t boolean', () => {
      try {
        jscribe(this.stream, { destroyOnError: Symbol('ok') }, () => {})
        assert.fail('Should throw')
      } catch ({ message }) {
        assert.strictEqual(message, 'Expected opts.destroyOnError to be a boolean')
      }
    })

    it('throws if opts.maxBufferSize isn\'t whole number', () => {
      try {
        jscribe(this.stream, { maxBufferSize: -1 }, () => {})
        assert.fail('Should throw')
      } catch ({ message }) {
        assert.strictEqual(message, 'Expected opts.maxBufferSize to be a whole number')
      }
    })

    it('throws if opts.once isn\'t boolean', () => {
      try {
        jscribe(this.stream, { once: 1 }, () => {})
        assert.fail('Should throw')
      } catch ({ message }) {
        assert.strictEqual(message, 'Expected opts.once to be a boolean')
      }
    })

    it('throws if opts.schema isn\'t object literal', () => {
      try {
        jscribe(this.stream, { schema: [] }, () => {})
        assert.fail('Should throw')
      } catch ({ message }) {
        assert.strictEqual(message, 'Expected opts.schema to be an object literal')
      }
    })

    it('handles message', async () => {
      let cb

      const promise = new Promise((resolve, reject) => {
        cb = (err, msg) => {
          err ? reject(err) : resolve(msg)
        }
      })

      jscribe(this.stream, cb, true)
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

      jscribe(this.stream, { once: true }, cb)
      this.stream.write(Buffer.from([0, 0, 0, 2, '"'.charCodeAt(0), '1'.charCodeAt(0)]))

      try {
        await promise
        assert.fail('Should reject')
      } catch ({ message }) {
        assert.strictEqual(message, 'Invalid JSON message: `"1`')
      }

      assert.strictEqual(this.stream.destroyed, false)
    })

    it('errors if message invalid and destroys stream', async () => {
      let cb

      const promise = new Promise((resolve, reject) => {
        cb = (err, msg) => {
          err ? reject(err) : resolve(msg)
        }
      })

      jscribe(this.stream, { destroyOnError: true, once: true }, cb)
      this.stream.write(Buffer.from([0, 0, 0, 2, '"'.charCodeAt(0), '1'.charCodeAt(0)]))

      try {
        await promise
        assert.fail('Should reject')
      } catch ({ message }) {
        assert.strictEqual(message, 'Invalid JSON message: `"1`')
      }

      assert.strictEqual(this.stream.destroyed, true)
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

      jscribe(this.stream, opts, cb)
      this.stream.write(Buffer.from([0, 0, 0, 2, '1'.charCodeAt(0), '2'.charCodeAt(0)]))

      try {
        await promise
        assert.fail('Should reject')
      } catch ({ message }) {
        assert.strictEqual(message, 'handleData(): Exceeded maxBufferSize (0.005 KB)')
      }

      assert.strictEqual(this.stream.destroyed, false)
    })

    it('errors if maxBufferSize exceeded and destroys stream', async () => {
      let cb

      const promise = new Promise((resolve, reject) => {
        cb = (err, msg) => {
          err ? reject(err) : resolve(msg)
        }
      })

      const opts = {
        destroyOnError: true,
        maxBufferSize: 5,
        once: true
      }

      jscribe(this.stream, opts, cb)
      this.stream.write(Buffer.from([0, 0, 0, 2, '1'.charCodeAt(0), '2'.charCodeAt(0)]))

      try {
        await promise
        assert.fail('Should reject')
      } catch ({ message }) {
        assert.strictEqual(message, 'handleData(): Exceeded maxBufferSize (0.005 KB)')
      }

      assert.strictEqual(this.stream.destroyed, true)
    })
  })

  describe('#jscribe.send()', () => {
    it('sends message', async () => {
      let cb

      const promise = new Promise((resolve, reject) => {
        cb = (err, msg) => {
          err ? reject(err) : resolve(msg)
        }
      })

      jscribe(this.stream, cb, true)
      jscribe.send(this.stream, this.msg)

      const result = await promise

      assert.deepStrictEqual(result, this.msg)
    })

    it('throws if stream not writable', () => {
      try {
        jscribe.send({})
        assert.fail('Should throw')
      } catch ({ message }) {
        assert.strictEqual(message, 'Expected stream to be a writable')
      }
    })
  })

  describe('#jscribe.receive()', () => {
    it('receives message', async () => {
      const promise = jscribe.receive(this.stream)

      jscribe.send(this.stream, this.msg)

      const result = await promise

      assert.deepStrictEqual(result, this.msg)
    })

    it('receives message that satisfies schema', async () => {
      const promise = jscribe.receive(this.stream, { schema: this.schema })

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
        assert.strictEqual(message, 'Expected stream to be a readable')
      }
    })

    it('throws if opts not object literal', async () => {
      try {
        await jscribe.receive(this.stream, Object.create(null))
        assert.fail('Should throw')
      } catch ({ message }) {
        assert.strictEqual(message, 'Expected opts to be an object literal')
      }
    })

    it('throws if opts.timeout not whole number', async () => {
      try {
        await jscribe.receive(this.stream, { timeout: 10.1 })
        assert.fail('Should throw')
      } catch ({ message }) {
        assert.strictEqual(message, 'Expected opts.timeout to be a whole number')
      }
    })

    it('times out', async () => {
      const promise = jscribe.receive(this.stream, { timeout: 10 })

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

      assert.strictEqual(this.stream.destroyed, false)
    })

    it('rejects if message violates schema', async () => {
      const promise = jscribe.receive(this.stream, { schema: this.schema })

      jscribe.send(this.stream, { foo: 1, baz: 1 })

      try {
        await promise
        assert.fail('Should reject')
      } catch ({ message }) {
        assert(message.startsWith('Message violates schema:'))
        assert(message.includes('should NOT have additional properties'))
      }

      assert.strictEqual(this.stream.destroyed, false)
    })

    it('rejects if message violates schema and destroys stream', async () => {
      const promise = jscribe.receive(this.stream, {
        destroyOnError: true,
        schema: this.schema
      })

      jscribe.send(this.stream, { bar: 'baz' })

      try {
        await promise
        assert.fail('Should reject')
      } catch ({ message }) {
        assert(message.startsWith('Message violates schema:'))
        assert(message.includes('should have required property \'foo\''))
      }

      assert.strictEqual(this.stream.destroyed, true)
    })
  })
})
