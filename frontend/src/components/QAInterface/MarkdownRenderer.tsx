import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import { useState, useRef, useEffect, useCallback } from 'react'
import 'highlight.js/styles/github-dark.css'
import 'katex/dist/katex.min.css'

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

/**
 * 代码块：带复制按钮
 */
function CodeBlock({ className, children }: { className?: string; children: React.ReactNode }) {
  const [copied, setCopied] = useState(false)
  const codeRef = useRef<HTMLElement>(null)

  // 提取语言
  const match = className?.match(/language-(\w+)/)
  const language = match ? match[1] : ''

  const handleCopy = useCallback(() => {
    const text = codeRef.current?.textContent || ''
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [])

  return (
    <div className="group relative">
      {/* 语言标签 + 复制按钮 */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-gray-800 rounded-t-lg border-b border-gray-700">
        {language ? (
          <span className="text-xs font-mono text-gray-400 uppercase tracking-wider">{language}</span>
        ) : (
          <span />
        )}
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
          title={copied ? '已复制' : '复制代码'}
        >
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              已复制
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              复制
            </>
          )}
        </button>
      </div>
      <code ref={codeRef} className={className}>
        {children}
      </code>
    </div>
  )
}

/**
 * Mermaid 图表渲染器
 */
function MermaidRenderer({ code }: { code: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const idRef = useRef(`mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`)

  useEffect(() => {
    let cancelled = false

    const renderMermaid = async () => {
      try {
        const mermaid = (await import('mermaid')).default
        mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          securityLevel: 'loose',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        })

        if (!containerRef.current || cancelled) return

        const { svg } = await mermaid.render(idRef.current, code)
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg
          setIsLoading(false)
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : String(err)
          setError(msg)
          setIsLoading(false)
        }
      }
    }

    renderMermaid()
    return () => { cancelled = true }
  }, [code])

  if (error) {
    return (
      <div className="my-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <p className="text-sm text-red-600 dark:text-red-400 font-medium mb-1">Mermaid 图表渲染失败</p>
        <pre className="text-xs text-red-500 dark:text-red-400 overflow-x-auto">{error}</pre>
        <pre className="text-xs text-gray-500 mt-2 overflow-x-auto">{code}</pre>
      </div>
    )
  }

  return (
    <div className="my-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto">
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
          渲染图表中...
        </div>
      )}
      <div ref={containerRef} className="flex justify-center" />
    </div>
  )
}

export function MarkdownRenderer({ content, onCitationClick }: MarkdownRendererProps) {
  // 预处理引用标记
  const processedContent = preprocessCitations(content)

  return (
    <div className="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeHighlight, [rehypeKatex, { throwOnError: false, strict: false }]]}
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

          // 代码块增强
          pre: ({ children }) => {
            const child = children as React.ReactElement<{ className?: string; children?: React.ReactNode }>
            const className = child?.props?.className || ''
            const isMermaid = className.includes('language-mermaid')

            // Mermaid 图表
            if (isMermaid) {
              const code = typeof child.props.children === 'string'
                ? child.props.children
                : ''
              return <MermaidRenderer code={code} />
            }

            // 普通代码块
            return (
              <pre className="rounded-b-lg overflow-x-auto text-sm leading-relaxed">
                <CodeBlock className={className}>
                  {child?.props?.children}
                </CodeBlock>
              </pre>
            )
          },

          // 内联代码
          code: ({ className, children, ...props }) => {
            // 如果在 pre 内部（即代码块），不渲染为内联样式
            const isInPre = !className?.includes('language-')
            if (isInPre) return <code className={className} {...props}>{children}</code>

            // 内联代码样式
            return (
              <code
                className="px-1.5 py-0.5 mx-0.5 bg-gray-100 dark:bg-gray-700 text-pink-600 dark:text-pink-400 rounded text-sm font-mono"
                {...props}
              >
                {children}
              </code>
            )
          },

          // 表格
          table: ({ children }) => (
            <div className="overflow-x-auto my-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <table className="min-w-full border-collapse text-sm">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-gray-50 dark:bg-gray-800">{children}</thead>,
          th: ({ children }) => (
            <th className="border-b border-gray-200 dark:border-gray-700 px-4 py-2.5 text-left font-semibold text-gray-900 dark:text-gray-100">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-gray-200 dark:border-gray-700 px-4 py-2.5 text-gray-700 dark:text-gray-300">
              {children}
            </td>
          ),

          // 列表
          ul: ({ children }) => <ul className="list-disc pl-6 my-2 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-6 my-2 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="text-gray-700 dark:text-gray-300">{children}</li>,

          // 标题
          h1: ({ children }) => <h1 className="text-2xl font-bold mt-6 mb-3 text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2">{children}</h1>,
          h2: ({ children }) => <h2 className="text-xl font-semibold mt-5 mb-2 text-gray-900 dark:text-gray-100">{children}</h2>,
          h3: ({ children }) => <h3 className="text-lg font-medium mt-4 mb-2 text-gray-900 dark:text-gray-100">{children}</h3>,
          h4: ({ children }) => <h4 className="text-base font-medium mt-3 mb-1.5 text-gray-800 dark:text-gray-200">{children}</h4>,

          // 段落
          p: ({ children }) => <p className="my-2 leading-7 text-gray-700 dark:text-gray-300">{children}</p>,

          // 分割线
          hr: () => <hr className="my-6 border-gray-200 dark:border-gray-700" />,

          // 引用块
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-blue-300 dark:border-blue-600 pl-4 my-3 py-1 text-gray-600 dark:text-gray-400 italic bg-blue-50/50 dark:bg-blue-900/10 rounded-r">
              {children}
            </blockquote>
          ),

          // 删除线
          del: ({ children }) => <del className="line-through text-gray-500">{children}</del>,
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  )
}
