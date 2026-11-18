function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  if (err.type === "entity.parse.failed" || (err instanceof SyntaxError && err.status === 400)) {
    return res.status(400).json({
      success: false,
      error: "INVALID_JSON",
    });
  }

  if (err.status && err.code) {
    const body = { success: false, error: err.code };
    if (err.details) {
      body.details = err.details;
    }
    return res.status(err.status).json(body);
  }

  console.error(err);
  return res.status(500).json({
    success: false,
    error: "INTERNAL_ERROR",
  });
}

module.exports = errorHandler;
