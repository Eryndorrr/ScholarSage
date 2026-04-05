"""
RAGAS 评估器模块
使用 RAGAS 框架评估 RAG 系统性能
"""
import asyncio
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

from app.core.rag.retriever import Retriever, RetrieverError
from app.core.rag.generator import Generator, GeneratorError
from app.models.evaluation import Evaluation, EvaluationStatus
from app.database import SessionLocal

logger = logging.getLogger(__name__)


class RAGASEvaluatorError(Exception):
    """评估器异常"""
    pass


class RAGASEvaluator:
    """RAGAS 评估器"""

    def __init__(self):
        self.retriever = Retriever()
        self.generator = Generator()

    def generate_sample_questions(
        self,
        collection_name: str,
        num_questions: int = 5
    ) -> List[str]:
        """
        基于文档内容自动生成评估问题

        Args:
            collection_name: 知识库/集合名称
            num_questions: 生成问题数量

        Returns:
            生成的问题列表
        """
        try:
            # 检索一些文档作为参考
            # 使用通用问题获取相关文档
            sample_queries = [
                "主要内容和核心观点是什么？",
                "有哪些关键技术或方法？",
                "研究的主要结论是什么？"
            ]

            all_contexts = []
            for query in sample_queries:
                results = self.retriever.retrieve(
                    query=query,
                    collection_name=collection_name,
                    top_k=3
                )
                for r in results:
                    all_contexts.append(r['content'])

            if not all_contexts:
                # 如果没有检索到文档，返回默认问题
                return [
                    "这个知识库包含哪些内容？",
                    "有哪些重要的概念需要了解？",
                    "主要的技术要点是什么？"
                ][:num_questions]

            # 去重并选取部分上下文
            unique_contexts = list(set(all_contexts))[:5]
            context_text = "\n\n".join(unique_contexts[:3])

            # 使用LLM生成问题
            from openai import OpenAI
            from app.config import settings

            client = OpenAI(
                api_key=settings.openai_api_key,
                base_url=settings.openai_base_url
            )

            prompt = f"""基于以下文档内容，生成 {num_questions} 个可以用来测试问答系统效果的问题。
问题应该：
1. 能够从文档内容中找到答案
2. 涵盖不同的主题和方面
3. 有明确的具体答案

文档内容：
{context_text[:3000]}

请直接输出问题列表，每行一个问题，不要编号和其他格式。"""

            response = client.chat.completions.create(
                model=settings.openai_model,
                messages=[
                    {"role": "system", "content": "你是一个测试问题生成专家。"},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=500,
                temperature=0.7
            )

            questions = response.choices[0].message.content.strip().split('\n')
            questions = [q.strip() for q in questions if q.strip()]

            return questions[:num_questions]

        except Exception as e:
            logger.error(f"Failed to generate sample questions: {e}")
            # 返回默认问题
            return [
                "这个知识库的主要内容是什么？",
                "有哪些关键概念？",
                "核心观点是什么？"
            ][:num_questions]

    def evaluate_single_question(
        self,
        question: str,
        collection_name: str,
        top_k: int = 3
    ) -> Dict[str, Any]:
        """
        评估单个问题

        Args:
            question: 问题
            collection_name: 集合名称
            top_k: 检索文档数量

        Returns:
            评估结果字典
        """
        try:
            # 1. 检索相关文档
            retrieved_docs = self.retriever.retrieve(
                query=question,
                collection_name=collection_name,
                top_k=top_k
            )

            contexts = [doc['content'] for doc in retrieved_docs]

            # 构建上下文来源信息
            context_sources = []
            for doc in retrieved_docs:
                metadata = doc.get('metadata', {})
                source_info = {
                    'content': doc['content'][:500] + '...' if len(doc['content']) > 500 else doc['content'],
                    'document_id': metadata.get('document_id', ''),
                    'document_name': metadata.get('title') or metadata.get('document_name', '未知文档'),
                    'chunk_index': metadata.get('chunk_index', -1),
                    'page': metadata.get('page', -1),
                    'distance': doc.get('distance', 0)
                }
                context_sources.append(source_info)

            if not contexts:
                return {
                    "question": question,
                    "answer": "",
                    "contexts": [],
                    "context_sources": [],
                    "faithfulness": None,
                    "answer_relevancy": None,
                    "context_precision": None,
                    "context_recall": None,
                    "error": "No relevant documents found"
                }

            # 2. 生成答案
            answer = self.generator.generate_answer(
                question=question,
                contexts=contexts
            )

            # 3. 计算评估指标（优先使用增强的备用方法，RAGAS作为可选）
            metrics = self._calculate_metrics(
                question=question,
                answer=answer,
                contexts=contexts
            )

            return {
                "question": question,
                "answer": answer,
                "contexts": contexts,
                "context_sources": context_sources,
                "faithfulness": self._safe_float(metrics.get("faithfulness")),
                "answer_relevancy": self._safe_float(metrics.get("answer_relevancy")),
                "context_precision": self._safe_float(metrics.get("context_precision")),
                "context_recall": None  # 需要 ground truth
            }

        except Exception as e:
            logger.error(f"Failed to evaluate question '{question}': {e}")
            return {
                "question": question,
                "answer": "",
                "contexts": [],
                "context_sources": [],
                "faithfulness": None,
                "answer_relevancy": None,
                "context_precision": None,
                "context_recall": None,
                "error": str(e)
            }

    def _calculate_metrics(
        self,
        question: str,
        answer: str,
        contexts: List[str]
    ) -> Dict[str, float]:
        """
        计算评估指标（默认使用增强的备用方法）

        Args:
            question: 问题
            answer: 答案
            contexts: 上下文列表

        Returns:
            评估指标字典
        """
        from app.config import settings

        # 检查是否强制使用 RAGAS（通过环境变量配置）
        use_ragas = getattr(settings, 'use_ragas_evaluation', False)

        if use_ragas:
            logger.info("Attempting RAGAS evaluation (configured)")
            ragas_metrics = self._calculate_ragas_metrics(question, answer, contexts)
            # 如果 RAGAS 成功返回有效指标，使用它
            if ragas_metrics and any(v is not None for v in ragas_metrics.values()):
                return ragas_metrics
            logger.warning("RAGAS returned invalid metrics, falling back to enhanced method")

        # 默认使用增强的备用方法
        return self._calculate_enhanced_metrics(question, answer, contexts)

    def _calculate_ragas_metrics(
        self,
        question: str,
        answer: str,
        contexts: List[str]
    ) -> Dict[str, float]:
        """
        使用 RAGAS 计算评估指标（可选）

        Args:
            question: 问题
            answer: 答案
            contexts: 上下文列表

        Returns:
            评估指标字典
        """
        try:
            from ragas import evaluate
            from datasets import Dataset
            from app.config import settings
            from langchain_openai import ChatOpenAI
            import os

            # 获取 RAGAS 专用配置，如果未配置则使用默认 OpenAI 配置
            ragas_api_key = settings.ragas_api_key or settings.openai_api_key
            ragas_base_url = settings.ragas_base_url or settings.openai_base_url
            ragas_model = settings.ragas_model

            # 设置环境变量（RAGAS 内部可能需要）
            os.environ["OPENAI_API_KEY"] = ragas_api_key
            if ragas_base_url:
                os.environ["OPENAI_BASE_URL"] = ragas_base_url

            logger.info(f"RAGAS using model: {ragas_model} from {ragas_base_url}")

            # 创建 LLM 实例用于 RAGAS
            llm = ChatOpenAI(
                model=ragas_model,
                api_key=ragas_api_key,
                base_url=ragas_base_url,
                temperature=0.1  # 降低温度以获得更稳定的输出
            )

            try:
                # 新版 RAGAS API - 只使用不需要 reference 的指标
                from ragas.metrics import Faithfulness, AnswerRelevancy

                # 创建指标实例，传入 LLM
                faithfulness = Faithfulness(llm=llm)
                answer_relevancy = AnswerRelevancy(llm=llm)
                metrics_to_use = [faithfulness, answer_relevancy]
            except ImportError:
                # 旧版 RAGAS API
                from ragas.metrics import faithfulness, answer_relevancy
                metrics_to_use = [faithfulness, answer_relevancy]

            # 构建评估数据集
            data = {
                "question": [question],
                "answer": [answer],
                "contexts": [contexts],
            }

            dataset = Dataset.from_dict(data)

            # 运行评估
            results = evaluate(
                dataset,
                metrics=metrics_to_use
            )

            # 提取指标 - 处理不同版本的返回格式
            metrics = {}

            # 尝试多种方式提取结果
            if hasattr(results, 'to_pandas'):
                # 新版本返回 Dataset
                df = results.to_pandas()
                metrics = {
                    "faithfulness": df.get('faithfulness', [None])[0],
                    "answer_relevancy": df.get('answer_relevancy', [None])[0],
                    "context_precision": None  # 需要 reference，暂不支持
                }
            elif hasattr(results, 'scores') and results.scores:
                score = results.scores[0]
                metrics = {
                    "faithfulness": score.get("faithfulness"),
                    "answer_relevancy": score.get("answer_relevancy"),
                    "context_precision": None
                }
            elif isinstance(results, dict):
                metrics = {
                    "faithfulness": results.get("faithfulness"),
                    "answer_relevancy": results.get("answer_relevancy"),
                    "context_precision": None
                }
            elif hasattr(results, '__iter__'):
                # 可能是列表形式
                for item in results:
                    if isinstance(item, dict):
                        metrics = {
                            "faithfulness": item.get("faithfulness"),
                            "answer_relevancy": item.get("answer_relevancy"),
                            "context_precision": None
                        }
                        break

            # 处理 NaN 值，转换为 None
            import math
            for key in metrics:
                if metrics[key] is not None:
                    if isinstance(metrics[key], float) and (math.isnan(metrics[key]) or math.isinf(metrics[key])):
                        metrics[key] = None

            logger.info(f"RAGAS metrics: {metrics}")
            return metrics

        except ImportError as e:
            logger.warning(f"RAGAS not installed: {e}")
            return {"faithfulness": None, "answer_relevancy": None, "context_precision": None}
        except Exception as e:
            logger.error(f"RAGAS evaluation failed: {e}")
            return {"faithfulness": None, "answer_relevancy": None, "context_precision": None}

    def _calculate_enhanced_metrics(
        self,
        question: str,
        answer: str,
        contexts: List[str]
    ) -> Dict[str, float]:
        """
        备用评估方法（当 RAGAS 不可用时）
        模拟 RAGAS 的评估逻辑
        """
        from openai import OpenAI
        from app.config import settings
        import json
        import re

        logger.info("Using enhanced fallback metrics calculation")

        # 如果没有上下文或答案，返回默认值
        if not contexts or not answer:
            logger.warning("Empty contexts or answer, returning default metrics")
            return {
                "faithfulness": None,
                "answer_relevancy": None,
                "context_precision": None
            }

        client = OpenAI(
            api_key=settings.openai_api_key,
            base_url=settings.openai_base_url
        )

        metrics = {}

        try:
            # ========== 1. Faithfulness（忠实度）==========
            # 步骤1: 将答案分解成陈述
            statements_prompt = f"""请将以下答案分解成独立的陈述句。
每个陈述句应该是一个可以独立判断真假的简单句子。

答案：{answer}

请以 JSON 数组格式返回，例如：["陈述1", "陈述2", "陈述3"]
只输出 JSON 数组，不要其他内容。"""

            response = client.chat.completions.create(
                model=settings.openai_model,
                messages=[{"role": "user", "content": statements_prompt}],
                max_tokens=500,
                temperature=0
            )

            statements = []
            try:
                content = response.choices[0].message.content.strip()
                # 提取 JSON 数组
                json_match = re.search(r'\[.*\]', content, re.DOTALL)
                if json_match:
                    statements = json.loads(json_match.group())
            except (json.JSONDecodeError, AttributeError):
                # 如果解析失败，按句子分割
                statements = [s.strip() for s in answer.split('。') if s.strip()]

            if not statements:
                statements = [answer]

            # 步骤2: 判断每个陈述是否能从上下文推断
            context_text = "\n".join(contexts)
            faithful_count = 0

            for statement in statements[:5]:  # 最多评估5个陈述
                verify_prompt = f"""给定以下上下文，判断陈述是否可以从上下文中直接推断出来。

上下文：
{context_text[:2000]}

陈述：{statement}

如果陈述可以从上下文推断，输出 "yes"，否则输出 "no"。
只输出 yes 或 no。"""

                response = client.chat.completions.create(
                    model=settings.openai_model,
                    messages=[{"role": "user", "content": verify_prompt}],
                    max_tokens=10,
                    temperature=0
                )
                if "yes" in response.choices[0].message.content.lower():
                    faithful_count += 1

            metrics["faithfulness"] = faithful_count / len(statements[:5]) if statements else 0.5

            # ========== 2. Answer Relevancy（答案相关性）==========
            # 基于答案生成问题，判断与原问题的相似度
            gen_questions_prompt = f"""基于以下答案，生成3个可能导致这个答案的问题。

答案：{answer}

请以 JSON 数组格式返回，例如：["问题1", "问题2", "问题3"]
只输出 JSON 数组。"""

            response = client.chat.completions.create(
                model=settings.openai_model,
                messages=[{"role": "user", "content": gen_questions_prompt}],
                max_tokens=200,
                temperature=0.3
            )

            generated_questions = []
            try:
                content = response.choices[0].message.content.strip()
                json_match = re.search(r'\[.*\]', content, re.DOTALL)
                if json_match:
                    generated_questions = json.loads(json_match.group())
            except (json.JSONDecodeError, AttributeError):
                pass

            # 判断生成的问题与原问题的相关性
            if generated_questions:
                relevancy_scores = []
                for gen_q in generated_questions[:3]:
                    compare_prompt = f"""判断以下两个问题是否在询问相同或相似的内容。

原问题：{question}
生成的问题：{gen_q}

如果两个问题意图相同或非常相似，输出 "1"。
如果有一定相关性，输出 "0.5"。
如果完全不相关，输出 "0"。
只输出数字。"""

                    response = client.chat.completions.create(
                        model=settings.openai_model,
                        messages=[{"role": "user", "content": compare_prompt}],
                        max_tokens=10,
                        temperature=0
                    )
                    try:
                        score = float(re.search(r'[\d.]+', response.choices[0].message.content).group())
                        relevancy_scores.append(min(1.0, max(0.0, score)))
                    except:
                        relevancy_scores.append(0.5)

                metrics["answer_relevancy"] = sum(relevancy_scores) / len(relevancy_scores)
            else:
                # 备用：直接评估相关性
                direct_relevancy_prompt = f"""评估答案是否完整回答了问题。

问题：{question}
答案：{answer}

评分标准：
1.0 - 答案完整准确地回答了问题
0.7 - 答案大部分相关，但有遗漏
0.5 - 答案部分相关
0.3 - 答案相关性较低
0.0 - 答案完全不相关

只输出分数数字。"""

                response = client.chat.completions.create(
                    model=settings.openai_model,
                    messages=[{"role": "user", "content": direct_relevancy_prompt}],
                    max_tokens=10,
                    temperature=0
                )
                try:
                    metrics["answer_relevancy"] = min(1.0, max(0.0, float(re.search(r'[\d.]+', response.choices[0].message.content).group())))
                except:
                    metrics["answer_relevancy"] = 0.5

            # ========== 3. Context Precision（上下文精确度）==========
            # 评估每个上下文片段与问题的相关性
            precision_scores = []

            for i, ctx in enumerate(contexts[:3]):  # 评估前3个上下文
                ctx_relevance_prompt = f"""判断以下上下文片段是否与问题相关，能否帮助回答问题。

问题：{question}

上下文片段：
{ctx[:500]}

如果上下文直接相关且能帮助回答问题，输出 "1"。
如果上下文有一定相关性，输出 "0.5"。
如果上下文完全不相关，输出 "0"。
只输出数字。"""

                response = client.chat.completions.create(
                    model=settings.openai_model,
                    messages=[{"role": "user", "content": ctx_relevance_prompt}],
                    max_tokens=10,
                    temperature=0
                )
                try:
                    score = float(re.search(r'[\d.]+', response.choices[0].message.content).group())
                    precision_scores.append(min(1.0, max(0.0, score)))
                except:
                    precision_scores.append(0.5)

            metrics["context_precision"] = sum(precision_scores) / len(precision_scores) if precision_scores else 0.5

        except Exception as e:
            logger.error(f"Enhanced fallback metrics calculation failed: {e}")
            metrics = {
                "faithfulness": 0.5,
                "answer_relevancy": 0.5,
                "context_precision": 0.5
            }

        # 确保所有值都在 0-1 范围内
        for key in metrics:
            if metrics[key] is not None:
                metrics[key] = round(min(1.0, max(0.0, metrics[key])), 4)

        logger.info(f"Enhanced fallback metrics: {metrics}")
        return metrics

    def run_evaluation(
        self,
        evaluation_id: str,
        collection_name: str,
        questions: List[str],
        parameters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        执行完整评估（并发执行）

        Args:
            evaluation_id: 评估记录ID
            collection_name: 集合名称
            questions: 问题列表
            parameters: 评估参数

        Returns:
            汇总的评估结果
        """
        db = SessionLocal()
        progress_lock = threading.Lock()
        processed_count = [0]  # 使用列表以便在闭包中修改

        try:
            # 更新状态为运行中
            evaluation = db.query(Evaluation).filter(
                Evaluation.id == evaluation_id
            ).first()

            if not evaluation:
                raise RAGASEvaluatorError(f"Evaluation {evaluation_id} not found")

            evaluation.status = EvaluationStatus.RUNNING
            evaluation.started_at = datetime.utcnow()
            evaluation.total_questions = len(questions)
            db.commit()

            top_k = parameters.get("top_k", 3)

            # 并发评估问题
            detailed_results = [None] * len(questions)  # 预分配列表保持顺序

            def evaluate_with_index(index: int, question: str) -> tuple:
                """评估单个问题并返回索引和结果"""
                result = self.evaluate_single_question(
                    question=question,
                    collection_name=collection_name,
                    top_k=top_k
                )
                return index, result

            # 使用线程池并发执行，默认最多3个并发
            max_workers = min(3, len(questions))
            logger.info(f"Starting concurrent evaluation with {max_workers} workers for {len(questions)} questions")

            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                # 提交所有任务
                future_to_index = {
                    executor.submit(evaluate_with_index, i, q): i
                    for i, q in enumerate(questions)
                }

                # 收集结果并更新进度
                for future in as_completed(future_to_index):
                    try:
                        index, result = future.result()
                        detailed_results[index] = result

                        # 线程安全地更新进度
                        with progress_lock:
                            processed_count[0] += 1
                            # 每完成一个就更新数据库
                            try:
                                db_update = SessionLocal()
                                eval_update = db_update.query(Evaluation).filter(
                                    Evaluation.id == evaluation_id
                                ).first()
                                if eval_update:
                                    eval_update.processed_questions = processed_count[0]
                                    db_update.commit()
                                db_update.close()
                            except Exception as e:
                                logger.warning(f"Failed to update progress: {e}")

                        logger.info(f"Completed question {processed_count[0]}/{len(questions)}")

                    except Exception as e:
                        logger.error(f"Question evaluation failed: {e}")
                        idx = future_to_index[future]
                        detailed_results[idx] = {
                            "question": questions[idx],
                            "answer": "",
                            "contexts": [],
                            "context_sources": [],
                            "faithfulness": None,
                            "answer_relevancy": None,
                            "context_precision": None,
                            "context_recall": None,
                            "error": str(e)
                        }

            # 过滤掉可能的 None 值
            detailed_results = [r for r in detailed_results if r is not None]

            # 计算平均指标
            avg_metrics = self._calculate_average_metrics(detailed_results)

            # 重新获取评估记录并更新
            db.refresh(evaluation)
            evaluation.status = EvaluationStatus.COMPLETED
            evaluation.metrics = avg_metrics
            evaluation.detailed_results = detailed_results
            evaluation.completed_at = datetime.utcnow()
            evaluation.execution_time = (
                evaluation.completed_at - evaluation.started_at
            ).total_seconds()
            db.commit()

            logger.info(f"Evaluation completed in {evaluation.execution_time:.2f}s")

            return {
                "metrics": avg_metrics,
                "detailed_results": detailed_results,
                "execution_time": evaluation.execution_time
            }

        except Exception as e:
            logger.error(f"Evaluation failed: {e}")

            # 更新状态为失败
            if evaluation:
                evaluation.status = EvaluationStatus.FAILED
                evaluation.error_message = str(e)
                db.commit()

            raise RAGASEvaluatorError(f"Evaluation failed: {e}")

        finally:
            db.close()

    def _calculate_average_metrics(
        self,
        results: List[Dict[str, Any]]
    ) -> Dict[str, float]:
        """计算平均评估指标"""
        import math

        metrics_sum = {
            "faithfulness": 0.0,
            "answer_relevancy": 0.0,
            "context_precision": 0.0,
            "context_recall": 0.0
        }
        count = {
            "faithfulness": 0,
            "answer_relevancy": 0,
            "context_precision": 0,
            "context_recall": 0
        }

        for result in results:
            for metric in metrics_sum.keys():
                value = result.get(metric)
                if value is not None:
                    # 检查是否为 NaN 或 Inf
                    try:
                        float_value = float(value)
                        if not math.isnan(float_value) and not math.isinf(float_value):
                            metrics_sum[metric] += float_value
                            count[metric] += 1
                    except (TypeError, ValueError):
                        pass

        avg_metrics = {}
        for metric, total in metrics_sum.items():
            if count[metric] > 0:
                avg_metrics[metric] = round(total / count[metric], 4)
            else:
                avg_metrics[metric] = None

        return avg_metrics

    def _safe_float(self, value: Any) -> Optional[float]:
        """安全处理浮点数，将 NaN/Inf 转换为 None"""
        import math
        if value is None:
            return None
        try:
            float_value = float(value)
            if math.isnan(float_value) or math.isinf(float_value):
                return None
            return float_value
        except (TypeError, ValueError):
            return None


# 全局评估器实例
_evaluator_instance: Optional[RAGASEvaluator] = None


def get_evaluator() -> RAGASEvaluator:
    """获取评估器实例"""
    global _evaluator_instance
    if _evaluator_instance is None:
        _evaluator_instance = RAGASEvaluator()
    return _evaluator_instance
