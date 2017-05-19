const ILP = require('ilp')
const utils = require('../utils')

module.exports = async function payIPR (config, factory, ctx) {
  const {
    sourceAmount,
    sourceAccount,
    connectorAccount,
    ipr,
    sourceExpiryDuration } = ctx.request.body

  if (!sourceAmount) {
    throw new Error('missing JSON body field sourceAmount')
  } else if (!sourceAmount.match(utils.AMOUNT_REGEX) {
    throw new Error('sourceAmount (' + sourceAmount + ') ' +
      'is an invalid integer amount')
  } else if (!ipr) {
    throw new Error('missing JSON body field ipr')
  } else if (!ipr.match(utils.BASE64_URL_REGEX)) {
    throw new Error('ipr (' + ipr + ') contains invalid base64url.')
  } else if (!sourceExpiryDuration) {
    throw new Error('missing JSON body field sourceExpiryDuration')
  } else if (!(+sourceExpiryDuration)) {
    throw new Error('sourceExpiryDuration (' + sourceExpiryDuration + ')' +
      ' must be parseable to a valid number')
  } else if (!connectorAccount) {
    throw new Error('missing both JSON body field connectorAccount and config.connectors')
  }

  const sourceUsername = factory.ledgerContext.accountUriToName(sourceAccount)
  const plugin = await factory.create({ username: sourceUsername })

  const { packet, condition } = ILP.IPR.decodeIPR(ipr)
  const details = ILP.PSK.parsePacketAndDetails({ packet })
  const uuid = details.publicHeaders['payment-id']
  const connectorAddress = config.ilp_prefix +
    factory.ledgerContext.accountUriToName(sourceAccount)

  if (!uuid) {
    throw new Error('IPR packet (' + packet +
      ') PSK public headers are missing payment-id')
  }

  await plugin.sendTransfer({
    id: uuid,
    amount: sourceAmount,
    to: connectorAddress,
    condition: condition,
    ilp: packet,
    expiresAt: utils.makeExpiry(sourceExpiryDuration)
  })

  const listen = new Promise((resolve) => {
    function remove () {
      plugin.removeListener('outgoing_fulfill', fulfill)
      plugin.removeListener('outgoing_cancel', cancel)
      plugin.removeListener('outgoing_reject', reject)
    }

    function fulfill (transfer, fulfillment) {
      if (transfer.id !== uuid) return
      resolve({ status: 'executed', fulfillment })
    }

    function cancel (transfer) {
      if (transfer.id !== uuid) return
      resolve({ status: 'expired' }) 
    }

    function reject (transfer, rejectionMessage) {
      if (transfer.id !== uuid) return
      resolve({ status: 'rejected', rejectionMessage })
    }

    plugin.on('outgoing_fulfill', fulfill)
    plugin.on('outgoing_cancel', cancel)
    plugin.on('outgoing_reject', reject)
  })

  const result = await listen
  ctx.body = Object.assign({
    connectorAccount,
    uuid,
  }, result)
}
