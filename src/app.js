const Koa = require('koa')
const Router = require('koa-router')
const BodyParser = require('koa-bodyparser')
const PluginBells = require('ilp-plugin-bells')
const Cache = require('./lib/cache')
const utils = require('./utils')
const debug = require('debug')('ilp-service')

const quoteSourceAmount = require('./controllers/quote-source-amount')
const quoteIPR = require('./controllers/quote-ipr')
const payments = require('./controllers/pay-ipr')
const createIPR = require('./controllers/create-ipr')
const ilpAddress = require('./controllers/ilp-address')

async function app (config) {
  if (!config.secret) {
    throw new Error('missing secret (ILP_SECRET)')
  } else if (!Buffer.from(config.secret, 'base64')) {
    throw new Error('secret (ILP_SECRET) should be base64/base64url')
  } else if (!config.ilp_prefix) {
    throw new Error('missing ILP prefix (ILP_PREFIX)')
  } else if (!config.ilp_prefix.match(utils.ILP_PREFIX_REGEX)) {
    throw new Error('ILP prefix (ILP_PREFIX) (' + config.ilp_prefix + ') ' +
      'is an invalid ILP prefix')
  } else if (!config.backend_url) {
    throw new Error('missing backend URL (ILP_BACKEND_URL)')
  } else if (!config.admin) {
    throw new Error('missing config.admin credentials object')
  } else if (!config.admin.username) {
    throw new Error('missing admin username (ILP_ADMIN_USERNAME)')
  } else if (!config.admin.password) {
    throw new Error('missing admin username (ILP_ADMIN_PASSWORD)')
  } else if (!config.admin.account) {
    throw new Error('missing admin username (ILP_ADMIN_ACCOUNT)')
  } else if (!config.connectors) {
    throw new Error('missing config.connectors array')
  } else if (!config.connectors.reduce((a, c) => a && c.match(utils.ILP_REGEX))) {
    throw new Error('each connector in ' + JSON.stringify(config.connectors) +
      ' must be a valid ILP address')
  } else if (!config.port) {
    throw new Error('missing config port')
  }

  const server = new Koa()
  const router = Router()
  const parser = BodyParser()
  const cache = new Cache()
  const factory = new PluginBells.Factory({
    adminUsername: config.admin.username,
    adminAccount: config.admin.account,
    adminPassword: config.admin.password
  })

  debug('connecting factory')
  await factory.connect()

  debug('creating routes')
  router.get('/quoteSourceAmount', quoteSourceAmount.bind(null, config, factory))
  router.get('/quoteIPR', quoteIPR.bind(null, config, factory))
  router.get('/ilpAddress', ilpAddress.bind(null, config, factory))

  router.post('/payIPR', payments.bind(null, config, factory))
  router.post('/createIPR', createIPR.bind(null, config, factory, cache))

  server
    .use(parser)
    .use(router.routes())
    .use(router.allowedMethods())
    .listen(config.port)

  debug('listening on ' + config.port)
}
