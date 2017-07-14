const Koa = require('koa')
const Router = require('koa-router')
const BodyParser = require('koa-bodyparser')
const PluginBells = require('ilp-plugin-bells')
const utils = require('./utils')
const debug = require('debug')('ilp-service')

const { listenAll } = require('./lib/listen-all')
const quoteSourceAmount = require('./controllers/quote-source-amount')
const quoteIPR = require('./controllers/quote-ipr')
const payments = require('./controllers/pay-ipr')
const createIPR = require('./controllers/create-ipr')
const ilpAddress = require('./controllers/ilp-address')

module.exports = async function app (config) {
  if (!config.secret) {
    throw new Error('missing secret (ILP_SERVICE_SECRET)')
  } else if (!Buffer.from(config.secret, 'base64')) {
    throw new Error('secret (ILP_SERVICE_SECRET) should be base64/base64url')
  } else if (!config.ilp_prefix) {
    throw new Error('missing ILP prefix (ILP_SERVICE_PREFIX)')
  } else if (!config.ilp_prefix.match(utils.ILP_PREFIX_REGEX)) {
    throw new Error('ILP prefix (ILP_SERVICE_ILP_PREFIX) (' + config.ilp_prefix + ') ' +
      'is an invalid ILP prefix')
  } else if (!config.backend_url) {
    throw new Error('missing backend URL (ILP_SERVICE_BACKEND)')
  } else if (!config.admin) {
    throw new Error('missing config.admin credentials object')
  } else if (!config.admin.username) {
    throw new Error('missing admin username (ILP_SERVICE_LEDGER_ADMIN_USERNAME)')
  } else if (!config.admin.password) {
    throw new Error('missing admin username (ILP_SERVICE_LEDGER_ADMIN_PASSWORD)')
  } else if (!config.admin.account) {
    throw new Error('missing admin username (ILP_SERVICE_LEDGER_ADMIN_ACCOUNT)')
  } else if (!config.port) {
    throw new Error('missing config port')
  } else if (!config.connector) {
    throw new Error('missing connector account (ILP_SERVICE_CONNECTOR_ACCOUNT)')
  } else if (!config.centralConnector.account) {
    throw new Error('missing connector account (ILP_SERVICE_CENTRAL_CONNECTOR_ACCOUNT)')
  } else if (!config.centralConnector.password) {
    throw new Error('missing connector password (ILP_SERVICE_CENTRAL_CONNECTOR_PASSWORD)')
  }

  const server = new Koa()
  const router = Router()
  const parser = BodyParser()
  const connector = new PluginBells({
    account: config.centralConnector.account,
    username: config.centralConnector.username,
    password: config.centralConnector.password,
    prefix: config.centralConnector.prefix
  })

  const factory = new PluginBells.Factory({
    adminUsername: config.admin.username,
    adminAccount: config.admin.account,
    adminPassword: config.admin.password,
    prefix: config.ilp_prefix,
    globalSubscription: true
  })

  debug('connecting factory')
  await factory.connect()

  debug('connecting connector')
  await connector.connect()

  debug('creating routes')
  router.get('/quoteSourceAmount', quoteSourceAmount.bind(null, config, factory))
  router.get('/quoteIPR', quoteIPR.bind(null, config, factory))
  router.get('/ilpAddress', ilpAddress.bind(null, config, factory))

  router.post('/payIPR', payments.bind(null, config, factory))
  router.post('/createIPR', createIPR.bind(null, config, factory))

  server
    .use(parser)
    .use(router.routes())
    .use(router.allowedMethods())
    .listen(config.port)

  // Listen to all ledger accounts at once
  await listenAll(config, factory, connector)

  debug('listening on ' + config.port)
}
