const ILP = require('ilp')
const IlpPacket = require('ilp-packet')
const debug = require('ilp-service')('ilp-service:quote-ipr')
const utils = require('../utils')

module.exports = async function quoteIpr (config, factory, ctx) {
  const { ipr, connectorAccount } = ctx.query
  const traceId = ctx.request.headers['l1p-trace-id']

  debug(traceId ? ('L1p-Trace-Id=' + traceId) : '',
    'call /quoteIPR with query', ctx.query)

  // validate all parameters
  if (!ipr) {
    return ctx.throw('missing query parameter ipr', 400)
  } else if (!ipr.match(utils.BASE64_URL_REGEX)) {
    return ctx.throw('ipr (' + ipr + ') contains invalid base64url.', 400)
  } else if (!connectorAccount && !config.connector) {
    return ctx.throw('missing both query parameter connectorAccount and config.connector', 400)
  }

  const plugin = factory.adminPlugin
  const { packet } = ILP.IPR.decodeIPR(ipr)
  const { amount, account } = IlpPacket.deserializeIlpPayment(packet)
  const connectorAddress = config.ilp_prefix +
    utils.accountToUsername(factory, connectorAccount || config.connector)

  debug(traceId ? ('L1p-Trace-Id=' + traceId) : '',
    'quoting destinationAmount=' + amount, 'destinationAddress=' + account)
  const quote = await ILP.ILQP.quote(plugin, {
    destinationAmount: amount,
    destinationAddress: account,
    connectors: [ connectorAddress ]
  })

  debug(traceId ? ('L1p-Trace-Id=' + traceId) : '', 'got quote', quote)
  ctx.body = {
    sourceAmount: quote.sourceAmount,
    connectorAccount: quote.connectorAccount,
    sourceExpiryDuration: quote.sourceExpiryDuration
  }
}
