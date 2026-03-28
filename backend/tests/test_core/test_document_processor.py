import pytest
from unittest.mock import Mock, patch
from app.core.rag.document_processor import DocumentProcessor
from app.models.document import FileType


@patch("app.core.rag.document_processor.VectorStore")
@patch("app.core.rag.document_processor.EmbeddingEngine")
@patch("app.core.rag.document_processor.PDFParser")
def test_document_processor_process_pdf(mock_parser, mock_embedding, mock_vector_store):
    """测试PDF文档处理"""
    # Mock解析器
    mock_parser_instance = Mock()
    mock_parser.return_value = mock_parser_instance
    mock_parser_instance.extract_text.return_value = "测试内容"
    mock_parser_instance.chunk_text.return_value = ["片段1", "片段2"]

    # Mock向量化引擎
    mock_embedding_instance = Mock()
    mock_embedding.return_value = mock_embedding_instance
    mock_embedding_instance.embed_batch.return_value = [[0.1, 0.2], [0.3, 0.4]]

    # Mock向量存储
    mock_vector_store_instance = Mock()
    mock_vector_store.return_value = mock_vector_store_instance

    processor = DocumentProcessor()
    result = processor.process_document(
        file_path="test.pdf",
        collection_id="test-collection",
        file_type=FileType.PDF
    )

    assert result['success'] is True
    assert result['chunk_count'] == 2