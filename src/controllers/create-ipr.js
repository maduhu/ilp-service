const ILP = require('ilp')
const debug = require('debug')('ilp-service:create-ipr')
const agent = require('superagent')
const utils = require('../utils')

module.exports = async function createIPR (config, factory, cache, ctx) {
  const { uuid, destinationAccount, destinationAmount, expiresAt } = ctx.request.body
  debug('call to /createIPR with body', ctx.request.body)

  if (!uuid) {
    return ctx.throw('missing JSON body field uuid', 400)
  } else if (!uuid.match(utils.UUID_REGEX)) {
    return ctx.throw('uuid (' + uuid + ') is an invalid uuid', 400)
  } else if (!expiresAt) {
    return ctx.throw('missing JSON body field expiresAt', 400)
  } else if (!destinationAccount) {
    return ctx.throw('missing JSON body field destinationAccount', 400)
  } else if (!destinationAmount) {
    return ctx.throw('missing JSON body field destinationAmount', 400)
  } else if (!destinationAmount.match(utils.AMOUNT_REGEX)) {
    return ctx.throw('destinationAmount (' + destinationAmount +
      ') is not a valid integer amount')
  }

  const destinationUsername = utils.accountToUsername(factory, destinationAccount, ctx)
  const destinationAddress = config.ilp_prefix + destinationUsername
  const ipr = utils.base64url(ILP.IPR.createIPR({
    receiverSecret: Buffer.from(config.secret, 'base64'),
    destinationAmount: destinationAmount,
    destinationAccount: destinationAddress,
    publicHeaders: { 'Payment-Id': uuid },
    disableEncryption: true,
    expiresAt
  }))

  debug('L1p-Trace-Id=' + uuid, 'created IPR', ipr)
  ctx.body = { ipr }

  if (cache.get(destinationUsername, expiresAt)) {
    return
  }

  const plugin = await factory.create({ username: destinationUsername })
  const stopListening = await ILP.IPR.listen(plugin, {
    receiverSecret: Buffer.from(config.secret, 'base64')
  }, async function incomingPaymentCallback ({
    transfer,
    publicHeaders,
    fulfill
  }) {
    const uuid = publicHeaders['payment-id']
    if (!uuid) {
      throw new Error('missing public header Payment-Id')
    } else if (!uuid.match(utils.UUID_REGEX)) {
      throw new Error('public header Payment-Id is an invalid uuid')
    }

    const destinationAccount = utils.addressToAccount(config, factory, transfer.to, ctx)

    const ipr = ILP.IPR.encodeIPR({
      packet: transfer.ilp,
      condition: transfer.executionCondition
    })

    debug('L1p-Trace-Id=' + uuid, 'incoming prepare, transfer:', transfer, 'ipr:', ipr)
    debug('L1p-Trace-Id=' + uuid, 'submitting prepare notification to backend for review')
    await agent
      .post(config.backend_url + '/notifications')
      .send({ uuid, ipr, destinationAccount, status: 'prepared' })
      .catch((e) => { throw new Error(e.response.error.text) })

    debug('L1p-Trace-Id=' + uuid, 'fulfilling transfer')
    await fulfill()

    // TODO: we need ILP to pass the fulfillment into the callback
    debug('L1p-Trace-Id=' + uuid, 'executed transfer')
    debug('L1p-Trace-Id=' + uuid, 'submitting execute notification to backend')
    await agent
      .post(config.backend_url + '/notifications')
      .send({ uuid, ipr, destinationAccount, status: 'executed' })
  })

  cache.put(destinationUsername, true, () => {
    stopListening()
  })
}
