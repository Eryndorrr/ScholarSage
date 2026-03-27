import pytest
from app.models.document import Document, FileType
from app.models.collection import Collection
from datetime import datetime


def test_create_document(db_session):
    """测试创建文档"""
    collection = Collection(name="测试知识库")
    db_session.add(collection)
    db_session.commit()

    document = Document(
        collection_id=collection.id,
        title="RAG技术论文",
        file_path="/uploads/rag_paper.pdf",
        file_type=FileType.PDF,
        file_size=1024000
    )
    db_session.add(document)
    db_session.commit()

    assert document.id is not None
    assert document.title == "RAG技术论文"
    assert document.file_type == FileType.PDF
    assert document.file_size == 1024000
    assert isinstance(document.upload_time, datetime)


def test_document_default_file_size(db_session):
    """测试默认文件大小"""
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

    assert document.file_size == 0


def test_document_file_types(db_session):
    """测试不同文件类型"""
    collection = Collection(name="测试知识库")
    db_session.add(collection)
    db_session.commit()

    for file_type in [FileType.PDF, FileType.DOCX, FileType.MD, FileType.TXT]:
        document = Document(
            collection_id=collection.id,
            title=f"测试{file_type.value}",
            file_path=f"/uploads/test.{file_type.value}",
            file_type=file_type
        )
        db_session.add(document)

    db_session.commit()

    documents = db_session.query(Document).filter_by(collection_id=collection.id).all()
    assert len(documents) == 4


def test_document_relationship(db_session):
    """测试文档与知识库的关联"""
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

    # 测试反向关系
    assert document.collection is not None
    assert document.collection.name == "测试知识库"