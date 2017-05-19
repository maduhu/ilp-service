const app = require('./src/app.js')
const debug = require('debug')('ilp-service:index')
const crypto = require('crypto')
const generateSecret = () => {
  debug('generating random receiver secret')
  return crypto.randomBytes(32).toString('base64')
}

const config = {
  secret: process.env.ILP_SERVICE_SECRET || generateSecret(),
  ilp_prefix: process.env.ILP_SERVICE_PREFIX,
  backend_url: process.env.ILP_SERVICE_BACKEND_URL,
  admin: {
    username: process.env.ILP_SERVICE_ADMIN_USERNAME,
    account: process.env.ILP_SERVICE_ADMIN_ACCOUNT,
    password: process.env.ILP_SERVICE_ADMIN_PASSWORD,
  },
  connector: process.env.ILP_SERVICE_CONNECTOR,
  port: process.env.ILP_SERVICE_PORT || 4000,
}

debug('instantiating ilp-service app')
app(config).catch((err) => {
  console.error(err)
  process.exit(1)
})
