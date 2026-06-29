const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const upload = require('../src/middleware/upload');

test('sanitizes uploaded file names', () => {
  assert.equal(
    upload.sanitizeFileName('../../candidate<script>.pdf'),
    'candidate_script_.pdf'
  );
});

test('checks the actual PDF signature', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'resume-upload-test-'));
  const pdfPath = path.join(directory, 'valid.pdf');
  const fakePath = path.join(directory, 'fake.pdf');
  fs.writeFileSync(pdfPath, '%PDF-1.7 test');
  fs.writeFileSync(fakePath, 'not a pdf');

  try {
    assert.equal(upload.hasPdfSignature(pdfPath), true);
    assert.equal(upload.hasPdfSignature(fakePath), false);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('checks supported resume file signatures', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'resume-upload-test-'));
  const pdfPath = path.join(directory, 'valid.pdf');
  const pngPath = path.join(directory, 'valid.png');
  const docxPath = path.join(directory, 'valid.docx');
  const fakePath = path.join(directory, 'fake.pdf');
  fs.writeFileSync(pdfPath, '%PDF-1.7 test');
  fs.writeFileSync(pngPath, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  fs.writeFileSync(docxPath, Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  fs.writeFileSync(fakePath, 'not a pdf');

  try {
    assert.equal(upload.hasSupportedSignature(pdfPath, 'resume.pdf'), true);
    assert.equal(upload.hasSupportedSignature(pngPath, 'resume.png'), true);
    assert.equal(upload.hasSupportedSignature(docxPath, 'resume.docx'), true);
    assert.equal(upload.hasSupportedSignature(fakePath, 'resume.pdf'), false);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
