const { PDFParse } = require('pdf-parse');
const { Poppler } = require('node-poppler');
const { createWorker } = require('tesseract.js');
const mammoth = require('mammoth');
const sharp = require('sharp');
const WordExtractor = require('word-extractor');
const fs = require('fs');
const os = require('os');
const path = require('path');
const logger = require('../utils/logger');

const poppler = new Poppler();
const MIN_EXTRACTED_TEXT_LENGTH = 20;
const DEFAULT_OCR_MAX_PAGES = 3;
const OCR_RENDER_DPI = 220;
const wordExtractor = new WordExtractor();

const supportedExtensions = new Set(['.pdf', '.docx', '.doc', '.txt', '.rtf', '.png', '.jpg', '.jpeg', '.webp', '.tif', '.tiff']);

exports.extractText = async (filePath) => {
  const extension = path.extname(filePath || '').toLowerCase();

  if (!supportedExtensions.has(extension)) {
    throw new Error('Unsupported resume format. Upload a PDF, DOCX, DOC, TXT, RTF, PNG, JPG, WEBP, or TIFF file.');
  }

  if (extension === '.pdf') return extractPdfText(filePath);
  if (extension === '.docx') return extractDocxText(filePath);
  if (extension === '.doc') return extractDocText(filePath);
  if (extension === '.txt') return extractPlainText(filePath);
  if (extension === '.rtf') return extractRtfText(filePath);
  return extractImageText(filePath);
};

async function extractPdfText(filePath) {
  try {
    // Try Poppler first (more reliable for various PDF formats)
    let text = await tryPoppler(filePath);
    
    // Fallback to pdf-parse if Poppler fails
    if (!hasUsableText(text)) {
      logger.info('Poppler extraction yielded insufficient text, trying pdf-parse...');
      const buffer = fs.readFileSync(filePath);
      text = await tryPdfParse(buffer);
    }

    if (!hasUsableText(text)) {
      logger.info('Text extraction yielded insufficient text, trying OCR...');
      text = await tryOcr(filePath);
    }

    if (hasUsableText(text)) {
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
}

async function extractDocxText(filePath) {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    const text = result?.value?.trim() || '';
    if (hasUsableText(text)) {
      logger.info(`Successfully extracted ${text.length} characters from DOCX`);
      return exports.cleanText(text);
    }
    return extractWordText(filePath, 'DOCX');
  } catch (error) {
    logger.warn(`mammoth DOCX extraction failed: ${error.message}`);
    return extractWordText(filePath, 'DOCX');
  }
}

async function extractDocText(filePath) {
  return extractWordText(filePath, 'DOC');
}

async function extractWordText(filePath, label) {
  try {
    const doc = await wordExtractor.extract(filePath);
    const text = [
      doc.getHeaders?.() || '',
      doc.getBody?.() || '',
      doc.getTextboxes?.() || '',
      doc.getFooters?.() || '',
      doc.getFootnotes?.() || '',
      doc.getEndnotes?.() || ''
    ].join('\n\n').trim();

    if (hasUsableText(text)) {
      logger.info(`Successfully extracted ${text.length} characters from ${label}`);
      return exports.cleanText(text);
    }

    throw new Error(`Unable to extract text from this ${label} file. It may contain only images or unsupported Word content.`);
  } catch (error) {
    logger.error(`${label} extraction error: ${error.message}`);
    throw error;
  }
}

async function extractPlainText(filePath) {
  try {
    const text = await fs.promises.readFile(filePath, 'utf8');
    if (hasUsableText(text)) {
      logger.info(`Successfully extracted ${text.length} characters from text file`);
      return exports.cleanText(text);
    }
    throw new Error('Unable to extract text from this text file.');
  } catch (error) {
    logger.error('Text file extraction error:', error.message);
    throw error;
  }
}

async function extractRtfText(filePath) {
  try {
    const rtf = await fs.promises.readFile(filePath, 'utf8');
    const text = rtf
      .replace(/\\'[0-9a-fA-F]{2}/g, ' ')
      .replace(/\\[a-zA-Z]+\d* ?/g, ' ')
      .replace(/[{}]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (hasUsableText(text)) {
      logger.info(`Successfully extracted ${text.length} characters from RTF`);
      return exports.cleanText(text);
    }
    throw new Error('Unable to extract text from this RTF file.');
  } catch (error) {
    logger.error('RTF extraction error:', error.message);
    throw error;
  }
}

async function extractImageText(filePath) {
  const text = await tryImageOcr(filePath);
  if (hasUsableText(text)) {
    logger.info(`Successfully extracted ${text.length} characters from image resume`);
    return exports.cleanText(text);
  }
  throw new Error('Unable to extract text from this image. Try a clearer image or upload the original PDF/DOCX resume.');
}

function hasUsableText(text) {
  return typeof text === 'string' && text.trim().length > MIN_EXTRACTED_TEXT_LENGTH;
}

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

async function tryOcr(filePath) {
  let tempDir;
  let worker;

  try {
    const pageCount = await getPageCount(filePath);
    const maxPages = getOcrMaxPages();
    const pagesToRead = Math.max(1, Math.min(pageCount || maxPages, maxPages));

    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'resume-ocr-'));
    const outputPrefix = path.join(tempDir, 'page');

    await poppler.pdfToCairo(filePath, outputPrefix, {
      firstPageToConvert: 1,
      lastPageToConvert: pagesToRead,
      pngFile: true,
      resolutionXYAxis: OCR_RENDER_DPI
    });

    const imagePaths = (await fs.promises.readdir(tempDir))
      .filter(fileName => fileName.toLowerCase().endsWith('.png'))
      .sort((a, b) => pageNumberFromImage(a) - pageNumberFromImage(b))
      .map(fileName => path.join(tempDir, fileName));

    if (!imagePaths.length) return '';

    worker = await createWorker('eng', 1, { logger: () => {} });
    const pages = [];

    for (const imagePath of imagePaths) {
      const result = await worker.recognize(imagePath);
      const pageText = result?.data?.text?.trim();
      if (pageText) pages.push(pageText);
    }

    const text = pages.join('\n\n').trim();
    if (text) logger.info(`OCR extracted ${text.length} characters from ${imagePaths.length} page(s)`);
    return text;
  } catch (error) {
    logger.warn(`OCR extraction failed: ${error.message}`);
    return '';
  } finally {
    if (worker) {
      await worker.terminate().catch(() => {});
    }
    if (tempDir) {
      await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

async function tryImageOcr(filePath) {
  let tempDir;
  let worker;

  try {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'resume-image-ocr-'));
    const imagePath = path.join(tempDir, 'resume.png');

    await sharp(filePath)
      .rotate()
      .resize({ width: 2400, withoutEnlargement: false })
      .grayscale()
      .normalize()
      .png()
      .toFile(imagePath);

    worker = await createWorker('eng', 1, { logger: () => {} });
    const result = await worker.recognize(imagePath);
    const text = result?.data?.text?.trim() || '';
    if (text) logger.info(`Image OCR extracted ${text.length} characters`);
    return text;
  } catch (error) {
    logger.warn(`Image OCR failed: ${error.message}`);
    return '';
  } finally {
    if (worker) {
      await worker.terminate().catch(() => {});
    }
    if (tempDir) {
      await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

async function getPageCount(filePath) {
  try {
    const info = await poppler.pdfInfo(filePath);
    const infoText = typeof info === 'string'
      ? info
      : Object.entries(info || {}).map(([key, value]) => `${key}: ${value}`).join('\n');
    const match = infoText.match(/Pages:\s*(\d+)/i);
    return match ? Number(match[1]) : 0;
  } catch (error) {
    logger.warn(`Unable to read PDF page count for OCR: ${error.message}`);
    return 0;
  }
}

function getOcrMaxPages() {
  const configured = Number(process.env.RESUME_OCR_MAX_PAGES);
  if (Number.isInteger(configured) && configured > 0) return configured;
  return DEFAULT_OCR_MAX_PAGES;
}

function pageNumberFromImage(fileName) {
  const match = fileName.match(/-(\d+)\.png$/i);
  return match ? Number(match[1]) : 0;
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
