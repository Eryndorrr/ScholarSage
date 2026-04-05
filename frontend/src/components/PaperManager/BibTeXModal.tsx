import { useState } from 'react'
import { Copy, Download, X } from 'lucide-react'

interface BibTeXModalProps {
  entries: string[]
  onClose: () => void
}

export function BibTeXModal({ entries, onClose }: BibTeXModalProps) {
  const [copied, setCopied] = useState(false)

  const bibtexText = entries.join('\n\n')

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(bibtexText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleDownload = () => {
    const blob = new Blob([bibtexText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'references.bib'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">BibTeX 引用</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-auto p-4">
          {entries.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              没有可导出的BibTeX条目
            </p>
          ) : (
            <pre className="bg-gray-50 p-4 rounded-lg text-sm font-mono whitespace-pre-wrap break-all overflow-x-auto">
              {bibtexText}
            </pre>
          )}
        </div>

        {/* 底部操作 */}
        <div className="flex items-center justify-end gap-3 p-4 border-t">
          <button
            onClick={handleCopy}
            className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 flex items-center gap-2"
          >
            {copied ? (
              <>
                <span className="text-green-600">✓</span>
                已复制
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                复制
              </>
            )}
          </button>
          <button
            onClick={handleDownload}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            下载 .bib
          </button>
        </div>
      </div>
    </div>
  )
}
