const ILP = require('ilp')
const debug = require('debug')('ilp-service:create-ipr')
const utils = require('../utils')

module.exports = async function createIPR (config, factory, ctx) {
  const { paymentId, destinationAccount, destinationAmount, expiresAt, data } = ctx.request.body
  debug('call to /createIPR with body', ctx.request.body)

  if (!paymentId) {
    return ctx.throw('missing JSON body field paymentId', 400)
  } else if (!paymentId.match(utils.UUID_REGEX)) {
    return ctx.throw('paymentId (' + paymentId + ') is an invalid uuid', 400)
  } else if (!expiresAt) {
    return ctx.throw('missing JSON body field expiresAt', 400)
  } else if (!destinationAccount) {
    return ctx.throw('missing JSON body field destinationAccount', 400)
  } else if (!destinationAmount) {
    return ctx.throw('missing JSON body field destinationAmount', 400)
  } else if (!destinationAmount.match(utils.AMOUNT_REGEX)) {
    return ctx.throw('destinationAmount (' + destinationAmount +
      ') is an invalid decimal amount', 400)
  }

  const destinationUsername = utils.accountToUsername(factory, destinationAccount, ctx)
  const destinationAddress = config.ilp_prefix + destinationUsername

  const ipr = utils.base64url(ILP.IPR.createIPR({
    receiverSecret: Buffer.from(config.secret, 'base64'),
    destinationAmount: utils.scaleAmount(factory, destinationAmount),
    destinationAccount: destinationAddress,
    publicHeaders: { 'Payment-Id': paymentId },
    disableEncryption: true,
    data: data && Buffer.from(JSON.stringify(data)),
    expiresAt
  }))

  debug('L1p-Trace-Id=' + paymentId, 'created IPR', ipr, 'from params', {
    destinationAmount,
    destinationAccount,
    publicHeaders: { 'Payment-Id': paymentId },
    disableEncryption: true,
    data,
    expiresAt
  })
  ctx.body = { ipr }
}
