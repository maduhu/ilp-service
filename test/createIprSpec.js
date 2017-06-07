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
const createIpr = require('../src/controllers/create-ipr')

describe('/createIpr', () => {
  beforeEach(function () {
    this.factory = new MockFactory()
    this.cache = {}
    this.cache.get = () => false
    this.cache.put = () => {}
    this.ctx = new MockCtx()
    this.config = {
      ilp_prefix: 'example.red.',
      admin: { username: 'admin' },
      connector: 'http://example.com/accounts/connie',
      secret: Buffer.from('secret'),
      backend_url: 'http://example.com/backend'
    }
    this.connector = {}
    this.ctx.request.body = {
      paymentId: 'be569853-5ef1-4153-bf17-64477a534f5b',
      destinationAmount: '1000',
      destinationAccount: 'http://example.com/accounts/alice',
      expiresAt: new Date(Date.now() + 10000).toISOString()
    }
  })

  it('should throw error without a paymentId', async function () {
    delete this.ctx.request.body.paymentId
    await assert.isRejected(
      createIpr(this.config, this.factory, this.cache, this.connector, this.ctx),
      /400.*missing JSON body field paymentId/)
  })

  it('should throw error without an expiresAt', async function () {
    delete this.ctx.request.body.expiresAt
    await assert.isRejected(
      createIpr(this.config, this.factory, this.cache, this.connector, this.ctx),
      /400.*missing JSON body field expiresAt/)
  })

  it('should throw error without a destinationAccount', async function () {
    delete this.ctx.request.body.destinationAccount
    await assert.isRejected(
      createIpr(this.config, this.factory, this.cache, this.connector, this.ctx),
      /400.*missing JSON body field destinationAccount/)
  })

  it('should throw error without a destinationAmount', async function () {
    delete this.ctx.request.body.destinationAmount
    await assert.isRejected(
      createIpr(this.config, this.factory, this.cache, this.connector, this.ctx),
      /400.*missing JSON body field destinationAmount/)
  })

  it('should throw error with invalid destinationAmount', async function () {
    this.ctx.request.body.destinationAmount = 'invalid'
    await assert.isRejected(
      createIpr(this.config, this.factory, this.cache, this.connector, this.ctx),
      /400.*destinationAmount \(invalid\) is an invalid decimal amount/)
  })

  it('should throw error with invalid paymentId', async function () {
    this.ctx.request.body.paymentId = '193042342-423523-42432-4324'
    await assert.isRejected(
      createIpr(this.config, this.factory, this.cache, this.connector, this.ctx),
      /400.*paymentId \(193042342\-423523\-42432\-4324\) is an invalid uuid/)
  })

  it('should return an IPR', async function () {
    this.cache.get = () => true

    await createIpr(this.config, this.factory, this.cache, this.connector, this.ctx),
    assert.isString(this.ctx.body.ipr)
    assert.match(this.ctx.body.ipr, /^[A-Za-z\-_0-9]+$/)
  })

  it('should begin listening if the cache doesn\'t hit', async function () {
    this.cache.get = () => false
    this.cache.put = () => {}

    assert.equal(this.factory.plugin.listenerCount('incoming_prepare'), 0)
    await createIpr(this.config, this.factory, this.cache, this.connector, this.ctx),
    assert.equal(this.factory.plugin.listenerCount('incoming_prepare'), 1)

    assert.isString(this.ctx.body.ipr)
    assert.match(this.ctx.body.ipr, /^[A-Za-z\-_0-9]+$/)
  })

  it('should fulfill an incoming transfer', async function () {
    // one for the prepare
    nock('http://example.com')
      .post('/backend/notifications')
      .reply(200)

    // one for the fulfill
    nock('http://example.com')
      .post('/backend/notifications')
      .reply(200)

    this.factory.plugin.getAccount = () => 'example.red.alice'
    await createIpr(this.config, this.factory, this.cache, this.connector, this.ctx)

    const parsed = ILP.IPR.decodeIPR(Buffer.from(this.ctx.body.ipr, 'base64'))

    this.factory.plugin.getAccount = () => 'example.red.alice'
    this.factory.plugin.emit('incoming_prepare', {
      to: 'example.red.alice',
      from: 'exmample.red.connie',
      amount: '10000000',
      ilp: parsed.packet,
      executionCondition: parsed.condition
    })

    const fulfilled = new Promise((resolve) => {
      this.factory.plugin.fulfillCondition = () => {
        resolve()
        return Promise.resolve()
      }
    })

    await fulfilled
  })

  it('should fulfill connector source transfer first', async function () {
    // one for the prepare
    nock('http://example.com')
      .post('/backend/notifications')
      .reply(200)

    // one for the fulfill
    nock('http://example.com')
      .post('/backend/notifications')
      .reply(200)

    this.factory.plugin.getAccount = () => 'example.red.alice'
    await createIpr(this.config, this.factory, this.cache, this.connector, this.ctx)

    const parsed = ILP.IPR.decodeIPR(Buffer.from(this.ctx.body.ipr, 'base64'))

    this.factory.plugin.getAccount = () => 'example.red.alice'
    this.factory.plugin.emit('incoming_prepare', {
      to: 'example.red.alice',
      from: 'example.red.connie',
      amount: '10000000',
      ilp: parsed.packet,
      executionCondition: parsed.condition
    })

    let state = 'nobody fulfilled'
    const connectorFulfilled = new Promise((resolve, reject) => {
      if (state !== 'nobody fulfilled') return reject(state)
      state = 'connector fulfilled'
      this.connector.fulfillCondition = () => {
        resolve()
        return Promise.resolve()
      }
    })

    const fulfilled = new Promise((resolve, reject) => {
      if (state !== 'connector fulfilled') return reject(state)
      state = 'plugin fulfilled'
      this.factory.plugin.fulfillCondition = () => {
        resolve()
        return Promise.resolve()
      }
    })

    await connectorFulfilled
    await fulfilled
  })

  it('should not fulfill receiver transfer if connector fails', async function () {
    // one for the prepare
    nock('http://example.com')
      .post('/backend/notifications')
      .reply(200)

    this.factory.plugin.getAccount = () => 'example.red.alice'
    await createIpr(this.config, this.factory, this.cache, this.connector, this.ctx)

    const parsed = ILP.IPR.decodeIPR(Buffer.from(this.ctx.body.ipr, 'base64'))

    this.connector.fulfillCondition = () => {
      return Promise.reject(new Error('could not fulfill!'))
    }

    const receiverRejected = new Promise((resolve, reject) => {
      this.factory.plugin.fulfillCondition = () => {
        reject(new Error('should not fulfill destination'))
      }
      this.factory.plugin.rejectIncomingTransfer = () => {
        resolve()
        return Promise.resolve()
      }
    })

    this.factory.plugin.getAccount = () => 'example.red.alice'
    this.factory.plugin.emit('incoming_prepare', {
      to: 'example.red.alice',
      from: 'example.red.connie',
      amount: '10000000',
      ilp: parsed.packet,
      executionCondition: parsed.condition
    })

    await receiverRejected
  })
})
