'use strict'

const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
chai.use(chaiAsPromised)
const assert = chai.assert
const IlpPacket = require('ilp-packet')

const MockFactory = require('./mocks/mockFactory')
const MockCtx = require('./mocks/mockCtx')
const quoteSourceAmount = require('../src/controllers/quote-source-amount')

describe('/quoteSourceAmount', () => {
  beforeEach(function () {
    this.factory = new MockFactory()
    this.ctx = new MockCtx()
    this.config = {
      ilp_prefix: 'example.red.',
      admin: { username: 'admin' }
    }
    this.ctx.query = {
      destinationAddress: 'example.red.bob',
      sourceAmount: '10.00',
      connectorAccount: 'http://example.com/accounts/connie',
      destinationScale: '9',
    }
  })

  it('should throw error without a destinationAddress', async function () {
    delete this.ctx.query.destinationAddress
    await assert.isRejected(
      quoteSourceAmount(this.config, this.factory, this.ctx),
      /400.*missing query parameter destinationAddress/)
  })

  it('should throw error without a sourceAmount', async function () {
    delete this.ctx.query.sourceAmount
    await assert.isRejected(
      quoteSourceAmount(this.config, this.factory, this.ctx),
      /400.*missing query parameter sourceAmount/)
  })

  it('should throw error without a destinationScale', async function () {
    delete this.ctx.query.destinationScale
    await assert.isRejected(
      quoteSourceAmount(this.config, this.factory, this.ctx),
      /400.*missing query parameter destinationScale/)
  })

  it('should throw on invalid destination ILP address', async function () {
    this.ctx.query.destinationAddress = '$$$'
    await assert.isRejected(
      quoteSourceAmount(this.config, this.factory, this.ctx),
      /400.*destinationAddress \(\$\$\$\) is an invalid ILP address/)
  })

  it('should throw on invalid source amount', async function () {
    this.ctx.query.sourceAmount = 'invalid'
    await assert.isRejected(
      quoteSourceAmount(this.config, this.factory, this.ctx),
      /400.*sourceAmount \(invalid\) is an invalid decimal amount/)
  })

  it('should throw if there is no connectorAccount', async function () {
    delete this.ctx.query.connectorAccount
    await assert.isRejected(
      quoteSourceAmount(this.config, this.factory, this.ctx),
      /400.*missing both query parameter connectorAccount/)
  })

  it('should throw on invalid destinationScale', async function () {
    this.ctx.query.destinationScale = 'invalid'
    await assert.isRejected(
      quoteSourceAmount(this.config, this.factory, this.ctx),
      /400.*destinationScale \(invalid\) is an invalid integer/)
  })

  it('should quote to local destination', async function () {
    await quoteSourceAmount(this.config, this.factory, this.ctx)

    assert.deepEqual(this.ctx.body, {
      destinationAmount: '0.0001',
      connectorAccount: 'http://example.com/accounts/bob',
      sourceExpiryDuration: '10'
    })
  })

  it('should quote to connector account', async function () {
    this.ctx.query.destinationAddress = 'example.blue.alice'
    this.factory.plugin.sendRequest = (msg) => {
      assert.equal(msg.ledger, 'example.red.')
      assert.equal(msg.to, 'example.red.connie')
      return Promise.resolve({
        ledger: 'example.red.',
        to: 'example.red.bob',
        from: 'example.red.connie',
        ilp: IlpPacket.serializeIlqpBySourceResponse({
          destinationAmount: '200000',
          sourceHoldDuration: 10000
        })
      })
    }

    await quoteSourceAmount(this.config, this.factory, this.ctx)

    assert.deepEqual(this.ctx.body, {
      destinationAmount: '0.0002',
      connectorAccount: 'http://example.com/accounts/connie',
      sourceExpiryDuration: '10'
    })
  })
})
