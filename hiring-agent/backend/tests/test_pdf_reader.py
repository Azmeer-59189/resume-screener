from pathlib import Path

from reportlab.pdfgen import canvas

from backend.utils.pdf_reader import read_document_text


def test_read_text_file(tmp_path: Path) -> None:
    sample = tmp_path / "job.txt"
    sample.write_text("Python Developer\nBuild APIs with FastAPI.", encoding="utf-8")

    result = read_document_text(sample)

    assert "Python Developer" in result
    assert "FastAPI" in result


def test_read_pdf_file(tmp_path: Path) -> None:
    sample = tmp_path / "job.pdf"
    pdf = canvas.Canvas(str(sample))
    pdf.drawString(100, 750, "Backend Engineer")
    pdf.drawString(100, 730, "Python and FastAPI required")
    pdf.save()

    result = read_document_text(sample)

    assert "Backend Engineer" in result
    assert "FastAPI" in result
