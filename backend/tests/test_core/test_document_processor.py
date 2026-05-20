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
    mock_parser_instance.chunk_text_with_pages.return_value = [("片段1", 1), ("片段2", 1)]

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


@patch("app.core.rag.document_processor.get_bm25_retriever")
@patch("app.core.rag.document_processor.VectorStore")
@patch("app.core.rag.document_processor.EmbeddingEngine")
@patch("app.core.rag.document_processor.PDFParser")
def test_document_processor_rolls_back_vectors_when_bm25_indexing_fails(
    mock_parser,
    mock_embedding,
    mock_vector_store,
    mock_get_bm25_retriever,
):
    """BM25 写入失败时应清理已写入的向量，避免半成功索引。"""
    mock_parser_instance = Mock()
    mock_parser.return_value = mock_parser_instance
    mock_parser_instance.extract_text.return_value = "测试内容"
    mock_parser_instance.chunk_text_with_pages.return_value = [("片段1", 1), ("片段2", 1)]

    mock_embedding_instance = Mock()
    mock_embedding.return_value = mock_embedding_instance
    mock_embedding_instance.embed_batch.return_value = [[0.1, 0.2], [0.3, 0.4]]

    mock_vector_store_instance = Mock()
    mock_vector_store.return_value = mock_vector_store_instance

    mock_bm25 = Mock()
    mock_bm25.index_documents.side_effect = RuntimeError("bm25 unavailable")
    mock_get_bm25_retriever.return_value = mock_bm25

    processor = DocumentProcessor()
    result = processor.process_document(
        file_path="test.pdf",
        collection_id="test-collection",
        file_type=FileType.PDF,
        document_id="doc-1",
        document_title="Test Doc",
    )

    assert result["success"] is False
    assert "bm25 unavailable" in result["error"]
    mock_vector_store_instance.add_documents.assert_called_once()
    mock_vector_store_instance.delete_document.assert_called_once_with("test-collection", "doc-1")
    mock_bm25.remove_document.assert_called_once_with("test-collection", "doc-1")


@patch("app.core.rag.document_processor.get_bm25_retriever")
@patch("app.core.rag.document_processor.VectorStore")
@patch("app.core.rag.document_processor.EmbeddingEngine")
@patch("app.core.rag.document_processor.PDFParser")
def test_document_processor_rolls_back_bm25_when_vector_store_fails(
    mock_parser,
    mock_embedding,
    mock_vector_store,
    mock_get_bm25_retriever,
):
    """向量写入失败时也应尝试清理该文档残留的 BM25 条目。"""
    mock_parser_instance = Mock()
    mock_parser.return_value = mock_parser_instance
    mock_parser_instance.extract_text.return_value = "测试内容"
    mock_parser_instance.chunk_text_with_pages.return_value = [("片段1", 1), ("片段2", 1)]

    mock_embedding_instance = Mock()
    mock_embedding.return_value = mock_embedding_instance
    mock_embedding_instance.embed_batch.return_value = [[0.1, 0.2], [0.3, 0.4]]

    mock_vector_store_instance = Mock()
    mock_vector_store.return_value = mock_vector_store_instance
    mock_vector_store_instance.add_documents.side_effect = RuntimeError("vector unavailable")

    mock_bm25 = Mock()
    mock_get_bm25_retriever.return_value = mock_bm25

    processor = DocumentProcessor()
    result = processor.process_document(
        file_path="test.pdf",
        collection_id="test-collection",
        file_type=FileType.PDF,
        document_id="doc-1",
        document_title="Test Doc",
    )

    assert result["success"] is False
    assert "vector unavailable" in result["error"]
    mock_bm25.index_documents.assert_not_called()
    mock_vector_store_instance.delete_document.assert_called_once_with("test-collection", "doc-1")
    mock_bm25.remove_document.assert_called_once_with("test-collection", "doc-1")
