'use strict'
const EventEmitter = require('events')

module.exports = class MockFactory {
  constructor (opts) {
    this.ledgerContext = {}
    this.ledgerContext.accountUriToName = function (account) {
      if (account) return 'alice'
    }

    const info = {
      prefix: 'example.red.',
      connectors: ['example.red.mark'],
      currencyCode: 'USD',
      currencySymbol: '$',
      currencyScale: 4 
    }

    this.ledgerContext.getInfo = () => info
    this.ledgerContext.urls = {
      account: 'http://example.com/accounts/:name'
    }
    this.plugin = Object.assign(
      new EventEmitter(),
      { account: 'example.red.bob',
        getAccount: () => 'example.red.bob',
        connect: () => Promise.resolve(),
        getInfo: () => info }
    )
  }

  connect () {
    return Promise.resolve(null)
  }

  create () {
    return Promise.resolve(this.plugin)
  }

  remove () {
    return Promise.resolve(null)
  }
}
