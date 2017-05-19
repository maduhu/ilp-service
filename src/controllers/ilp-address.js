const utils = require('../utils')

module.exports = async function ilpAddress (config, factory, ctx) {
  const { account } = ctx.query

  if (!account) {
    throw new Error('missing query parameter account')
  }

  const username = utils.accountToUsername(factory, connectorAccount))
  ctx.body = {
    address: config.ilp_prefix + username
  }
}
