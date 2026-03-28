import pytest
from unittest.mock import Mock, patch, MagicMock
from app.core.rag.retriever import Retriever, RetrieverError
from app.core.rag.vector_store import VectorStore, VectorStoreError


class TestRetriever:
    """测试Retriever类"""

    def test_init_with_default_values(self):
        """测试使用默认值初始化"""
        with patch("app.core.rag.retriever.VectorStore") as mock_store:
            with patch("app.core.rag.retriever.EmbeddingEngine") as mock_engine:
                mock_store.return_value = Mock()
                mock_engine.return_value = Mock()

                retriever = Retriever()

                mock_store.assert_called_once()
                mock_engine.assert_called_once()

    def test_init_with_custom_values(self):
        """测试使用自定义值初始化"""
        mock_store = Mock(spec=VectorStore)
        mock_engine = Mock()

        retriever = Retriever(vector_store=mock_store, embedding_engine=mock_engine)

        assert retriever.vector_store == mock_store
        assert retriever.embedding_engine == mock_engine

    @patch("app.core.rag.retriever.EmbeddingEngine")
    def test_retrieve_success_with_results(self, mock_engine_class):
        """测试成功检索并返回结果"""
        mock_store = Mock(spec=VectorStore)
        mock_engine = Mock()
        mock_engine_class.return_value = mock_engine
        mock_engine.embed_text.return_value = [0.1, 0.2, 0.3]

        mock_store.search.return_value = {
            "documents": [["content1", "content2"]],
            "metadatas": [[{"source": "doc1"}, {"source": "doc2"}]],
            "distances": [[0.1, 0.2]],
            "ids": [["id1", "id2"]]
        }

        retriever = Retriever(vector_store=mock_store, embedding_engine=mock_engine)
        results = retriever.retrieve("test query", "test_collection", top_k=2)

        assert len(results) == 2
        assert results[0]["content"] == "content1"
        assert results[0]["metadata"] == {"source": "doc1"}
        assert results[0]["distance"] == 0.1
        assert results[0]["id"] == "id1"

    @patch("app.core.rag.retriever.EmbeddingEngine")
    def test_retrieve_empty_results(self, mock_engine_class):
        """测试空结果"""
        mock_store = Mock(spec=VectorStore)
        mock_engine = Mock()
        mock_engine_class.return_value = mock_engine
        mock_engine.embed_text.return_value = [0.1, 0.2, 0.3]

        mock_store.search.return_value = {
            "documents": [[]],
            "metadatas": [[]],
            "distances": [[]],
            "ids": [[]]
        }

        retriever = Retriever(vector_store=mock_store, embedding_engine=mock_engine)
        results = retriever.retrieve("test query", "test_collection")

        assert results == []

    @patch("app.core.rag.retriever.EmbeddingEngine")
    def test_retrieve_no_documents_key(self, mock_engine_class):
        """测试结果中没有documents键"""
        mock_store = Mock(spec=VectorStore)
        mock_engine = Mock()
        mock_engine_class.return_value = mock_engine
        mock_engine.embed_text.return_value = [0.1, 0.2, 0.3]

        mock_store.search.return_value = {}

        retriever = Retriever(vector_store=mock_store, embedding_engine=mock_engine)
        results = retriever.retrieve("test query", "test_collection")

        assert results == []

    @patch("app.core.rag.retriever.EmbeddingEngine")
    def test_retrieve_none_results(self, mock_engine_class):
        """测试结果为None"""
        mock_store = Mock(spec=VectorStore)
        mock_engine = Mock()
        mock_engine_class.return_value = mock_engine
        mock_engine.embed_text.return_value = [0.1, 0.2, 0.3]

        mock_store.search.return_value = None

        retriever = Retriever(vector_store=mock_store, embedding_engine=mock_engine)
        results = retriever.retrieve("test query", "test_collection")

        assert results == []

    @patch("app.core.rag.retriever.EmbeddingEngine")
    def test_retrieve_vector_store_error(self, mock_engine_class):
        """测试VectorStore错误"""
        mock_store = Mock(spec=VectorStore)
        mock_engine = Mock()
        mock_engine_class.return_value = mock_engine
        mock_engine.embed_text.return_value = [0.1, 0.2, 0.3]

        mock_store.search.side_effect = VectorStoreError("Search failed")

        retriever = Retriever(vector_store=mock_store, embedding_engine=mock_engine)

        with pytest.raises(RetrieverError) as exc_info:
            retriever.retrieve("test query", "test_collection")
        assert "Failed to retrieve documents" in str(exc_info.value)

    @patch("app.core.rag.retriever.EmbeddingEngine")
    def test_retrieve_without_metadata(self, mock_engine_class):
        """测试结果中没有metadata"""
        mock_store = Mock(spec=VectorStore)
        mock_engine = Mock()
        mock_engine_class.return_value = mock_engine
        mock_engine.embed_text.return_value = [0.1, 0.2, 0.3]

        mock_store.search.return_value = {
            "documents": [["content1"]],
            "metadatas": [None],
            "distances": [[0.1]],
            "ids": [["id1"]]
        }

        retriever = Retriever(vector_store=mock_store, embedding_engine=mock_engine)
        results = retriever.retrieve("test query", "test_collection")

        assert results[0]["metadata"] == {}

    @patch("app.core.rag.retriever.EmbeddingEngine")
    def test_retrieve_without_distances(self, mock_engine_class):
        """测试结果中没有distances"""
        mock_store = Mock(spec=VectorStore)
        mock_engine = Mock()
        mock_engine_class.return_value = mock_engine
        mock_engine.embed_text.return_value = [0.1, 0.2, 0.3]

        mock_store.search.return_value = {
            "documents": [["content1"]],
            "metadatas": [[{}]],
            "distances": [None],
            "ids": [["id1"]]
        }

        retriever = Retriever(vector_store=mock_store, embedding_engine=mock_engine)
        results = retriever.retrieve("test query", "test_collection")

        assert results[0]["distance"] == 0