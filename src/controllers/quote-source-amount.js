const ILP = require('ilp')
const utils = require('../utils')

module.exports = async function quoteSourceAmount (config, factory, ctx) {
  const { destinationAddress, sourceAmount, connectorAccount } = ctx.query

  // validate all parameters
  if (!destinationAddress) {
    throw new Error('missing query parameter destinationAddress')
  } else if (!destinationAddress.match(utils.ILP_REGEX)) {
    throw new Error('destinationAddress (' + destinationAddress +
      ') is an invalid ILP address.')
  } else if (!sourceAmount) {
    throw new Error('missing query parameter sourceAmount')
  } else if (!sourceAmount.match(utils.AMOUNT_REGEX)) {
    throw new Error('sourceAmount (' + sourceAmount +
      ') is an invalid integer amount.')
  } else if (!connectorAccount && (!config.connectors || !config.connectors.length)) {
    throw new Error('missing both query parameter connectorAccount and config.connectors')
  }

  const plugin = factory.adminPlugin
  const connectorAddress = connectorAccount && (config.ilp_prefix +
    utils.accountToUsername(factory, connectorAccount))

  const quote = await ILP.ILQP.quote(plugin, {
    sourceAmount,
    destinationAddress,
    connectors: (connectorAddress ? [ connectorAddress ] : config.connectors)
  })

  ctx.body = {
    destinationAmount: quote.destinationAmount,
    connectorAccount: quote.connectorAccount,
    sourceExpiryDuration: quote.sourceExpiryDuration
  }
}
