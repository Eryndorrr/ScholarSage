import { useState } from 'react'
import { Search, SortAsc, SortDesc, Calendar, Filter } from 'lucide-react'
import type { PaperQueryParams } from '../../types/paper'

interface PaperSearchBarProps {
  onSearch: (params: PaperQueryParams) => void
  initialParams?: PaperQueryParams
}

export function PaperSearchBar({ onSearch, initialParams }: PaperSearchBarProps) {
  const [search, setSearch] = useState(initialParams?.search || '')
  const [yearFrom, setYearFrom] = useState<string>(
    initialParams?.year_from?.toString() || ''
  )
  const [yearTo, setYearTo] = useState<string>(
    initialParams?.year_to?.toString() || ''
  )
  const [sortBy, setSortBy] = useState<PaperQueryParams['sort_by']>(
    initialParams?.sort_by || 'created_at'
  )
  const [sortOrder, setSortOrder] = useState<PaperQueryParams['sort_order']>(
    initialParams?.sort_order || 'desc'
  )
  const [showFilters, setShowFilters] = useState(false)

  // 当前年份，用于生成年份选项
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 30 }, (_, i) => currentYear - i)

  const handleSearch = () => {
    const params: PaperQueryParams = {
      search: search.trim() || undefined,
      year_from: yearFrom ? parseInt(yearFrom) : undefined,
      year_to: yearTo ? parseInt(yearTo) : undefined,
      sort_by: sortBy,
      sort_order: sortOrder,
      page: 1, // 搜索时重置到第一页
    }
    onSearch(params)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const toggleSortOrder = () => {
    const newOrder = sortOrder === 'asc' ? 'desc' : 'asc'
    setSortOrder(newOrder)
    onSearch({
      search: search.trim() || undefined,
      year_from: yearFrom ? parseInt(yearFrom) : undefined,
      year_to: yearTo ? parseInt(yearTo) : undefined,
      sort_by: sortBy,
      sort_order: newOrder,
      page: 1,
    })
  }

  return (
    <div className="bg-white rounded-lg shadow p-3 space-y-3">
      {/* 主搜索栏 */}
      <div className="flex items-center gap-2">
        {/* 搜索输入框 */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="搜索论文标题、摘要..."
            className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* 搜索按钮 */}
        <button
          onClick={handleSearch}
          className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors"
        >
          搜索
        </button>

        {/* 筛选展开按钮 */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`p-2 rounded-lg transition-colors ${
            showFilters ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-600'
          }`}
          title="高级筛选"
        >
          <Filter className="w-5 h-5" />
        </button>
      </div>

      {/* 高级筛选面板 */}
      {showFilters && (
        <div className="flex items-center gap-4 pt-2 border-t">
          {/* 年份筛选 */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <select
              value={yearFrom}
              onChange={(e) => setYearFrom(e.target.value)}
              className="px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">起始年份</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <span className="text-gray-400">-</span>
            <select
              value={yearTo}
              onChange={(e) => setYearTo(e.target.value)}
              className="px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">结束年份</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          {/* 排序 */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">排序:</span>
            <select
              value={sortBy}
              onChange={(e) => {
                const newSortBy = e.target.value as PaperQueryParams['sort_by']
                setSortBy(newSortBy)
                onSearch({
                  search: search.trim() || undefined,
                  year_from: yearFrom ? parseInt(yearFrom) : undefined,
                  year_to: yearTo ? parseInt(yearTo) : undefined,
                  sort_by: newSortBy,
                  sort_order: sortOrder,
                  page: 1,
                })
              }}
              className="px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="created_at">添加时间</option>
              <option value="publication_year">发表年份</option>
              <option value="title">标题</option>
            </select>
            <button
              onClick={toggleSortOrder}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              title={sortOrder === 'asc' ? '升序' : '降序'}
            >
              {sortOrder === 'asc' ? (
                <SortAsc className="w-4 h-4 text-gray-600" />
              ) : (
                <SortDesc className="w-4 h-4 text-gray-600" />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
