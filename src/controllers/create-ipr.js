const ILP = require('ilp')
const debug = require('debug')('ilp-service:create-ipr')
const agent = require('superagent')
const utils = require('../utils')

module.exports = async function createIPR (config, factory, cache, connector, ctx) {
  const { paymentId, destinationAccount, destinationAmount, expiresAt } = ctx.request.body
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
  const connectorAddress = config.ilp_prefix +
    utils.accountToUsername(factory, config.connector, ctx)

  const ipr = utils.base64url(ILP.IPR.createIPR({
    receiverSecret: Buffer.from(config.secret, 'base64'),
    destinationAmount: utils.scaleAmount(factory, destinationAmount),
    destinationAccount: destinationAddress,
    publicHeaders: { 'Payment-Id': paymentId },
    disableEncryption: true,
    expiresAt
  }))

  debug('L1p-Trace-Id=' + paymentId, 'created IPR', ipr)
  ctx.body = { ipr }

  if (cache.get(destinationUsername, expiresAt)) {
    return
  }

  const plugin = await factory.create({
    username: destinationUsername
  })
  const stopListening = await ILP.IPR.listen(plugin, {
    receiverSecret: Buffer.from(config.secret, 'base64')
  }, async function incomingPaymentCallback ({
    transfer,
    publicHeaders,
    fulfill,
    fulfillment
  }) {
    const paymentId = publicHeaders['payment-id']
    if (!paymentId) {
      throw new Error('missing public header Payment-Id')
    } else if (!paymentId.match(utils.UUID_REGEX)) {
      throw new Error('public header Payment-Id is an invalid uuid')
    }

    const destinationAccount = utils.addressToAccount(config, factory, transfer.to, ctx)

    const ipr = ILP.IPR.encodeIPR({
      packet: transfer.ilp,
      condition: transfer.executionCondition
    })

    debug('L1p-Trace-Id=' + paymentId, 'incoming prepare, transfer:', transfer, 'ipr:', ipr)
    debug('L1p-Trace-Id=' + paymentId, 'submitting prepare notification to backend for review')
    await agent
      .post(config.backend_url + '/notifications')
      .send({ paymentId, ipr, destinationAccount, status: 'prepared' })
      .catch((e) => { throw new Error(e.response.error.text) })

    if (transfer.from.startsWith(connectorAddress)) {
      debug('L1p-Trace-Id=' + paymentId, 'fulfilling connector source transfer')
      await connector.fulfillCondition(transfer.id, fulfillment)
    }

    debug('L1p-Trace-Id=' + paymentId, 'fulfilling destination transfer')
    await fulfill()

    debug('L1p-Trace-Id=' + paymentId, 'executed transfer')
    debug('L1p-Trace-Id=' + paymentId, 'submitting execute notification to backend')
    await agent
      .post(config.backend_url + '/notifications')
      .send({ fulfillment, paymentId, ipr, destinationAccount, status: 'executed' })
  })

  cache.put(destinationUsername, true, () => {
    stopListening()
  })
}
