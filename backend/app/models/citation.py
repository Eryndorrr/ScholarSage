from sqlalchemy import Column, String, Integer, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.database import Base
import uuid


class Citation(Base):
    """引用模型 - 存储论文引用关系"""
    __tablename__ = "citations"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    paper_id = Column(String, ForeignKey("papers.id", ondelete="CASCADE"), nullable=False)
    cited_title = Column(String(500), nullable=True)
    cited_authors = Column(JSON, default=list)
    cited_year = Column(Integer, nullable=True)
    cited_venue = Column(String(200), nullable=True)
    location = Column(String(100), nullable=True)  # 引用位置 (e.g., "Page 5")
    bibtex_raw = Column(Text, nullable=True)  # 原始BibTeX

    # 关系
    paper = relationship("Paper", back_populates="citations")

    def __repr__(self):
        return f"<Citation: {self.cited_title}>"

    def to_bibtex(self) -> str:
        """生成BibTeX格式"""
        # 生成citation key
        first_author = self.cited_authors[0] if self.cited_authors else "Unknown"
        last_name = first_author.split()[-1] if first_author else "Unknown"
        year = self.cited_year or "n.d."
        cite_key = f"{last_name}{year}".replace(" ", "")

        # 确定类型
        entry_type = "inproceedings" if self.cited_venue else "article"

        # 生成BibTeX
        lines = [f"@{entry_type}{{{cite_key},"]
        lines.append(f"  title = {{{self.cited_title or 'Unknown'}}},")

        if self.cited_authors:
            authors = " and ".join(self.cited_authors)
            lines.append(f"  author = {{{authors}}},")

        if self.cited_year:
            lines.append(f"  year = {{{self.cited_year}}},")

        if self.cited_venue:
            if entry_type == "inproceedings":
                lines.append(f"  booktitle = {{{self.cited_venue}}},")
            else:
                lines.append(f"  journal = {{{self.cited_venue}}},")

        lines.append("}")
        return "\n".join(lines)
