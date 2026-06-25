const { PDFParse } = require('pdf-parse');
const { Poppler } = require('node-poppler');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const poppler = new Poppler();

exports.extractText = async (filePath) => {
  try {
    // Try Poppler first (more reliable for various PDF formats)
    let text = await tryPoppler(filePath);
    
    // Fallback to pdf-parse if Poppler fails
    if (!text || text.length < 20) {
      logger.info('Poppler extraction yielded insufficient text, trying pdf-parse...');
      const buffer = fs.readFileSync(filePath);
      text = await tryPdfParse(buffer);
    }

    if (text && text.length > 20) {
      logger.info(`Successfully extracted ${text.length} characters from PDF`);
      return exports.cleanText(text);
    }

    throw new Error(
      'Unable to extract text from this PDF. The file may be a scanned image or have an unsupported format.'
    );
  } catch (error) {
    logger.error('PDF extraction error:', error.message);
    throw error;
  }
};

async function tryPoppler(filePath) {
  try {
    const text = await poppler.pdfToText(filePath, '-');
    return text?.trim() || '';
  } catch (error) {
    logger.warn(`Poppler pdfToText failed: ${error.message}`);
    return '';
  }
}

async function tryPdfParse(buffer) {
  try {
    const uint8 = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const pdfParser = new PDFParse(uint8);
    const parsed = await pdfParser.getText();
    let text = parsed?.text?.trim() || '';
    
    if (!text && Array.isArray(parsed?.pages)) {
      text = parsed.pages
        .filter(p => p.text && p.text.trim())
        .map((page) => page.text.trim())
        .join('\n\n');
    }
    
    return text;
  } catch (error) {
    logger.warn(`pdf-parse failed: ${error.message}`);
    return '';
  }
}

exports.chunkText = (text, chunkSize = 500, overlap = 100) => {
  const words = text.split(/\s+/);
  const chunks = [];
  let i = 0;
  while (i < words.length) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    if (chunk.trim()) {
      chunks.push({ text: chunk.trim(), index: chunks.length });
    }
    i += chunkSize - overlap;
  }
  logger.info(`Created ${chunks.length} chunks from resume text`);
  return chunks;
};

exports.cleanText = (text) => {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s{2,}/g, ' ')
    .trim();
};
