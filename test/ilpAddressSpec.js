'use strict'

const assert = require('chai').assert
const MockFactory = require('./mocks/mockFactory')
const MockCtx = require('./mocks/mockCtx')
const ilpAddress = require('../src/controllers/ilp-address')

describe('/ilpAddress', () => {
  beforeEach(function () {
    this.factory = new MockFactory()
    this.ctx = new MockCtx()
    this.config = { ilp_prefix: 'example.red.' }
  })

  it('should return an ILP address', async function () {
    this.ctx.query = { account: 'https://example.com/accounts/alice' }
    await ilpAddress(this.config, this.factory, this.ctx)
    assert.deepEqual(this.ctx.body, { address: 'example.red.alice' })
  })

  it('should throw an error without an account', async function () {
    this.ctx.query = {}

    try {
      await ilpAddress(this.config, this.factory, this.ctx)
      assert(false, 'ilpAddress should have thrown')
    } catch (e) {
      assert(e.message.startsWith('400'), 'should be error 400')
      assert.match(e.message, /missing query parameter account/)
    }
  })
})
