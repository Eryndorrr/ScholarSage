from unittest.mock import Mock

from app.api.query import _resolve_search_collections, _retrieve_across_collections
from app.models import Collection
from app.models.user import User
from app.schemas import QueryRequest


def test_resolve_search_all_returns_only_current_users_collections(db_session):
    current_user = User(
        id="user-a",
        username="alice",
        email="alice@example.com",
        hashed_password="hashed",
    )
    other_user = User(
        id="user-b",
        username="bob",
        email="bob@example.com",
        hashed_password="hashed",
    )
    db_session.add_all([current_user, other_user])
    db_session.add_all(
        [
            Collection(id="collection-a", name="A", user_id="user-a"),
            Collection(id="collection-b", name="B", user_id="user-a"),
            Collection(id="collection-c", name="C", user_id="user-b"),
        ]
    )
    db_session.commit()

    request = QueryRequest(question="alpha", search_all=True, top_k=5)

    collections = _resolve_search_collections(request, current_user, db_session)

    assert [collection.id for collection in collections] == ["collection-a", "collection-b"]


def test_retrieve_across_collections_merges_and_sorts_by_relevance():
    retriever = Mock()
    retriever.retrieve.side_effect = [
        [
            {
                "id": "chunk-a",
                "content": "less relevant",
                "metadata": {},
                "relevance_score": 0.2,
            }
        ],
        [
            {
                "id": "chunk-b",
                "content": "more relevant",
                "metadata": {},
                "relevance_score": 0.9,
            }
        ],
    ]
    collections = [
        Collection(id="collection-a", name="A"),
        Collection(id="collection-b", name="B"),
    ]

    results = _retrieve_across_collections(
        retriever=retriever,
        question="alpha",
        collections=collections,
        top_k=1,
        use_hybrid=True,
        use_rerank=False,
    )

    assert [result["id"] for result in results] == ["chunk-b"]
    assert results[0]["metadata"]["collection_id"] == "collection-b"
    assert results[0]["metadata"]["collection_name"] == "B"
    retriever.retrieve.assert_any_call(
        query="alpha",
        collection_name="collection-a",
        top_k=1,
        use_hybrid=True,
        use_rerank=False,
    )
    retriever.retrieve.assert_any_call(
        query="alpha",
        collection_name="collection-b",
        top_k=1,
        use_hybrid=True,
        use_rerank=False,
    )
