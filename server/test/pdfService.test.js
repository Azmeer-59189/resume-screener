const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('API startup does not load the native PDF parser', () => {
  const result = spawnSync(process.execPath, ['-e', `
    const Module = require('node:module');
    const load = Module._load;
    Module._load = function(name, ...args) {
      if (name === 'pdf-parse' || name === '@napi-rs/canvas') throw new Error('PDF dependency unavailable');
      return load.call(this, name, ...args);
    };
    require('./src/app');
    process.exit(0);
  `], { cwd: path.join(__dirname, '..'), encoding: 'utf8', timeout: 15000 });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
});

test('text PDF extraction works through pdf-parse without Poppler', async () => {
  const Module = require('node:module');
  const load = Module._load;
  Module._load = function(name, ...args) {
    if (name === 'node-poppler') return { Poppler: class { async pdfToText() { return ''; } } };
    return load.call(this, name, ...args);
  };
  let extractText;
  try { ({ extractText } = require('../src/services/pdfService')); }
  finally { Module._load = load; }

  const content = 'BT /F1 12 Tf 72 720 Td (Python engineer builds reliable APIs and React dashboards.) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const file = path.join(os.tmpdir(), `resume-pdf-${require('node:crypto').randomUUID()}.pdf`);
  try {
    fs.writeFileSync(file, pdf);
    const text = await extractText(file);
    assert.match(text, /Python engineer builds reliable APIs/);
  } finally { fs.unlinkSync(file); }
});
