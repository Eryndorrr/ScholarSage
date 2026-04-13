import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github-dark.css'

interface MarkdownRendererProps {
  content: string
  onCitationClick?: (index: number) => void
}

/**
 * 预处理内容，将引用标记转换为特殊链接格式
 * [1] -> [1](#citation-1)
 * [W1] -> [W1](#citation-W1)
 */
function preprocessCitations(content: string): string {
  // 先处理网络来源 [W1], [W2] 等
  let processed = content.replace(/\[(W\d+)\]/g, '[$1](#citation-$1)')
  // 再处理本地来源 [1], [2] 等
  processed = processed.replace(/\[(\d+)\]/g, '[$1](#citation-$1)')
  return processed
}

export function MarkdownRenderer({ content, onCitationClick }: MarkdownRendererProps) {
  // 预处理引用标记
  const processedContent = preprocessCitations(content)

  return (
    <div className="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          // 自定义链接渲染，处理引用标签
          a: ({ href, children }) => {
            // 检测是否为引用链接（支持 [1] 和 [W1] 格式）
            const citationMatch = href?.match(/^#citation-(\d+|W\d+)$/)
            if (citationMatch && onCitationClick) {
              const citation = citationMatch[1]
              // W1 格式传负数索引，如 W1 -> -1，W2 -> -2
              const index = citation.startsWith('W')
                ? -parseInt(citation.slice(1), 10)
                : parseInt(citation, 10)
              return (
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    onCitationClick(index)
                  }}
                  className={`inline-flex items-center justify-center min-w-[20px] h-[20px] px-1 text-xs font-medium rounded-full hover:bg-blue-200 hover:text-blue-800 cursor-pointer transition-colors align-middle mx-0.5 ${
                    citation.startsWith('W')
                      ? 'bg-green-100 text-green-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                  title={`查看来源 ${citation}`}
                >
                  {children}
                </button>
              )
            }
            // 普通链接
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                {children}
              </a>
            )
          },

          // 保留原有的表格和格式组件
          table: ({ children }) => (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full border-collapse border border-gray-300 text-sm">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-gray-100">{children}</thead>,
          th: ({ children }) => (
            <th className="border border-gray-300 px-3 py-2 text-left font-semibold">{children}</th>
          ),
          td: ({ children }) => (
            <td className="border border-gray-300 px-3 py-2">{children}</td>
          ),

          // 分割线
          hr: () => <hr className="my-4 border-gray-300" />,

          // 强调
          strong: ({ children }) => <strong className="font-bold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,

          // 删除线
          del: ({ children }) => <del className="line-through text-gray-500">{children}</del>,
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  )
}
