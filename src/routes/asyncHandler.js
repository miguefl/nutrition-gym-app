// Express 4 does not forward errors from async handlers to the error handler;
// this wrapper does it for us.
module.exports = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
