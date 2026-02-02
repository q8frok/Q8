/**
 * Document Validation
 * Magic bytes validation to ensure file content matches claimed type
 */

import type { FileType } from './types';

/**
 * Validate that file content matches expected file type via magic bytes
 */
export function validateMagicBytes(buffer: ArrayBuffer, expectedType: FileType): boolean {
  const bytes = new Uint8Array(buffer);

  if (bytes.length < 4) {
    // Too small to validate, allow text-based types
    return ['txt', 'md', 'csv', 'json', 'code'].includes(expectedType);
  }

  switch (expectedType) {
    case 'pdf':
      // %PDF
      return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;

    case 'docx':
    case 'xlsx':
    case 'xls':
    case 'pptx':
    case 'ppt':
      // ZIP-based formats start with PK (0x50 0x4B)
      return bytes[0] === 0x50 && bytes[1] === 0x4B;

    case 'image': {
      // PNG: 89 50 4E 47
      if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return true;
      // JPEG: FF D8 FF
      if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return true;
      // GIF: GIF8
      if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return true;
      // WebP: RIFF....WEBP
      if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return true;
      // SVG: starts with < (XML)
      if (bytes[0] === 0x3C) return true;
      return false;
    }

    case 'txt':
    case 'md':
    case 'csv':
    case 'json':
    case 'code':
      // Text-based files: verify content is valid UTF-8
      return isValidUtf8(bytes);

    case 'doc':
      // MS-CFB: D0 CF 11 E0
      return bytes[0] === 0xD0 && bytes[1] === 0xCF && bytes[2] === 0x11 && bytes[3] === 0xE0;

    default:
      return true; // Allow unknown types through
  }
}

/**
 * Check if bytes represent valid UTF-8 text (sample first 1024 bytes)
 */
function isValidUtf8(bytes: Uint8Array): boolean {
  const sampleSize = Math.min(bytes.length, 1024);
  let nullCount = 0;

  for (let i = 0; i < sampleSize; i++) {
    const byte = bytes[i]!;
    if (byte === 0x00) {
      nullCount++;
      // Too many null bytes suggests binary
      if (nullCount > 2) return false;
    }
  }

  // Try decoding as UTF-8
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    decoder.decode(bytes.slice(0, sampleSize));
    return true;
  } catch {
    return false;
  }
}

/**
 * Get a human-readable description for validation failure
 */
export function getValidationErrorMessage(expectedType: FileType): string {
  const typeNames: Partial<Record<FileType, string>> = {
    pdf: 'PDF',
    docx: 'Word document (DOCX)',
    xlsx: 'Excel spreadsheet',
    pptx: 'PowerPoint presentation',
    image: 'image',
    doc: 'Word document (DOC)',
  };

  const name = typeNames[expectedType] || expectedType.toUpperCase();
  return `Invalid file content: the file does not appear to be a valid ${name}. The file extension may not match the actual content.`;
}
