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
