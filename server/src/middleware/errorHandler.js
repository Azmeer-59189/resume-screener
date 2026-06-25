const logger = require('../utils/logger');

module.exports = (err, req, res, next) => {
  logger.error(err.message || 'Unknown error');

  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }

  if (err.code === 11000) {
    return res.status(409).json({ error: 'Duplicate entry — this record already exists.' });
  }

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Invalid token.' });
  }

  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal server error.' });
};