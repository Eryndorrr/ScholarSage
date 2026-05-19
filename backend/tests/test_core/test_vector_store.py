import pytest
from unittest.mock import Mock, patch, MagicMock
from app.core.rag.vector_store import VectorStore, VectorStoreError
import chromadb
from chromadb.errors import ChromaError


class TestVectorStore:
    """测试VectorStore类"""

    def test_init_with_default_persist_dir(self):
        """测试使用默认持久化目录初始化"""
        with patch("app.core.rag.vector_store.chromadb.PersistentClient") as mock_client:
            mock_client.return_value = Mock()
            with patch("app.core.rag.vector_store.settings") as mock_settings:
                mock_settings.chroma_persist_dir = "/test/path"
                store = VectorStore()
                mock_client.assert_called_once_with(path="/test/path")

    def test_init_with_custom_persist_dir(self):
        """测试使用自定义持久化目录初始化"""
        with patch("app.core.rag.vector_store.chromadb.PersistentClient") as mock_client:
            mock_client.return_value = Mock()
            store = VectorStore(persist_dir="/custom/path")
            mock_client.assert_called_once_with(path="/custom/path")

    @patch("app.core.rag.vector_store.chromadb.PersistentClient")
    def test_create_collection_success(self, mock_client):
        """测试成功创建集合"""
        mock_client.return_value = Mock()
        mock_collection = Mock()
        mock_client.return_value.create_collection.return_value = mock_collection

        store = VectorStore(persist_dir="/test")
        result = store.create_collection("test_collection")

        mock_client.return_value.create_collection.assert_called_once_with(
            name="test_collection",
            metadata={"hnsw:space": "cosine"}
        )
        assert result == mock_collection

    @patch("app.core.rag.vector_store.chromadb.PersistentClient")
    def test_create_collection_error(self, mock_client):
        """测试创建集合失败"""
        mock_client.return_value = Mock()
        mock_client.return_value.create_collection.side_effect = ChromaError("Error")

        store = VectorStore(persist_dir="/test")

        with pytest.raises(VectorStoreError) as exc_info:
            store.create_collection("test_collection")
        assert "Failed to create collection" in str(exc_info.value)

    @patch("app.core.rag.vector_store.chromadb.PersistentClient")
    def test_get_collection_success(self, mock_client):
        """测试成功获取集合"""
        mock_client.return_value = Mock()
        mock_collection = Mock()
        mock_client.return_value.get_collection.return_value = mock_collection

        store = VectorStore(persist_dir="/test")
        result = store.get_collection("test_collection")

        mock_client.return_value.get_collection.assert_called_once_with(name="test_collection")
        assert result == mock_collection

    @patch("app.core.rag.vector_store.chromadb.PersistentClient")
    def test_get_collection_error(self, mock_client):
        """测试获取集合失败"""
        mock_client.return_value = Mock()
        mock_client.return_value.get_collection.side_effect = ChromaError("Error")

        store = VectorStore(persist_dir="/test")

        with pytest.raises(VectorStoreError) as exc_info:
            store.get_collection("test_collection")
        assert "Failed to get collection" in str(exc_info.value)

    @patch("app.core.rag.vector_store.chromadb.PersistentClient")
    def test_delete_collection_success(self, mock_client):
        """测试成功删除集合"""
        mock_client.return_value = Mock()

        store = VectorStore(persist_dir="/test")
        store.delete_collection("test_collection")

        mock_client.return_value.delete_collection.assert_called_once_with(name="test_collection")

    @patch("app.core.rag.vector_store.chromadb.PersistentClient")
    def test_delete_collection_error(self, mock_client):
        """测试删除集合失败"""
        mock_client.return_value = Mock()
        mock_client.return_value.delete_collection.side_effect = ChromaError("Error")

        store = VectorStore(persist_dir="/test")

        with pytest.raises(VectorStoreError) as exc_info:
            store.delete_collection("test_collection")
        assert "Failed to delete collection" in str(exc_info.value)

    @patch("app.core.rag.vector_store.chromadb.PersistentClient")
    def test_add_documents_success(self, mock_client):
        """测试成功添加文档"""
        mock_client.return_value = Mock()
        mock_collection = Mock()
        mock_client.return_value.get_or_create_collection.return_value = mock_collection

        store = VectorStore(persist_dir="/test")
        store.add_documents(
            collection_name="test",
            documents=["doc1"],
            embeddings=[[0.1, 0.2]],
            ids=["id1"]
        )

        mock_collection.add.assert_called_once()

    @patch("app.core.rag.vector_store.chromadb.PersistentClient")
    def test_add_documents_error(self, mock_client):
        """测试添加文档失败"""
        mock_client.return_value = Mock()
        mock_client.return_value.get_or_create_collection.side_effect = ChromaError("Error")

        store = VectorStore(persist_dir="/test")

        with pytest.raises(VectorStoreError) as exc_info:
            store.add_documents(
                collection_name="test",
                documents=["doc1"],
                embeddings=[[0.1, 0.2]]
            )
        assert "Failed to get or create collection" in str(exc_info.value)

    @patch("app.core.rag.vector_store.chromadb.PersistentClient")
    def test_search_success(self, mock_client):
        """测试成功搜索"""
        mock_client.return_value = Mock()
        mock_collection = Mock()
        mock_client.return_value.get_collection.return_value = mock_collection
        mock_collection.query.return_value = {
            "documents": [["content1"]],
            "metadatas": [[{"key": "value"}]],
            "distances": [[0.1]],
            "ids": [["id1"]]
        }

        store = VectorStore(persist_dir="/test")
        results = store.search("test", [0.1, 0.2], top_k=3)

        assert results["documents"] == [["content1"]]

    @patch("app.core.rag.vector_store.chromadb.PersistentClient")
    def test_search_error(self, mock_client):
        """测试搜索失败"""
        mock_client.return_value = Mock()
        mock_collection = Mock()
        mock_client.return_value.get_collection.return_value = mock_collection
        mock_collection.query.side_effect = ChromaError("Error")

        store = VectorStore(persist_dir="/test")

        with pytest.raises(VectorStoreError) as exc_info:
            store.search("test", [0.1, 0.2])
        assert "Failed to search" in str(exc_info.value)
