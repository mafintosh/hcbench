const noise = require('noise-peer')
const network = require('@hyperswarm/network')
const jsonStream = require('duplex-json-stream')
const hypercore = require('hypercore')
const pump = require('pump')

const swarm = network()
const hyperswarm = network()

const serverTopic = 'a9a5544b217d38cc0165d3fce9381e38464025d26d1e7e38c4ce4a729e73410b'
const publicKey = Buffer.from(serverTopic, 'hex')
const feeds = new Map()
const client = noise.keygen()

swarm.on('connection', function (stream) {
  const encryptedStream = noise(stream, true, {
    pattern: 'XK',
    staticKeyPair: client,
    remoteStaticKey: publicKey
  })

  encryptedStream.on('error', (err) => {
    console.error(err)
  })

  encryptedStream.write(Buffer.from('my-id'))

  encryptedStream.once('readable', function () {
    var hello = JSON.parse(encryptedStream.read().toString())
    if (hello.error) {
      console.log(hello.message)
      process.exit(1)
    }
    const feed = hypercore(`./local/test`, hello.key)

    pump(encryptedStream, feed.replicate({ live: true }), encryptedStream)
  })
})

swarm.join(publicKey, {
  announce: false,
  lookup: true
})
