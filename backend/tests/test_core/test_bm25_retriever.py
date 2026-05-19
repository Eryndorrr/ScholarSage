from app.core.rag.bm25_retriever import BM25Retriever


def test_index_documents_appends_to_existing_collection(tmp_path):
    retriever = BM25Retriever(persist_dir=str(tmp_path))

    retriever.index_documents(
        "collection-a",
        [
            {
                "id": "chunk-a",
                "content": "alpha retrieval content",
                "metadata": {"document_id": "doc-a", "title": "Doc A"},
            }
        ],
    )
    retriever.index_documents(
        "collection-a",
        [
            {
                "id": "chunk-b",
                "content": "beta retrieval content",
                "metadata": {"document_id": "doc-b", "title": "Doc B"},
            },
            {
                "id": "chunk-c",
                "content": "gamma retrieval content",
                "metadata": {"document_id": "doc-c", "title": "Doc C"},
            }
        ],
    )

    alpha_results = retriever.search("collection-a", "alpha", top_k=5)
    beta_results = retriever.search("collection-a", "beta", top_k=5)

    assert [r["id"] for r in alpha_results] == ["chunk-a"]
    assert [r["id"] for r in beta_results] == ["chunk-b"]


def test_remove_document_deletes_only_that_documents_chunks(tmp_path):
    retriever = BM25Retriever(persist_dir=str(tmp_path))
    retriever.index_documents(
        "collection-a",
        [
            {
                "id": "chunk-a1",
                "content": "alpha first chunk",
                "metadata": {"document_id": "doc-a", "title": "Doc A"},
            },
            {
                "id": "chunk-a2",
                "content": "alpha second chunk",
                "metadata": {"document_id": "doc-a", "title": "Doc A"},
            },
            {
                "id": "chunk-b",
                "content": "beta retained chunk",
                "metadata": {"document_id": "doc-b", "title": "Doc B"},
            },
            {
                "id": "chunk-c",
                "content": "gamma retained chunk",
                "metadata": {"document_id": "doc-c", "title": "Doc C"},
            },
            {
                "id": "chunk-d",
                "content": "delta retained chunk",
                "metadata": {"document_id": "doc-d", "title": "Doc D"},
            },
        ],
    )

    retriever.remove_document("collection-a", "doc-a")

    assert retriever.search("collection-a", "alpha", top_k=5) == []
    beta_results = retriever.search("collection-a", "beta", top_k=5)
    assert [r["id"] for r in beta_results] == ["chunk-b"]


def test_bm25_results_expose_normalized_relevance_score(tmp_path):
    retriever = BM25Retriever(persist_dir=str(tmp_path))
    retriever.index_documents(
        "collection-a",
        [
            {
                "id": "chunk-a",
                "content": "alpha alpha alpha alpha unique",
                "metadata": {"document_id": "doc-a"},
            },
            {
                "id": "chunk-b",
                "content": "beta beta",
                "metadata": {"document_id": "doc-b"},
            },
            {
                "id": "chunk-c",
                "content": "gamma gamma",
                "metadata": {"document_id": "doc-c"},
            },
        ],
    )

    results = retriever.search("collection-a", "unique", top_k=5)

    assert results
    assert all(0.0 <= result["relevance_score"] <= 1.0 for result in results)
    assert results[0]["relevance_score"] == 1.0
