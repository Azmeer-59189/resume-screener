const mongoose = require('mongoose');
const fs = require('fs');
const { pipeline } = require('stream/promises');
const path = require('path');

const bucket = () => new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'resumeFiles' });

exports.store = async (filePath, name) => {
  const upload = bucket().openUploadStream(path.basename(name));
  try {
    await pipeline(fs.createReadStream(filePath), upload);
    return upload.id;
  } catch (error) {
    await upload.abort().catch(() => {});
    throw error;
  }
};

exports.download = async (id, name, res, next) => {
  try {
    const storage = bucket();
    const files = await storage.find({ _id: id }).toArray();
    if (!files.length) return res.status(404).json({ error: 'Resume file not found.' });
    res.attachment(path.basename(name || 'resume.pdf'));
    await pipeline(storage.openDownloadStream(id), res);
  } catch (error) { next(error); }
};

exports.remove = id => bucket().delete(id);
