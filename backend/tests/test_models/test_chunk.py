import pytest
from app.models.chunk import Chunk
from app.models.document import Document, FileType
from app.models.collection import Collection


def test_create_chunk(db_session):
    """测试创建切片"""
    collection = Collection(name="测试知识库")
    db_session.add(collection)
    db_session.commit()

    document = Document(
        collection_id=collection.id,
        title="测试文档",
        file_path="/uploads/test.pdf",
        file_type=FileType.PDF
    )
    db_session.add(document)
    db_session.commit()

    chunk = Chunk(
        document_id=document.id,
        content="这是测试切片内容",
        page_num=1,
        position=0
    )
    db_session.add(chunk)
    db_session.commit()

    assert chunk.id is not None
    assert chunk.content == "这是测试切片内容"
    assert chunk.page_num == 1
    assert chunk.position == 0


def test_chunk_default_values(db_session):
    """测试默认值"""
    collection = Collection(name="测试知识库")
    db_session.add(collection)
    db_session.commit()

    document = Document(
        collection_id=collection.id,
        title="测试文档",
        file_path="/uploads/test.pdf",
        file_type=FileType.PDF
    )
    db_session.add(document)
    db_session.commit()

    chunk = Chunk(
        document_id=document.id,
        content="测试内容"
    )
    db_session.add(chunk)
    db_session.commit()

    assert chunk.page_num == 0
    assert chunk.position == 0


def test_chunk_relationship(db_session):
    """测试切片与文档的关联"""
    collection = Collection(name="测试知识库")
    db_session.add(collection)
    db_session.commit()

    document = Document(
        collection_id=collection.id,
        title="测试文档",
        file_path="/uploads/test.pdf",
        file_type=FileType.PDF
    )
    db_session.add(document)
    db_session.commit()

    chunk = Chunk(
        document_id=document.id,
        content="测试内容"
    )
    db_session.add(chunk)
    db_session.commit()

    # 测试反向关系
    assert chunk.document is not None
    assert chunk.document.title == "测试文档"


def test_chunk_cascade_delete(db_session):
    """测试级联删除 - 删除文档时自动删除切片"""
    collection = Collection(name="测试知识库")
    db_session.add(collection)
    db_session.commit()

    document = Document(
        collection_id=collection.id,
        title="测试文档",
        file_path="/uploads/test.pdf",
        file_type=FileType.PDF
    )
    db_session.add(document)
    db_session.commit()

    # 创建多个切片
    for i in range(3):
        chunk = Chunk(
            document_id=document.id,
            content=f"切片{i}内容",
            page_num=i,
            position=i
        )
        db_session.add(chunk)
    db_session.commit()

    # 验证切片已创建
    chunks = db_session.query(Chunk).filter_by(document_id=document.id).all()
    assert len(chunks) == 3

    # 删除文档
    db_session.delete(document)
    db_session.commit()

    # 验证切片已级联删除
    chunks = db_session.query(Chunk).filter_by(document_id=document.id).all()
    assert len(chunks) == 0


def test_collection_cascade_delete_documents_and_chunks(db_session):
    """测试级联删除 - 删除知识库时自动删除文档和切片"""
    collection = Collection(name="测试知识库")
    db_session.add(collection)
    db_session.commit()

    # 创建文档
    document = Document(
        collection_id=collection.id,
        title="测试文档",
        file_path="/uploads/test.pdf",
        file_type=FileType.PDF
    )
    db_session.add(document)
    db_session.commit()

    # 创建切片
    chunk = Chunk(
        document_id=document.id,
        content="切片内容"
    )
    db_session.add(chunk)
    db_session.commit()

    # 验证数据存在
    assert db_session.query(Document).filter_by(id=document.id).first() is not None
    assert db_session.query(Chunk).filter_by(id=chunk.id).first() is not None

    # 删除知识库
    db_session.delete(collection)
    db_session.commit()

    # 验证文档和切片都已级联删除
    assert db_session.query(Document).filter_by(id=document.id).first() is None
    assert db_session.query(Chunk).filter_by(id=chunk.id).first() is None