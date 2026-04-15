# Alembic 数据库迁移指南

## 概述

本项目使用 [Alembic](https://alembic.sqlalchemy.org/) 管理数据库 schema 变更。Alembic 是 SQLAlchemy 的配套迁移工具，可以自动检测 model 变更并生成迁移脚本。

**核心概念**：
- **迁移脚本（Migration）**：记录一次数据库 schema 变更（建表、加列、改类型等）
- **版本链**：每个迁移脚本有唯一 revision ID，按顺序链接形成历史
- **`alembic upgrade head`**：执行所有未应用的迁移，将数据库更新到最新状态
- **`alembic downgrade`**：回滚迁移

---

## 目录结构

```
backend/
├── alembic.ini              # Alembic 配置文件
├── alembic/
│   ├── env.py               # 迁移环境配置（已接入项目 settings 和 models）
│   ├── script.py.mako       # 迁移脚本模板
│   └── versions/            # 迁移脚本存放目录
│       └── xxx_initial_tables.py
└── app/
    ├── database.py          # SQLAlchemy Base
    ├── config.py            # 数据库连接配置
    └── models/              # 数据模型定义
```

---

## 常用命令

所有命令在 `backend/` 目录下执行：

### 1. 生成迁移脚本

修改 `app/models/` 中的模型代码后，运行：

```bash
cd backend
alembic revision --autogenerate -m "描述本次变更"
```

示例：
```bash
# 给 Session 表新增字段
alembic revision --autogenerate -m "add_web_search_enabled_to_session"

# 新增一张表
alembic revision --autogenerate -m "add_benchmark_qa_table"

# 修改列类型
alembic revision --autogenerate -m "change_answer_column_to_text"
```

Alembic 会自动对比 models 和数据库的差异，生成迁移脚本到 `alembic/versions/` 目录。

### 2. 应用迁移

```bash
# 更新到最新版本
alembic upgrade head

# 更新到指定版本
alembic upgrade <revision_id>

# 前进一步
alembic upgrade +1
```

### 3. 回滚迁移

```bash
# 回滚一步
alembic downgrade -1

# 回滚到指定版本
alembic downgrade <revision_id>

# 回滚所有（清空数据库）
alembic downgrade base
```

### 4. 查看状态

```bash
# 查看当前数据库版本
alembic current

# 查看迁移历史
alembic history

# 查看待执行的迁移
alembic show head
```

### 5. 空迁移（不改动 schema，仅数据操作）

```bash
alembic revision -m "add_default_data"
```

这会生成一个空的迁移脚本，你可以手动编写数据迁移逻辑。

---

## 工作流程

### 场景一：新增模型字段

```bash
# 1. 修改 models 代码
# 例如在 app/models/session.py 中添加字段：
#   web_search_enabled = Column(Boolean, default=False)

# 2. 生成迁移脚本
alembic revision --autogenerate -m "add_web_search_enabled_to_session"

# 3. 检查生成的脚本（重要！）
cat alembic/versions/xxx_add_web_search_enabled_to_session.py

# 4. 确认无误后应用
alembic upgrade head
```

### 场景二：新增表

```bash
# 1. 在 app/models/ 下创建新模型文件
# 2. 在 app/models/__init__.py 中导入
# 3. 生成并应用迁移
alembic revision --autogenerate -m "add_new_table"
alembic upgrade head
```

### 场景三：生产环境部署

```bash
# 部署新版本代码后，执行迁移
alembic upgrade head
```

---

## 注意事项

### 检查自动生成的脚本

`--autogenerate` 不是万能的，**每次生成后务必检查**：

- 确认 `upgrade()` 和 `downgrade()` 函数逻辑正确
- 确认没有误删列或表
- 对于复杂变更（重命名列、数据迁移），需要手动编辑脚本

### 自动检测不到的变更

以下变更 Alembic 无法自动检测，需要手动编写迁移脚本：

- 列重命名（Alembic 会视为"删除旧列 + 新增新列"，数据会丢失）
- 数据迁移（如给现有行填充默认值）
- 索引名称变更
- 约束名称变更

手动编写的示例：

```python
def upgrade() -> None:
    # 安全的列重命名
    op.alter_column('sessions', 'old_name', new_column_name='new_name')

def downgrade() -> None:
    op.alter_column('sessions', 'new_name', new_column_name='old_name')
```

### SQLite 的限制

SQLite 不支持部分 DDL 操作（如 `ALTER TABLE DROP COLUMN`、`ALTER TABLE MODIFY COLUMN`）。如果迁移涉及这些操作，Alembic 会采用 "batch" 模式（重建表），在大表上可能较慢。

### 启动时自动迁移

`main.py` 配置了启动时自动执行 `alembic upgrade head`。如果 Alembic 不可用（如开发环境首次运行），会回退到 `create_all`。

---

## 常见问题

### Q: 迁移脚本报错 "Target database is not up to date"

```bash
# 查看当前版本
alembic current
# 查看历史
alembic history
# 强制标记到某个版本（谨慎使用）
alembic stamp <revision_id>
```

### Q: 想重置所有迁移，从头开始

```bash
# 删除数据库
rm data/knowledge.db

# 删除所有迁移脚本
rm alembic/versions/*.py

# 重新生成
alembic revision --autogenerate -m "initial_tables"
alembic upgrade head
```

### Q: 多人协作时迁移冲突

如果两个人同时生成了迁移脚本，会产生分叉。解决方法：

```bash
# 1. 合并代码后，查看历史
alembic history

# 2. 如果出现分叉，创建合并迁移
alembic merge <revision_a> <revision_b> -m "merge_branches"

# 3. 应用
alembic upgrade head
```
