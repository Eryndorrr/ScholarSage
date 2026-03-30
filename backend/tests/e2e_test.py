import pytest
import httpx
import time

BASE_URL = "http://localhost:8000"


def test_e2e_workflow():
    """端到端工作流测试"""

    # 1. 创建知识库
    response = httpx.post(f"{BASE_URL}/api/collections", json={
        "name": "E2E测试知识库",
        "description": "端到端测试"
    })
    assert response.status_code == 200
    collection_id = response.json()["id"]

    # 2. 上传文档
    with open("test_document.pdf", "rb") as f:
        response = httpx.post(
            f"{BASE_URL}/api/collections/{collection_id}/documents",
            files={"file": f}
        )
    assert response.status_code == 200
    document_id = response.json()["id"]

    # 等待处理完成
    time.sleep(5)

    # 3. 查询
    response = httpx.post(f"{BASE_URL}/api/query", json={
        "question": "这个文档讲了什么？",
        "collection_id": collection_id
    })
    assert response.status_code == 200
    data = response.json()
    assert "answer" in data
    assert len(data["sources"]) > 0

    # 4. 清理
    httpx.delete(f"{BASE_URL}/api/collections/{collection_id}")