module.exports = class MockCtx {
  constructor () {
    this.request = {}
    this.request.headers = {}
  }

  throw (msg, status) {
    throw new Error(status + ': ' + msg)
  }
}
