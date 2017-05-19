const utils = require('../utils')
const debug = require('debug')('ilp-service:ilp-address')

module.exports = async function ilpAddress (config, factory, ctx) {
  const { account } = ctx.query
  debug('call /ilpAddress with', ctx.query)

  if (!account) {
    return ctx.throw('missing query parameter account', 400)
  }

  const address = config.ilp_prefix + utils.accountToUsername(factory, account, ctx)
  debug('returning', address)

  ctx.body = { address }
}
