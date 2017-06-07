'use strict'

const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
chai.use(chaiAsPromised)
const assert = chai.assert

const ILP = require('ilp')
const utils = require('../src/utils')
const MockFactory = require('./mocks/mockFactory')
const MockCtx = require('./mocks/mockCtx')
const quoteIpr = require('../src/controllers/quote-ipr')

describe('/quoteIpr', () => {
  beforeEach(function () {
    this.factory = new MockFactory()
    this.ctx = new MockCtx()
    this.config = {
      ilp_prefix: 'example.red.',
      admin: { username: 'admin' }
    }
    this.ipr = utils.base64url(ILP.IPR.createIPR({
      destinationAmount: '1000',
      destinationAccount: 'http://example.com/accounts/bob',
      receiverSecret: Buffer.from('secret')
    }))
    this.ctx.query = {
      ipr: this.ipr,
      connectorAccount: 'http://example.com/accounts/connie'
    }
  })

  it('should throw error without an ipr', async function () {
    delete this.ctx.query.ipr
    await assert.isRejected(
      quoteIpr(this.config, this.factory, this.ctx),
      /400.*missing query parameter ipr/)
  })

  it('should throw error without connectorAccount', async function () {
    delete this.ctx.query.connectorAccount
    await assert.isRejected(
      quoteIpr(this.config, this.factory, this.ctx),
      /400.*missing both query parameter connectorAccount/)
  })

  it('should throw error on invalid IPR', async function () {
    this.ctx.query.ipr = 'invalid=='
    await assert.isRejected(
      quoteIpr(this.config, this.factory, this.ctx),
      /400.*ipr \(invalid==\) contains invalid base64url/)
  })

  it('should throw error on malformed IPR data', async function () {
    this.ctx.query.ipr = '252839502385214135235235'
    await assert.isRejected(quoteIpr(this.config, this.factory, this.ctx))
  })

  it('should quote to local destination', async function () {
    this.ctx.query.ipr = utils.base64url(ILP.IPR.createIPR({
      destinationAmount: '1000',
      destinationAccount: 'example.red.bob',
      receiverSecret: Buffer.from('secret')
    }))

    await quoteIpr(this.config, this.factory, this.ctx)
    assert.deepEqual(this.ctx.body, {
      sourceAmount: '0.1',
      connectorAccount: 'http://example.com/accounts/bob',
      sourceExpiryDuration: 10
    })
  })

  it('should quote to connector account', async function () {
    this.factory.plugin.sendMessage = (msg) => {
      assert.equal(msg.ledger, 'example.red.')
      assert.equal(msg.to, 'example.red.connie')
      assert.equal(msg.data.method, 'quote_request')
      setImmediate(() => {
        this.factory.plugin.emit('incoming_message', {
          ledger: 'example.red.',
          to: 'example.red.bob',
          data: {
            method: 'quote_response',
            id: msg.data.id,
            data: {
              source_amount: '200000',
              source_connector_account: 'example.red.connie',
              destination_address: 'example.blue.bob'
            }
          },
        })
      })
      return Promise.resolve()
    }

    await quoteIpr(this.config, this.factory, this.ctx)

    assert.deepEqual(this.ctx.body, {
      sourceAmount: '20',
      connectorAccount: 'http://example.com/accounts/connie',
      sourceExpiryDuration: 10
    })
  })
})
