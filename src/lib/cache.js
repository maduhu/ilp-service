'use strict'
const debug = require('debug')('ilp-service:cache')
const CACHE_TIMEOUT = 60000

module.exports = class Cache {
  constructor () {
    this._callbacks = {}
    this._timeouts = {}
    this._expiries = {}
    this._cache = {}
  }

  _timeout (key, expiryCallback, expiry) {
    this._callbacks[key] = expiryCallback
    this._timeouts[key] = setTimeout(() => {
      try {
        expiryCallback()

        delete this._callbacks[key]
        delete this._timeouts[key]
        delete this._cache[key]
      } catch (e) {
        debug('error on cache expiry callback:', e)
      }
    }, expiry
      ? (Date.parse(expiry) - Date.now().getTime())
      : CACHE_TIMEOUT)
    this._expiries[key] = expiry ||
      new Date(Date.now().getTime() + CACHE_TIMEOUT).toISOString()
  }

  put (key, value, expiryCallback, expiry) {
    this._timeout(key, expiryCallback, expiry)

    debug('adding', key, 'to cache')
    this._cache[key] = value
  }

  get (key, expiry) {
    if (!this._cache[key]) return

    if (!expiry || Date.parse(expiry) > Date.parse(this._expiries[key])) {
      debug('bumping expiry of', key, 'to', expiry)
      clearTimeout(this._timeouts[key])
      this._timeout(key, this._callbacks[key])
    }

    return this._cache[key]
  }
}
