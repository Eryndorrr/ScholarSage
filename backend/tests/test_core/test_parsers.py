import pytest
from app.core.parsers.pdf_parser import PDFParser
from app.core.parsers.markdown_parser import MarkdownParser


def test_markdown_parser_extract_text():
    """测试Markdown文本提取"""
    content = "# 标题\n\n这是正文内容。"
    parser = MarkdownParser(content)
    text = parser.extract_text()
    assert "标题" in text
    assert "正文内容" in text


def test_markdown_parser_chunk_text():
    """测试Markdown文本切分"""
    content = "这是第一段。\n\n这是第二段。\n\n这是第三段。"
    parser = MarkdownParser(content)
    chunks = parser.chunk_text(chunk_size=20, overlap=5)
    assert len(chunks) > 0
    assert all(len(chunk) <= 25 for chunk in chunks)  # 考虑overlap


def test_pdf_parser_file_not_found():
    """测试PDF文件不存在"""
    with pytest.raises(FileNotFoundError):
        PDFParser("nonexistent.pdf").extract_text()
