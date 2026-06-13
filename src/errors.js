// Domain errors with an HTTP status. Their message IS exposed to the client;
// any other error is logged and answered with a generic 500.
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
  }
}

class BadRequestError extends HttpError {
  constructor(message) { super(400, message); }
}

class NotFoundError extends HttpError {
  constructor(message) { super(404, message); }
}

class ConflictError extends HttpError {
  constructor(message) { super(409, message); }
}

class BadGatewayError extends HttpError {
  constructor(message) { super(502, message); }
}

class ServiceUnavailableError extends HttpError {
  constructor(message) { super(503, message); }
}

module.exports = {
  HttpError,
  BadRequestError,
  NotFoundError,
  ConflictError,
  BadGatewayError,
  ServiceUnavailableError,
};
