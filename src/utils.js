const debug = require('debug')('ilp-service:utils')
const ILP_REGEX = /^[A-Za-z0-9\-_~.]+$/
const ILP_PREFIX_REGEX = /^[A-Za-z0-9\-_~.]+\.$/
const AMOUNT_REGEX = /^[1-9]\d*$/
const BASE64_URL_REGEX = /^[A-Za-z0-9\-_]*$/
const UUID_REGEX = /^[0-9a-f]{8}\-([0-9a-f]{4}\-){3}[0-9a-f]{12}$/

function accountToUsername (factory, account, ctx) {
  try {
    const username = factory.ledgerContext.accountUriToName(account)
    if (!username) throw new Error('parsed username: ' + username)
    return username
  } catch (e) {
    debug(e.message)
    return ctx.throw('account (' + account + ') cannot be parsed to an' +
      ' ILP address with ' + factory.ledgerContext.urls.account, 400)
  }
}

function addressToAccount (config, factory, address, ctx) {
  const prefix = config.ilp_prefix
  if (!address.startsWith(prefix)) {
    return ctx.throw('address (' + address + ') does not match' +
      ' leger prefix (' + prefix + ')')
  }

  const username = address.split(prefix)[1].split('.')[0]
  const account = factory.ledgerContext
    .urls.account.replace('/:name', '/' + username)

  return account
}

function makeExpiry (seconds) {
  const ms = new Date().getTime() + seconds * 1000
  return new Date(ms).toISOString()
}

function base64url (buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

module.exports = {
  ILP_REGEX,
  AMOUNT_REGEX,
  ILP_PREFIX_REGEX,
  BASE64_URL_REGEX,
  accountToUsername,
  addressToAccount,
  base64url,
  makeExpiry
}
