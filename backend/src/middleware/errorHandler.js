/**
 * Global Express error handler.
 * Must be registered last (after all routes).
 */
function errorHandler(err, req, res, _next) {
  console.error('[ERROR]', err.message, err.stack);

  const statusCode = err.statusCode || 500;
  const message =
    process.env.NODE_ENV === "development"
      ? err.message
      : err.expose
        ? err.message
        : "Internal server error";

  res.status(statusCode).json({ error: message });
}

module.exports = errorHandler;
