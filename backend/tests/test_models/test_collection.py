import pytest
from app.models.collection import Collection
from datetime import datetime


def test_create_collection(db_session):
    """测试创建知识库"""
    collection = Collection(
        name="RAG技术研究",
        description="关于RAG技术的相关论文",
        color="#1976d2"
    )
    db_session.add(collection)
    db_session.commit()

    assert collection.id is not None
    assert collection.name == "RAG技术研究"
    assert collection.document_count == 0
    assert isinstance(collection.created_at, datetime)


def test_collection_default_color(db_session):
    """测试默认颜色"""
    collection = Collection(name="测试知识库")
    db_session.add(collection)
    db_session.commit()

    assert collection.color == "#1976d2"