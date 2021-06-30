# jscribe

Small library for sending and receiving JSON over streams. Data validation à la [JSON schema](https://json-schema.org/) included.

Especially useful with TCP, TLS, and IPC sockets.

## Install

Requires [Node 14.x](https://nodejs.org/dist/latest-v14.x/) or later.

`npm i jscribe`

## Usage

[Here](./example.js)'s a full example with a TCP server + client.

**Register stream with callback:**

```js
const jscribe = require('jscribe')

const stream = getReadableStream()

const opts = {
  destroyOnError: false,
  maxBufferSize: 4096,
  once: false,
  schema: null // JSON schema for message validation
}

// called when there's an error or
// each time a new message is received
const cb = (err, msg) => { ... }

jscribe(stream, opts, cb)

// or

jscribe(stream, cb)
```

**Send a message:**

```js
const jscribe = require('jscribe')

const stream = getWritableStream()
const msg = { foo: 1, bar: 'baz' }

jscribe.send(stream, msg)
```

**Receive a message:**

```js
const jscribe = require('jscribe')

const stream = getReadableStream()
const opts = { timeout: 3e3, ... } // includes opts for jscribe()

jscribe.receive(stream, opts)
  .then(msg => { ... })
  .catch(err => { ... })
```

## Documentation

To generate the docs:

`npm run docs`

Then open `out/index.html` in your browser.

## Tests

`npm test`

## Linting

`npm run lint`
