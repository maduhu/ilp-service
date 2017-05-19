const ILP = require('ilp')
const IlpPacket = require('ilp-packet')
const utils = require('../utils')

module.exports = async function quoteIpr (config, factory, ctx) {
  const { ipr, connectorAccount } = ctx.query

  // validate all parameters
  if (!ipr) {
    throw new Error('missing query parameter ipr')
  } else if (!ipr.match(utils.BASE64_URL_REGEX)) {
    throw new Error('ipr (' + ipr + ') contains invalid base64url.')
  } else if (!connectorAccount && (!config.connectors || !config.connectors.length)) {
    throw new Error('missing both query parameter connectorAccount and config.connectors')
  }

  const plugin = factory.adminPlugin
  const { packet } = ILP.IPR.decodeIPR(ipr)
  const { amount, account } = IlpPacket.deserializeIlpPayment(packet)
  const connectorAddress = connectorAccount && (config.ilp_prefix +
    utils.accountToUsername(factory, connectorAccount))

  const quote = await ILP.ILQP.quote(plugin, {
    destinationAmount: amount,
    destinationAddress: account,
    connectors: (connectorAddress ? [ connectorAddress ] : config.connectors)
  })

  ctx.body = {
    sourceAmount: quote.sourceAmount,
    connectorAccount: quote.connectorAccount,
    sourceExpiryDuration: quote.sourceExpiryDuration
  }
}
