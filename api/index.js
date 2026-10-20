const mongoose = require('../server/node_modules/mongoose');
const app = require('../server/src/app');

let connection;
module.exports = async (req, res) => {
  try {
    if (!process.env.MONGODB_URI || !process.env.JWT_SECRET || !process.env.AGENT_INTERNAL_SECRET) {
      throw new Error('Missing required deployment environment settings');
    }
    if (!connection) {
      connection = mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
        .catch(error => { connection = undefined; throw error; });
    }
    await connection;
    return app(req, res);
  } catch (error) {
    console.error('API initialization failed:', error.message);
    res.status(503).json({ error: 'Service temporarily unavailable. Check deployment configuration.' });
  }
};
