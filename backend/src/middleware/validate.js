const { validationResult } = require('express-validator');

/**
 * Run after a chain of check() calls.
 * Returns 422 with structured error array on failure.
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }
  next();
}

module.exports = { validate };
