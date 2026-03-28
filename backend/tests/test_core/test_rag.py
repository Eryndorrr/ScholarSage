import pytest
from unittest.mock import Mock, patch
from app.core.rag.embeddings import EmbeddingEngine


@patch("app.core.rag.embeddings.OpenAI")
def test_embedding_engine_embed_text(mock_openai):
    """测试文本向量化"""
    mock_client = Mock()
    mock_openai.return_value = mock_client
    mock_client.embeddings.create.return_value = Mock(
        data=[Mock(embedding=[0.1, 0.2, 0.3])]
    )

    engine = EmbeddingEngine(api_key="test-key")
    embedding = engine.embed_text("测试文本")

    assert isinstance(embedding, list)
    assert len(embedding) == 3
    assert embedding == [0.1, 0.2, 0.3]


def test_embedding_engine_embed_batch():
    """测试批量向量化"""
    with patch("app.core.rag.embeddings.OpenAI") as mock_openai:
        mock_client = Mock()
        mock_openai.return_value = mock_client
        mock_client.embeddings.create.return_value = Mock(
            data=[Mock(embedding=[0.1, 0.2]) for _ in range(3)]
        )

        engine = EmbeddingEngine(api_key="test-key")
        texts = ["文本1", "文本2", "文本3"]
        embeddings = engine.embed_batch(texts)

        assert len(embeddings) == 3
        assert all(len(e) == 2 for e in embeddings)