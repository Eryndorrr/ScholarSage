#!/usr/bin/env python3
"""
BM25 索引重建脚本

用于为现有文档补充建立 BM25 索引。

使用方法:
    cd backend
    python scripts/rebuild_bm25_index.py [--collection COLLECTION_ID]

参数:
    --collection: 可选，指定要重建的 collection ID，不指定则重建所有
"""
import sys
import os
import argparse

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import Collection, Document
from app.core.rag.vector_store import VectorStore
from app.core.rag.bm25_retriever import get_bm25_retriever
import chromadb


def rebuild_collection_index(collection_id: str, verbose: bool = True):
    """
    为指定 collection 重建 BM25 索引

    Args:
        collection_id: 集合 ID
        verbose: 是否输出详细信息
    """
    db = SessionLocal()
    vector_store = VectorStore()
    bm25_retriever = get_bm25_retriever()

    try:
        # 获取 collection 信息
        collection = db.query(Collection).filter(Collection.id == collection_id).first()
        if not collection:
            if verbose:
                print(f"❌ Collection {collection_id} 不存在")
            return 0

        if verbose:
            print(f"\n📁 处理 Collection: {collection.name} ({collection_id})")

        # 获取向量库中的数据
        chroma_collection = vector_store.get_collection(collection_id)
        if not chroma_collection:
            if verbose:
                print(f"   ⚠️  向量库中没有数据，跳过")
            return 0

        # 获取所有文档
        all_docs = chroma_collection.get()
        if not all_docs or not all_docs.get('ids'):
            if verbose:
                print(f"   ⚠️  没有找到文档")
            return 0

        doc_count = len(all_docs['ids'])
        if verbose:
            print(f"   📊 找到 {doc_count} 个文档块")

        # 构建 BM25 文档列表
        bm25_docs = []
        for i, doc_id in enumerate(all_docs['ids']):
            bm25_docs.append({
                'id': doc_id,
                'content': all_docs['documents'][i] if all_docs.get('documents') else '',
                'metadata': all_docs['metadatas'][i] if all_docs.get('metadatas') else {}
            })

        # 建立索引
        bm25_retriever.index_documents(collection_id, bm25_docs)

        if verbose:
            print(f"   ✅ BM25 索引建立完成，共 {doc_count} 个文档块")

        return doc_count

    except Exception as e:
        if verbose:
            print(f"   ❌ 索引建立失败: {e}")
        return 0
    finally:
        db.close()


def rebuild_all_indexes(verbose: bool = True):
    """
    重建所有 collection 的 BM25 索引
    """
    db = SessionLocal()

    try:
        collections = db.query(Collection).all()
        if not collections:
            print("没有找到任何 Collection")
            return

        print(f"找到 {len(collections)} 个 Collection")
        print("=" * 50)

        total_docs = 0
        success_count = 0

        for collection in collections:
            doc_count = rebuild_collection_index(collection.id, verbose)
            if doc_count > 0:
                total_docs += doc_count
                success_count += 1

        print("\n" + "=" * 50)
        print(f"✅ 重建完成!")
        print(f"   成功: {success_count}/{len(collections)} 个 Collection")
        print(f"   总计: {total_docs} 个文档块")

    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description='重建 BM25 索引')
    parser.add_argument(
        '--collection',
        type=str,
        help='指定要重建的 Collection ID（可选）'
    )
    parser.add_argument(
        '--quiet',
        action='store_true',
        help='静默模式，减少输出'
    )

    args = parser.parse_args()

    print("=" * 50)
    print("BM25 索引重建工具")
    print("=" * 50)

    if args.collection:
        rebuild_collection_index(args.collection, verbose=not args.quiet)
    else:
        rebuild_all_indexes(verbose=not args.quiet)


if __name__ == '__main__':
    main()
