function httpError(status, code, details) {
  const error = new Error(code);
  error.status = status;
  error.code = code;
  if (details) {
    error.details = details;
  }
  return error;
}

function notFound(code = "NOT_FOUND") {
  return httpError(404, code);
}

function conflict(code, details) {
  return httpError(409, code, details);
}

function badRequest(code, details) {
  return httpError(400, code, details);
}

module.exports = {
  httpError,
  notFound,
  conflict,
  badRequest,
};
