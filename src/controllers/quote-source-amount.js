const ILP = require('ilp')
const debug = require('debug')('ilp-service:quote-source-amount')
const utils = require('../utils')

module.exports = async function quoteSourceAmount (config, factory, ctx) {
  const { destinationScale, destinationAddress, sourceAmount, connectorAccount } = ctx.query
  const traceId = ctx.request.headers['l1p-trace-id']

  debug(traceId ? ('L1p-Trace-Id=' + traceId) : '',
    'call /quoteSourceAmount with query', ctx.query)

  // validate all parameters
  if (!destinationAddress) {
    return ctx.throw('missing query parameter destinationAddress', 400)
  } else if (!destinationAddress.match(utils.ILP_REGEX)) {
    return ctx.throw('destinationAddress (' + destinationAddress +
      ') is an invalid ILP address.', 400)
  } else if (!sourceAmount) {
    return ctx.throw('missing query parameter sourceAmount', 400)
  } else if (!sourceAmount.match(utils.AMOUNT_REGEX)) {
    return ctx.throw('sourceAmount (' + sourceAmount +
      ') is an invalid decimal amount.', 400)
  } else if (!connectorAccount && !config.connector) {
    return ctx.throw('missing both query parameter connectorAccount and config.connector', 400)
  } else if (!destinationScale) {
    return ctx.throw('missing query parameter destinationScale')
  } else if (!destinationScale.match(utils.INTEGER_REGEX)) {
    return ctx.throw('destinationScale (' + destinationScale +
      ') is an invalid integer.', 400)
  }

  const plugin = await factory.create({
    username: config.admin.username
  })
  const connectorAddress = config.ilp_prefix +
    utils.accountToUsername(factory, connectorAccount || config.connector, ctx)

  debug(traceId ? ('L1p-Trace-Id=' + traceId) : '',
    'quoting sourceAmount=' + sourceAmount, 'destinationAddress=' + destinationAddress)
  const quote = await ILP.ILQP.quote(plugin, {
    destinationAddress,
    sourceAmount: utils.scaleAmount(factory, sourceAmount),
    connectors: [ connectorAddress ]
  })

  debug(traceId ? ('L1p-Trace-Id=' + traceId) : '', 'got quote', quote)
  ctx.body = {
    destinationAmount: utils.unscaleAmountByScale(destinationScale, quote.destinationAmount),
    connectorAccount: utils.addressToAccount(config, factory, quote.connectorAccount, ctx),
    sourceExpiryDuration: quote.sourceExpiryDuration
  }
}
