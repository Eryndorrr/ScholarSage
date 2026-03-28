import pytest
from unittest.mock import Mock, patch
from app.core.rag.generator import Generator, GeneratorError
from openai.error import OpenAIError


class TestGenerator:
    """测试Generator类"""

    def test_init_with_default_values(self):
        """测试使用默认值初始化"""
        with patch("app.core.rag.generator.OpenAI") as mock_openai:
            with patch("app.core.rag.generator.settings") as mock_settings:
                mock_settings.openai_api_key = "test-key"
                mock_settings.openai_model = "gpt-4"

                generator = Generator()

                mock_openai.assert_called_once_with(api_key="test-key")
                assert generator.model == "gpt-4"

    def test_init_with_custom_values(self):
        """测试使用自定义值初始化"""
        with patch("app.core.rag.generator.OpenAI") as mock_openai:
            generator = Generator(api_key="custom-key", model="gpt-3.5-turbo")

            mock_openai.assert_called_once_with(api_key="custom-key")
            assert generator.model == "gpt-3.5-turbo"

    @patch("app.core.rag.generator.OpenAI")
    def test_generate_answer_success(self, mock_openai):
        """测试成功生成答案"""
        mock_client = Mock()
        mock_openai.return_value = mock_client

        mock_response = Mock()
        mock_response.choices = [Mock(message=Mock(content="测试答案"))]
        mock_client.chat.completions.create.return_value = mock_response

        generator = Generator(api_key="test-key")
        result = generator.generate_answer(
            question="什么是RAG?",
            contexts=["RAG是检索增强生成"]
        )

        assert result == "测试答案"
        mock_client.chat.completions.create.assert_called_once()

    @patch("app.core.rag.generator.OpenAI")
    def test_generate_answer_with_temperature(self, mock_openai):
        """测试使用自定义temperature参数"""
        mock_client = Mock()
        mock_openai.return_value = mock_client

        mock_response = Mock()
        mock_response.choices = [Mock(message=Mock(content="测试答案"))]
        mock_client.chat.completions.create.return_value = mock_response

        generator = Generator(api_key="test-key")
        generator.generate_answer(
            question="什么是RAG?",
            contexts=["RAG是检索增强生成"],
            temperature=0.5
        )

        call_kwargs = mock_client.chat.completions.create.call_args.kwargs
        assert call_kwargs["temperature"] == 0.5

    @patch("app.core.rag.generator.OpenAI")
    def test_generate_answer_with_custom_max_tokens(self, mock_openai):
        """测试使用自定义max_tokens"""
        mock_client = Mock()
        mock_openai.return_value = mock_client

        mock_response = Mock()
        mock_response.choices = [Mock(message=Mock(content="测试答案"))]
        mock_client.chat.completions.create.return_value = mock_response

        generator = Generator(api_key="test-key")
        generator.generate_answer(
            question="什么是RAG?",
            contexts=["RAG是检索增强生成"],
            max_tokens=500
        )

        call_kwargs = mock_client.chat.completions.create.call_args.kwargs
        assert call_kwargs["max_tokens"] == 500

    @patch("app.core.rag.generator.OpenAI")
    def test_generate_answer_error(self, mock_openai):
        """测试生成答案失败"""
        mock_client = Mock()
        mock_openai.return_value = mock_client
        mock_client.chat.completions.create.side_effect = OpenAIError("API Error")

        generator = Generator(api_key="test-key")

        with pytest.raises(GeneratorError) as exc_info:
            generator.generate_answer(
                question="什么是RAG?",
                contexts=["RAG是检索增强生成"]
            )
        assert "Failed to generate answer" in str(exc_info.value)

    @patch("app.core.rag.generator.OpenAI")
    def test_generate_answer_prompt_format(self, mock_openai):
        """测试提示词格式"""
        mock_client = Mock()
        mock_openai.return_value = mock_client

        mock_response = Mock()
        mock_response.choices = [Mock(message=Mock(content="答案"))]
        mock_client.chat.completions.create.return_value = mock_response

        generator = Generator(api_key="test-key")
        generator.generate_answer(
            question="问题1",
            contexts=["上下文1", "上下文2"]
        )

        call_kwargs = mock_client.chat.completions.create.call_args.kwargs
        user_message = call_kwargs["messages"][1]["content"]

        assert "问题1" in user_message
        assert "[1]" in user_message
        assert "[2]" in user_message
        assert "上下文1" in user_message
        assert "上下文2" in user_message