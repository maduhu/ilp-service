'use strict'

const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
chai.use(chaiAsPromised)
const assert = chai.assert
const nock = require('nock')

const ILP = require('ilp')
const utils = require('../src/utils')
const MockFactory = require('./mocks/mockFactory')
const MockCtx = require('./mocks/mockCtx')
const { listenAll, incomingPaymentCallback } = require('../src/lib/listen-all')

describe('listenAll', () => {
  beforeEach(function () {
    this.config = {
      ilp_prefix: 'example.red.',
      admin: { username: 'admin' },
      connector: 'http://ledger.example/accounts/connie',
      secret: Buffer.from('secret'),
      backend_url: 'http://ledger.example/backend'
    }
    this.connector = {}
    this.factory = new MockFactory()
    this.incomingCallback = incomingPaymentCallback
      .bind(null, this.config, this.factory, 'example.red.connie', this.connector)

    this.incomingOpts = {
      transfer: {
        id: 'f5062f1b-e82a-37c8-b17d-50ea17aab3f0',
        amount: 100,
        to: 'example.red.alice',
        from: 'example.red.bob',
        ilp: 'RQCmfP2QT9C0gQAodzPuDl1it4lAL2tnec6ehWENIoA',
        executionCondition: 'itnG8nDowV8Q5VJ6hwEhc5R61oiSNQggmxI8NvF6PhI',
        expiresAt: new Date(Date.now() + 10000).toISOString()
      },
      fulfillment: 'z-RjEbgpNJ72-oTUByoJz4IhnuvXAGbBfbb2YRxNBuw',
      publicHeaders: {
        'payment-id': '85a0ca0a-99cf-a40d-0c8c-5000de998a20'
      },
      fulfill: () => {
        this.factory.emit('incoming_fulfill')
        return Promise.resolve()
      }
    }
  })

  it('should create a listener on the factory', async function () {
    assert.equal(this.factory.listenerCount('incoming_prepare'), 0)
    await listenAll(this.config, this.factory, this.connector) 
    assert.equal(this.factory.listenerCount('incoming_prepare'), 1)
  })

  it('should throw without a payment id', async function () {
    delete this.incomingOpts.publicHeaders['payment-id']
    await assert.isRejected(
      this.incomingCallback(this.incomingOpts),
      /missing public header Payment-Id/)
  })

  it('should throw with an invalid payment id', async function () {
    this.incomingOpts.publicHeaders['payment-id'] = 'foo'
    await assert.isRejected(
      this.incomingCallback(this.incomingOpts),
      /public header Payment-Id is an invalid uuid/)
  })

  it('should send data to the backend', async function () {
    this.incomingOpts.data = Buffer.from(JSON.stringify({ foo: 'bar' }))

    const fulfilled = new Promise((res) => this.factory.on('incoming_fulfill', res))
    nock('http://ledger.example') // on payment prepare
      .post('/backend/notifications', {
        paymentId: "85a0ca0a-99cf-a40d-0c8c-5000de998a20",
        ipr: "AorZxvJw6MFfEOVSeocBIXOUetaIkjUIIJsSPDbxej4SIEUApnz9kE_QtIEAKHcz7g5dYreJQC9rZ3nOnoVhDSKA",
        destinationAccount: "http://example.com/accounts/alice",
        data: { foo: 'bar' },
        status: "prepared" })
      .reply(200)
    
    nock('http://ledger.example') // on payment fulfill
      .post('/backend/notifications')
      .reply(200)

    await this.incomingCallback(this.incomingOpts)
    await fulfilled
  })

  it('should not send data to the backend if it is not JSON-parseable', async function () {
    this.incomingOpts.data = Buffer.from('undefined')

    const fulfilled = new Promise((res) => this.factory.on('incoming_fulfill', res))
    nock('http://ledger.example') // on payment prepare
      .post('/backend/notifications', {
        paymentId: "85a0ca0a-99cf-a40d-0c8c-5000de998a20",
        ipr: "AorZxvJw6MFfEOVSeocBIXOUetaIkjUIIJsSPDbxej4SIEUApnz9kE_QtIEAKHcz7g5dYreJQC9rZ3nOnoVhDSKA",
        destinationAccount: "http://example.com/accounts/alice",
        status: "prepared" })
      .reply(200)
    
    nock('http://ledger.example') // on payment fulfill
      .post('/backend/notifications')
      .reply(200)

    await this.incomingCallback(this.incomingOpts)
    await fulfilled
  })

  it('should notify backend and fulfill', async function () {
    const fulfilled = new Promise((res) => this.factory.on('incoming_fulfill', res))
    nock('http://ledger.example') // on payment prepare
      .post('/backend/notifications', {
        paymentId: "85a0ca0a-99cf-a40d-0c8c-5000de998a20",
        ipr: "AorZxvJw6MFfEOVSeocBIXOUetaIkjUIIJsSPDbxej4SIEUApnz9kE_QtIEAKHcz7g5dYreJQC9rZ3nOnoVhDSKA",
        destinationAccount: "http://example.com/accounts/alice",
        status: "prepared" })
      .reply(200)

    nock('http://ledger.example') // on payment fulfill
      .post('/backend/notifications', {
        fulfillment:"z-RjEbgpNJ72-oTUByoJz4IhnuvXAGbBfbb2YRxNBuw",
        paymentId:"85a0ca0a-99cf-a40d-0c8c-5000de998a20",
        ipr:"AorZxvJw6MFfEOVSeocBIXOUetaIkjUIIJsSPDbxej4SIEUApnz9kE_QtIEAKHcz7g5dYreJQC9rZ3nOnoVhDSKA",
        destinationAccount:"http://example.com/accounts/alice",
        status: "executed" })
      .reply(200)
    
    await this.incomingCallback(this.incomingOpts)
    await fulfilled
  })

  it('should fulfill the connector first if the from connector', async function () {
    nock('http://ledger.example')
      .post('/backend/notifications')
      .reply(200)
      .post('/backend/notifications')
      .reply(200)

    // make this from connector
    this.incomingOpts.transfer.from = 'example.red.connie'

    let state = 'nothing yet'
    this.connector.fulfillCondition = () => {
      if (state === 'nothing yet') {
        state = 'connector fulfill'
      } else {
        throw new Error('expected nothing yet, got ' + state)
      }
      return Promise.resolve()
    }

    this.factory.on('incoming_fulfill', () => {
      if (state === 'connector fulfill') {
        state = 'both fulfill'
      } else {
        throw new Error('expected connector fulfill, got ' + state)
      }
    })

    await this.incomingCallback(this.incomingOpts)
    assert.equal(state, 'both fulfill', 'connector should fulfill, then factory')
  })

  it('should not fulfill if the backend rejects', async function () {
    nock('http://ledger.example')
      .post('/backend/notifications')
      .reply(400, 'bad request')

    const fulfilled = new Promise((res, rej) => {
      this.factory.on('incoming_fulfill', () => {
        rej(new Error('should not fulfill if backend fails'))
      })
      setTimeout(res, 100)
    })

    // swallow error response
    await this.incomingCallback(this.incomingOpts)
      .catch((e) => assert.equal(e.message, 'bad request'))
    await fulfilled
  })

  it('should not fulfill receiver if connector fulfill fails', async function () {
    nock('http://ledger.example')
      .post('/backend/notifications')
      .reply(200)

    // make this from connector
    this.incomingOpts.transfer.from = 'example.red.connie'

    this.factory.on('incoming_fulfill', () => {
      throw new Error('receiver fulfill should not be reached')
    })

    this.connector.fulfillCondition = () => {
      return Promise.reject(new Error('failed to fulfill'))
    }

    await this.incomingCallback(this.incomingOpts)
      .catch((e) => assert.equal(e.message, 'failed to fulfill'))
  })
})
