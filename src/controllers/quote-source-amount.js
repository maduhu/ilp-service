const ILP = require('ilp')
const utils = require('../utils')

module.exports = async function quoteSourceAmount (config, factory, ctx) {
  const { destinationAddress, sourceAmount, connectorAccount } = ctx.query

  debug(traceId ? ('L1p-Trace-Id=' + traceId) : '',
    'call /quoteSourceAmount with query', ctx.query)

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
  } else if (!connectorAccount && !config.connector) {
    throw new Error('missing both query parameter connectorAccount and config.connector')
  }

  const plugin = factory.adminPlugin
  const connectorAddress = config.ilp_prefix +
    utils.accountToUsername(factory, connectorAccount || config.connector)

  debug(traceId ? ('L1p-Trace-Id=' + traceId) : '',
    'quoting sourceAmount=' + sourceAmount, 'destinationAddress=' + destinationAddress)
  const quote = await ILP.ILQP.quote(plugin, {
    sourceAmount,
    destinationAddress,
    connectors: [ connectorAddress ]
  })

  debug(traceId ? ('L1p-Trace-Id=' + traceId) : '', 'got quote', quote)
  ctx.body = {
    destinationAmount: quote.destinationAmount,
    connectorAccount: quote.connectorAccount,
    sourceExpiryDuration: quote.sourceExpiryDuration
  }
}
