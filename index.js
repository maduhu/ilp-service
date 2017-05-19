const app = require('./src/app.js')
const debug = require('debug')('ilp-service:index')
const crypto = require('crypto')
const config = {
  secret: process.env.ILP_SECRET || crypto.randomBytes(32).toString('base64'),
  ilp_prefix: process.env.ILP_PREFIX,
  backend_url: process.env.ILP_BACKEND_URL,
  admin: {
    username: process.env.ILP_ADMIN_USERNAME,
    account: process.env.ILP_ADMIN_ACCOUNT,
    password: process.env.ILP_ADMIN_PASSWORD,
  },
  connectors: process.env.ILP_CONNECTORS.split(',')
  port: process.env.ILP_PORT || 4000,
}

debug('instantiating ilp-service app')
app(config).catch((err) => {
  console.error(err)
  process.exit(1)
})
