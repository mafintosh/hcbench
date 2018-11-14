const noise = require('noise-peer')
const network = require('@hyperswarm/network')
const jsonStream = require('duplex-json-stream')
const hypercore = require('hypercore')
const protocol = require('hypercore-protocol')
const pump = require('pump')

const server = noise.seedKeygen(Buffer.alloc(32, 'secret'))

console.log(server.publicKey.toString('hex'))

const swarm = network()
const hyperswarm = network()
const feeds = new Map()

swarm.on('connection', function (stream) {
  const encryptedStream = noise(stream, false, {
    pattern: 'XK',
    staticKeyPair: server,
    onstatickey: function (remoteKey, done) {
      console.log('new client key:', remoteKey)
      done()
    }
  })

  encryptedStream.on('error', (err) => {
    console.error(err)
  })

  encryptedStream.once('readable', function () {
    var id = encryptedStream.read()

    if (!id.equals(Buffer.from('my-id'))) {
      encryptedStream.end(JSON.stringify({
        error: true,
        message: 'Auth failed. Goodbye'
      }))

      return
    }

    console.log(id)
    // do something with id

    const feed = hypercore(`./remote/test`)
    feed.ready((err) => {
      if (encryptedStream.destroyed) return
      if (err) return encryptedStream.destroy(err)

      encryptedStream.write(JSON.stringify({
        key: feed.key.toString('hex')
      }))

      pump(encryptedStream, feed.replicate({ live: true }), encryptedStream, function (err) {
        console.log('replication ended', err)
      })

      const key = feed.key.toString('hex')
      console.log(key)

      feed.append('important history data')
    })
  })
})

swarm.join(server.publicKey, {
  announce: true,
  lookup: false
})
