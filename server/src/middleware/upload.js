const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const uploadDir = path.join(__dirname, '../../uploads/resumes');
fs.mkdirSync(uploadDir, { recursive: true });

const sanitizeFileName = (fileName = 'resume.pdf') => {
  const safe = path.basename(fileName)
    .replace(/[^a-zA-Z0-9._ -]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  return safe || 'resume.pdf';
};

const hasPdfSignature = filePath => {
  const descriptor = fs.openSync(filePath, 'r');
  try {
    const header = Buffer.alloc(5);
    fs.readSync(descriptor, header, 0, 5, 0);
    return header.toString('ascii') === '%PDF-';
  } finally {
    fs.closeSync(descriptor);
  }
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${uuidv4()}-${sanitizeFileName(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed'), false);
  }
});

upload.validatePdfSignature = (req, res, next) => {
  if (!req.file) return next();
  try {
    if (!hasPdfSignature(req.file.path)) {
      fs.unlinkSync(req.file.path);
      req.file = undefined;
      return res.status(400).json({ error: 'The uploaded file is not a valid PDF.' });
    }
    next();
  } catch (error) {
    fs.promises.unlink(req.file.path).catch(() => {});
    next(error);
  }
};

upload.sanitizeFileName = sanitizeFileName;
upload.hasPdfSignature = hasPdfSignature;

module.exports = upload;
