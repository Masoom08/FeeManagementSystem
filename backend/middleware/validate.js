function formatZodError(error) {
  return error.issues.map((issue) => ({
    path: issue.path.length ? issue.path.join(".") : "body",
    message: issue.message,
  }));
}

function validate(schemas) {
  return (req, res, next) => {
    const details = [];

    if (schemas.body) {
      const parsed = schemas.body.safeParse(req.body);
      if (!parsed.success) {
        details.push(...formatZodError(parsed.error));
      } else {
        req.body = parsed.data;
      }
    }

    if (schemas.params) {
      const parsed = schemas.params.safeParse(req.params);
      if (!parsed.success) {
        details.push(...formatZodError(parsed.error));
      } else {
        req.params = parsed.data;
      }
    }

    if (schemas.query) {
      const parsed = schemas.query.safeParse(req.query);
      if (!parsed.success) {
        details.push(...formatZodError(parsed.error));
      } else {
        Object.defineProperty(req, "query", {
          value: parsed.data,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      }
    }

    if (details.length > 0) {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_ERROR",
        details,
      });
    }

    return next();
  };
}

module.exports = { validate };
