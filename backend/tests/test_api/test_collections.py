import pytest
from fastapi.testclient import TestClient
from app.main import app


client = TestClient(app)


def test_create_collection():
    """测试创建知识库"""
    response = client.post(
        "/api/collections",
        json={
            "name": "测试知识库",
            "description": "测试描述",
            "color": "#ff0000"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "测试知识库"
    assert data["color"] == "#ff0000"
    assert "id" in data


def test_list_collections():
    """测试获取知识库列表"""
    # 先创建一个知识库
    client.post("/api/collections", json={"name": "列表测试"})

    response = client.get("/api/collections")
    assert response.status_code == 200
    data = response.json()
    assert "collections" in data
    assert isinstance(data["collections"], list)


def test_get_collection():
    """测试获取单个知识库"""
    # 先创建
    create_response = client.post(
        "/api/collections",
        json={"name": "获取测试"}
    )
    collection_id = create_response.json()["id"]

    # 再获取
    response = client.get(f"/api/collections/{collection_id}")
    assert response.status_code == 200
    assert response.json()["name"] == "获取测试"


def test_delete_collection():
    """测试删除知识库"""
    # 先创建
    create_response = client.post(
        "/api/collections",
        json={"name": "删除测试"}
    )
    collection_id = create_response.json()["id"]

    # 再删除
    response = client.delete(f"/api/collections/{collection_id}")
    assert response.status_code == 200

    # 确认已删除
    get_response = client.get(f"/api/collections/{collection_id}")
    assert get_response.status_code == 404