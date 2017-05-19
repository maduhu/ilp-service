const ILP = require('ilp')
const agent = require('superagent')
const utils = require('../utils')

module.exports = async function createIPR (config, factory, cache, ctx) {
  const { uuid, destinationAccount, expiresAt } = ctx.request.body

  if (!uuid) {
    throw new Error('missing JSON body field uuid')
  } else if (!uuid.match(utils.UUID_REGEX)) {
    throw new Error('uuid (' + uuid + ') is an invalid uuid')
  } else if (!expiresAt) {
    throw new Error('missing JSON body field expiresAt')
  }

  const destinationUsername = utils.accountToUsername(destinationAccount)
  const destinationAddress = config.ilp_prefix + destinationUsername
  const ipr = ILP.IPR.createIPR({
    destinationAccount: destinationAddress,
    publicHeaders: { 'Payment-Id': uuid },
    disableEncryption: true,
    expiresAt
  })

  ctx.body = { ipr }

  if (cache.get(sourceUsername, expiresAt)) {
    return
  }

  const plugin = await factory.create({ username: sourceUsername })
  const stopListening = ILP.IPR.listen(plugin, {
    secret: config.secret
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

    const destinationAccount = utils.addressToAccount(config, factory, transfer.to)
    const ipr = ILP.IPR.encodeIPR({
      packet: transfer.ilp,
      condition: transfer.executionCondition
    })

    await agent
      .post(config.backend_url)
      .send({ uuid, ipr, destinationAccount, status: 'prepared' })
    await fulfill
    // TODO: we need ILP to pass the fulfillment into the callback
    await agent
      .post(config.backend_url)
      .send({ uuid, ipr, destinationAccount, status: 'executed' })
  })

  cache.put(sourceUsername, true, () => {
    stopListening()
  })
}
