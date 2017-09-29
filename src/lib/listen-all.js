const utils = require('../utils')
const ILP = require('ilp')
const debug = require('debug')('ilp-service:listen')
const agent = require('superagent')
const thrower = {
  throw: (e) => {
    throw new Error(e)
  }
}

async function incomingPaymentCallback (config, factory, connectorAddress, connector, {
  transfer,
  publicHeaders,
  fulfill,
  fulfillment,
  data
}) {
  const paymentId = publicHeaders['payment-id']
  if (!paymentId) {
    throw new Error('missing public header Payment-Id')
  } else if (!paymentId.match(utils.UUID_REGEX)) {
    throw new Error('public header Payment-Id is an invalid uuid')
  }

  let parsedData
  try {
    parsedData = JSON.parse(data.toString())
  } catch (e) {
    parsedData = undefined
  }

  const destinationAccount = utils.addressToAccount(config, factory, transfer.to, thrower)
  const ipr = utils.base64url(ILP.IPR.encodeIPR({
    packet: transfer.ilp,
    condition: transfer.executionCondition
  }))

  debug('L1p-Trace-Id=' + paymentId, 'incoming prepare, transfer:', transfer, 'ipr:', ipr)
  debug('L1p-Trace-Id=' + paymentId, 'submitting prepare notification to backend for review')
  await agent
    .post(config.backend_url + '/notifications')
    .send({ paymentId, ipr, destinationAccount, data: parsedData, status: 'prepared' })
    .catch((e) => { throw new Error(e.response ? e.response.error.text : e.message) })

  // if (transfer.from.startsWith(connectorAddress)) {
  //   debug('L1p-Trace-Id=' + paymentId, 'fulfilling connector source transfer')
  //   await connector.fulfillCondition(transfer.id, fulfillment)
  // }

  debug('L1p-Trace-Id=' + paymentId, 'fulfilling destination transfer')
  await fulfill()

  debug('L1p-Trace-Id=' + paymentId, 'executed transfer')
  debug('L1p-Trace-Id=' + paymentId, 'submitting execute notification to backend')
  await agent
    .post(config.backend_url + '/notifications')
    .send({ fulfillment, paymentId, ipr, destinationAccount, data: parsedData, status: 'executed' })
}

async function listenAll (config, factory, connector) {
  const connectorAddress = config.ilp_prefix +
    utils.accountToUsername(factory, config.connector, thrower)
  const callback = incomingPaymentCallback
    .bind(null, config, factory, connectorAddress, connector)

  await ILP.IPR.listenAll(factory, {
    // Share one receiver secret between all accounts. Does not allow
    // unauthorized funds to be received.
    generateReceiverSecret: () => Buffer.from(config.secret, 'base64')
  }, callback)
}

module.exports = {
  listenAll,
  incomingPaymentCallback
}
