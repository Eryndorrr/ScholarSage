import pytest
from app.schemas.collection import CollectionCreate, CollectionResponse


def test_collection_create_valid():
    """测试有效的创建数据"""
    data = {
        "name": "RAG技术研究",
        "description": "关于RAG技术的论文",
        "color": "#1976d2"
    }
    collection = CollectionCreate(**data)
    assert collection.name == "RAG技术研究"
    assert collection.color == "#1976d2"


def test_collection_create_minimal():
    """测试最小必填数据"""
    collection = CollectionCreate(name="测试知识库")
    assert collection.name == "测试知识库"
    assert collection.description == ""
    assert collection.color == "#1976d2"


def test_collection_create_invalid_color():
    """测试无效颜色格式"""
    with pytest.raises(ValueError):
        CollectionCreate(name="测试", color="invalid-color")