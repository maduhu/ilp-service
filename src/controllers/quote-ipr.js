const ILP = require('ilp')
const IlpPacket = require('ilp-packet')
const debug = require('debug')('ilp-service:quote-ipr')
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

  const plugin = await factory.create({ username: config.admin.username })
  const { packet } = ILP.IPR.decodeIPR(Buffer.from(ipr, 'base64'))
  const { amount, account } = IlpPacket.deserializeIlpPayment(Buffer.from(packet, 'base64'))
  const connectorAddress = config.ilp_prefix +
    utils.accountToUsername(factory, connectorAccount || config.connector, ctx)

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
    connectorAccount: utils.addressToAccount(config, factory, quote.connectorAccount, ctx),
    sourceExpiryDuration: quote.sourceExpiryDuration
  }
}
