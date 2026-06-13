const { HttpError } = require('../errors');

// Domain HttpErrors expose their message; any other error is logged on the
// server and answered with a generic 500 (no internal details leaked).
// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Cuerpo demasiado grande.' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON inválido.' });
  }
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor.' });
}

module.exports = errorHandler;
