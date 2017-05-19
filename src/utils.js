const ILP_REGEX = /^[A-Za-z0-9\-_~.]+$/
const ILP_PREFIX_REGEX = /^[A-Za-z0-9\-_~.]+\.$/
const AMOUNT_REGEX = /^[1-9]\d*$/
const BASE64_URL_REGEX = /^[A-Za-z0-9\-_]$/
const UUID_REGEX = /^[0-9a-f]{8}\-([0-9a-f]{4}\-){3}[0-9a-f]{12}$/

function accountToUsername (factory, account) {
  const username = factory.ledgerContext.accountUriToName(account)
  if (!username) {
    throw new Error('account (' + account + ') cannot be parsed to an' +
      ' ILP address with ' + factory.ledgerContext.urls.ledger)
  }
  return username
}

function addressToAccount (config, factory, address) {
  const prefix = config.ilp_prefix
  if (!address.startsWith(prefix)) {
    throw new Error('address (' + address + ') does not match' +
      ' leger prefix (' + prefix + ')')
  }

  const username = address.split(prefix).split('.')[0]
  const account = factory.ledgerContext
    .urls.account.replace('/:name', '/' + username)

  return account
}

function makeExpiry (seconds) {
  const ms = new Date().getTime() + seconds * 1000
  return new Date(ms).toISOString()
}

module.exports = {
  ILP_REGEX,
  AMOUNT_REGEX,
  ILP_PREFIX_REGEX,
  BASE64_URL_REGEX,
  accountToUsername,
  makeExpiry
}
