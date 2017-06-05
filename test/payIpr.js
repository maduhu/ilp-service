'use strict'

const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
chai.use(chaiAsPromised)
const assert = chai.assert

const ILP = require('ilp')
const utils = require('../src/utils')
const MockFactory = require('./mocks/mockFactory')
const MockCtx = require('./mocks/mockCtx')
const payIpr = require('../src/controllers/pay-ipr')

describe('/payIpr', () => {
  beforeEach(function () {
    this.factory = new MockFactory()
    this.ctx = new MockCtx()
    this.config = {
      ilp_prefix: 'example.red.',
      admin: { username: 'admin' }
    }
    this.ipr = utils.base64url(ILP.IPR.createIPR({
      destinationAmount: '1000',
      destinationAccount: 'example.blue.bob',
      receiverSecret: Buffer.from('secret')
    }))
    this.ctx.request.body = {
      ipr: this.ipr,
      sourceAmount: '1000',
      sourceAccount: 'example.red.bob',
      sourceExpiryDuration: '10',
      connectorAccount: 'example.red.connie'
    }
  })

  it('should throw error without an ipr', async function () {
    delete this.ctx.request.body.ipr
    await assert.isRejected(
      payIpr(this.config, this.factory, this.ctx),
      /400.*missing JSON body field ipr/)
  })

  it('should throw error without a sourceAmount', async function () {
    delete this.ctx.request.body.sourceAmount
    await assert.isRejected(
      payIpr(this.config, this.factory, this.ctx),
      /400.*missing JSON body field sourceAmount/)
  })

  it('should throw error without a sourceExpiryDuration', async function () {
    delete this.ctx.request.body.sourceExpiryDuration
    await assert.isRejected(
      payIpr(this.config, this.factory, this.ctx),
      /400.*missing JSON body field sourceExpiryDuration/)
  })

  it('should throw error without connectorAccount', async function () {
    delete this.ctx.request.body.connectorAccount
    await assert.isRejected(
      payIpr(this.config, this.factory, this.ctx),
      /400.*missing JSON body field connectorAccount/)
  })
})
