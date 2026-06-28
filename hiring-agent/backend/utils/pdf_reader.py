from pathlib import Path

from pypdf import PdfReader


def read_text_file(file_path: str | Path) -> str:
    """Read plain text files safely.

    Beginners often forget encoding. UTF-8 is the safest default for modern apps.
    """
    path = Path(file_path)
    return path.read_text(encoding="utf-8").strip()


def read_pdf_file(file_path: str | Path) -> str:
    """Extract text from a PDF file.

    Each PDF page may or may not contain selectable text. Scanned PDFs usually
    need OCR, which we are not adding yet because it is a separate production
    concern.
    """
    path = Path(file_path)
    reader = PdfReader(str(path))

    page_texts: list[str] = []
    for page in reader.pages:
        text = page.extract_text() or ""
        if text.strip():
            page_texts.append(text.strip())

    return "\n\n".join(page_texts).strip()


def read_document_text(file_path: str | Path) -> str:
    """Read text from either a PDF or a plain text file.

    This utility gives every agent one simple function to call, instead of
    making each agent know about file extensions.
    """
    path = Path(file_path)
    suffix = path.suffix.lower()

    if suffix == ".pdf":
        return read_pdf_file(path)

    if suffix in {".txt", ".md"}:
        return read_text_file(path)

    raise ValueError(f"Unsupported file type: {suffix}. Use PDF, TXT, or MD.")


# NEXT STEP: Build the JD Parser Agent that turns raw job text into JSON.
