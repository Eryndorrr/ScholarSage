from typing import Dict, List
from app.core.parsers.pdf_parser import PDFParser
from app.core.parsers.markdown_parser import MarkdownParser
from app.core.parsers.word_parser import WordParser
from app.core.rag.embeddings import EmbeddingEngine
from app.core.rag.vector_store import VectorStore
from app.models.document import FileType
import uuid
import logging

logger = logging.getLogger(__name__)


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
        document_id: str = None,
        document_title: str = None,
        chunk_size: int = 512,
        overlap: int = 50
    ) -> Dict:
        """处理文档：解析 -> 切分 -> 向量化 -> 存储"""

        # 输入验证
        if not file_path or not isinstance(file_path, str):
            raise ValueError("file_path不能为空")
        if not collection_id or not isinstance(collection_id, str):
            raise ValueError("collection_id不能为空")
        if file_type not in FileType:
            raise ValueError(f"无效的文件类型: {file_type}")
        if not isinstance(chunk_size, int) or chunk_size <= 0:
            raise ValueError("chunk_size必须是正整数")
        if not isinstance(overlap, int) or overlap < 0:
            raise ValueError("overlap必须是非负整数")

        try:
            # 1. 选择解析器
            logger.info(f"Parsing document: {file_path}")
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
            logger.info(f"Extracted {len(text)} characters")

            # 3. 切分文本
            chunks = parser.chunk_text(chunk_size=chunk_size, overlap=overlap)
            logger.info(f"Split into {len(chunks)} chunks")

            if not chunks:
                return {
                    "success": False,
                    "error": "文档内容为空或无法解析"
                }

            # 4. 批量向量化
            logger.info(f"Embedding {len(chunks)} chunks...")
            embeddings = self.embedding_engine.embed_batch(chunks)
            logger.info(f"Embedding completed")

            # 5. 存储到向量库
            chunk_ids = [str(uuid.uuid4()) for _ in chunks]
            metadatas = [
                {
                    "document_id": document_id or file_path,
                    "title": document_title or file_path.split("/")[-1],
                    "collection_id": collection_id,
                    "chunk_index": i,
                    "page": 0  # PDF解析时可扩展页码信息
                }
                for i in range(len(chunks))
            ]

            logger.info(f"Storing {len(chunks)} vectors...")
            self.vector_store.add_documents(
                collection_name=collection_id,
                documents=chunks,
                embeddings=embeddings,
                metadatas=metadatas,
                ids=chunk_ids
            )

            logger.info(f"Document processed successfully: {len(chunks)} chunks")
            return {
                "success": True,
                "chunk_count": len(chunks),
                "chunk_ids": chunk_ids
            }

        except FileNotFoundError as e:
            logger.error(f"File not found: {e}")
            return {
                "success": False,
                "error": f"文件未找到: {str(e)}"
            }
        except PermissionError as e:
            logger.error(f"Permission error: {e}")
            return {
                "success": False,
                "error": f"文件权限错误: {str(e)}"
            }
        except Exception as e:
            logger.exception(f"Error processing document: {e}")
            return {
                "success": False,
                "error": f"处理文档时发生错误: {str(e)}"
            }