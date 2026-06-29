const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const uploadDir = path.join(__dirname, '../../uploads/resumes');
fs.mkdirSync(uploadDir, { recursive: true });

const allowedExtensions = new Set(['.pdf', '.docx', '.doc', '.txt', '.rtf', '.png', '.jpg', '.jpeg', '.webp', '.tif', '.tiff']);
const allowedMimeTypes = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
  'application/rtf',
  'text/rtf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/tiff'
]);

const supportedFormatsLabel = 'PDF, DOCX, DOC, TXT, RTF, PNG, JPG, WEBP, or TIFF';

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

const getFileExtension = fileName => path.extname(fileName || '').toLowerCase();

const hasZipSignature = filePath => {
  const descriptor = fs.openSync(filePath, 'r');
  try {
    const header = Buffer.alloc(4);
    fs.readSync(descriptor, header, 0, 4, 0);
    return header[0] === 0x50 && header[1] === 0x4b;
  } finally {
    fs.closeSync(descriptor);
  }
};

const hasDocSignature = filePath => {
  const descriptor = fs.openSync(filePath, 'r');
  try {
    const header = Buffer.alloc(8);
    fs.readSync(descriptor, header, 0, 8, 0);
    return header.equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
  } finally {
    fs.closeSync(descriptor);
  }
};

const hasPngSignature = filePath => {
  const descriptor = fs.openSync(filePath, 'r');
  try {
    const header = Buffer.alloc(8);
    fs.readSync(descriptor, header, 0, 8, 0);
    return header.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  } finally {
    fs.closeSync(descriptor);
  }
};

const hasJpegSignature = filePath => {
  const descriptor = fs.openSync(filePath, 'r');
  try {
    const header = Buffer.alloc(3);
    fs.readSync(descriptor, header, 0, 3, 0);
    return header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  } finally {
    fs.closeSync(descriptor);
  }
};

const hasWebpSignature = filePath => {
  const descriptor = fs.openSync(filePath, 'r');
  try {
    const header = Buffer.alloc(12);
    fs.readSync(descriptor, header, 0, 12, 0);
    return header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP';
  } finally {
    fs.closeSync(descriptor);
  }
};

const hasTiffSignature = filePath => {
  const descriptor = fs.openSync(filePath, 'r');
  try {
    const header = Buffer.alloc(4);
    fs.readSync(descriptor, header, 0, 4, 0);
    return (
      header.equals(Buffer.from([0x49, 0x49, 0x2a, 0x00])) ||
      header.equals(Buffer.from([0x4d, 0x4d, 0x00, 0x2a]))
    );
  } finally {
    fs.closeSync(descriptor);
  }
};

const isProbablyTextFile = filePath => {
  const sample = fs.readFileSync(filePath, { encoding: null }).subarray(0, 4096);
  if (!sample.length) return false;
  let controlBytes = 0;
  for (const byte of sample) {
    const isAllowedControl = byte === 0x09 || byte === 0x0a || byte === 0x0d;
    if (byte < 0x20 && !isAllowedControl) controlBytes += 1;
  }
  return controlBytes / sample.length < 0.02;
};

const hasSupportedSignature = (filePath, originalName) => {
  const extension = getFileExtension(originalName);
  if (extension === '.pdf') return hasPdfSignature(filePath);
  if (extension === '.docx') return hasZipSignature(filePath);
  if (extension === '.doc') return hasDocSignature(filePath);
  if (extension === '.png') return hasPngSignature(filePath);
  if (extension === '.jpg' || extension === '.jpeg') return hasJpegSignature(filePath);
  if (extension === '.webp') return hasWebpSignature(filePath);
  if (extension === '.tif' || extension === '.tiff') return hasTiffSignature(filePath);
  if (extension === '.txt' || extension === '.rtf') return isProbablyTextFile(filePath);
  return false;
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
    const extension = getFileExtension(file.originalname);
    if (allowedExtensions.has(extension) || allowedMimeTypes.has(file.mimetype)) cb(null, true);
    else cb(new Error(`Only ${supportedFormatsLabel} files are allowed.`), false);
  }
});

upload.validateResumeFile = (req, res, next) => {
  if (!req.file) return next();
  try {
    if (!hasSupportedSignature(req.file.path, req.file.originalname)) {
      fs.unlinkSync(req.file.path);
      req.file = undefined;
      return res.status(400).json({ error: `The uploaded file is not a valid ${supportedFormatsLabel} file.` });
    }
    next();
  } catch (error) {
    fs.promises.unlink(req.file.path).catch(() => {});
    next(error);
  }
};

upload.sanitizeFileName = sanitizeFileName;
upload.hasPdfSignature = hasPdfSignature;
upload.hasSupportedSignature = hasSupportedSignature;
upload.supportedFormatsLabel = supportedFormatsLabel;

module.exports = upload;
