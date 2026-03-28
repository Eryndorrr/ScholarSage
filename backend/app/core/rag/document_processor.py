from typing import Dict, List
from app.core.parsers.pdf_parser import PDFParser
from app.core.parsers.markdown_parser import MarkdownParser
from app.core.parsers.word_parser import WordParser
from app.core.rag.embeddings import EmbeddingEngine
from app.core.rag.vector_store import VectorStore
from app.models.document import FileType
import uuid


class DocumentProcessor:
    """文档处理管道"""

    def __init__(self):
        self.embedding_engine = EmbeddingEngine()
        self.vector_store = VectorStore()

    def process_document(
        self,
        file_path: str,
        collection_id: str,
        file_type: FileType,
        chunk_size: int = 512,
        overlap: int = 50
    ) -> Dict:
        """处理文档：解析 -> 切分 -> 向量化 -> 存储"""

        # 1. 选择解析器
        if file_type == FileType.PDF:
            parser = PDFParser(file_path)
        elif file_type == FileType.DOCX:
            parser = WordParser(file_path)
        elif file_type == FileType.MD:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            parser = MarkdownParser(content)
        else:
            raise ValueError(f"不支持的文件类型: {file_type}")

        # 2. 提取文本
        text = parser.extract_text()

        # 3. 切分文本
        chunks = parser.chunk_text(chunk_size=chunk_size, overlap=overlap)

        # 4. 批量向量化
        embeddings = self.embedding_engine.embed_batch(chunks)

        # 5. 存储到向量库
        chunk_ids = [str(uuid.uuid4()) for _ in chunks]
        metadatas = [
            {
                "document_id": file_path,
                "collection_id": collection_id,
                "chunk_index": i
            }
            for i in range(len(chunks))
        ]

        self.vector_store.add_documents(
            collection_name=collection_id,
            documents=chunks,
            embeddings=embeddings,
            metadatas=metadatas,
            ids=chunk_ids
        )

        return {
            "success": True,
            "chunk_count": len(chunks),
            "chunk_ids": chunk_ids
        }