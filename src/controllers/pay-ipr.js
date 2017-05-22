const ILP = require('ilp')
const utils = require('../utils')
const debug = require('debug')('ilp-service:pay-ipr')

module.exports = async function payIPR (config, factory, ctx) {
  const {
    sourceAmount,
    sourceAccount,
    connectorAccount,
    ipr,
    sourceExpiryDuration } = ctx.request.body
  debug('call /payIPR with body', ctx.request.body)

  if (!sourceAmount) {
    return ctx.throw('missing JSON body field sourceAmount', 400)
  } else if (!sourceAmount.match(utils.AMOUNT_REGEX)) {
    return ctx.throw('sourceAmount (' + sourceAmount + ') ' +
      'is an invalid decimal amount', 400)
  } else if (!sourceAccount) {
    return ctx.throw('missing JSON body field sourceAccount', 400)
  } else if (!ipr) {
    return ctx.throw('missing JSON body field ipr', 400)
  } else if (!ipr.match(utils.BASE64_URL_REGEX)) {
    return ctx.throw('ipr (' + ipr + ') contains invalid base64url.', 400)
  } else if (!sourceExpiryDuration) {
    return ctx.throw('missing JSON body field sourceExpiryDuration', 400)
  } else if (!(+sourceExpiryDuration)) {
    return ctx.throw('sourceExpiryDuration (' + sourceExpiryDuration + ')' +
      ' must be parseable to a valid number', 400)
  } else if (!connectorAccount) {
    return ctx.throw('missing JSON body field connectorAccount', 400)
  }

  const sourceUsername = utils.accountToUsername(factory, sourceAccount, ctx)
  const plugin = await factory.create({ username: sourceUsername })

  const { packet, condition } = ILP.IPR.decodeIPR(Buffer.from(ipr, 'base64'))
  const details = ILP.PSK.parsePacketAndDetails({ packet })
  const paymentId = details.publicHeaders['payment-id']
  const connectorAddress = config.ilp_prefix +
    utils.accountToUsername(factory, connectorAccount, ctx)

  if (!paymentId) {
    return ctx.throw('IPR packet (' + packet +
      ') PSK public headers are missing payment-id', 400)
  }

  const transfer = {
    id: paymentId,
    amount: utils.scaleAmount(factory, sourceAmount),
    to: connectorAddress,
    executionCondition: condition,
    ilp: packet,
    expiresAt: utils.makeExpiry(sourceExpiryDuration)
  }

  debug('L1p-Trace-Id=' + paymentId, 'parsed IPR')
  debug('L1p-Trace-Id=' + paymentId, 'sending transfer:', transfer, 'ipr:', ipr)
  await plugin.sendTransfer(transfer)

  const listen = new Promise((resolve) => {
    function remove () {
      setImmediate(() => {
        plugin.removeListener('outgoing_fulfill', fulfill)
        plugin.removeListener('outgoing_cancel', cancel)
        plugin.removeListener('outgoing_reject', reject)
      })
    }

    function fulfill (transfer, fulfillment) {
      if (transfer.id !== paymentId) return
      debug('L1p-Trace-Id=' + paymentId,
        'outgoing transfer fulfilled with', fulfillment)
      remove()
      resolve({ status: 'executed', fulfillment })
    }

    function cancel (transfer) {
      if (transfer.id !== paymentId) return
      debug('L1p-Trace-Id=' + paymentId, 'outgoing transfer expired')
      remove()
      resolve({ status: 'expired' })
    }

    function reject (transfer, rejectionMessage) {
      if (transfer.id !== paymentId) return
      debug('L1p-Trace-Id=' + paymentId,
        'outgoing transfer rejected with', rejectionMessage)
      remove()
      resolve({ status: 'rejected', rejectionMessage })
    }

    plugin.on('outgoing_fulfill', fulfill)
    plugin.on('outgoing_cancel', cancel)
    plugin.on('outgoing_reject', reject)
  })

  debug('L1p-Trace-Id=' + paymentId, 'listening for transfer updates')
  const result = await listen
  ctx.body = Object.assign({
    connectorAccount,
    paymentId
  }, result)
}
