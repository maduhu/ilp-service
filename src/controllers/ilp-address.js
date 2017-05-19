const utils = require('../utils')
const debug = require('debug')('ilp-service:ilp-address')

module.exports = async function ilpAddress (config, factory, ctx) {
  const { account } = ctx.query
  debug('call /ilpAddress with', ctx.query)

  if (!account) {
    throw new Error('missing query parameter account')
  }

  const address = config.ilp_prefix + utils.accountToUsername(factory, connectorAccount))
  debug('returning', address)

  ctx.body = { address }
}
