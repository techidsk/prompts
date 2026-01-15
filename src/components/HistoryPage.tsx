import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface HistoryRecord {
  id: number;
  prompt_id: string;
  prompt_name: string;
  model_id: string;
  model_name: string;
  user_message: string;
  assistant_message: string;
  has_images: number;
  created_at: string;
}

interface HistoryPageProps {
  onBack: () => void;
}

export default function HistoryPage({ onBack }: HistoryPageProps) {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<HistoryRecord | null>(null);
  const [page, setPage] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    fetchRecords();
  }, [page]);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/history?limit=${pageSize}&offset=${page * pageSize}`);
      const data = await res.json();
      setRecords(data.records);
      setTotal(data.total);
    } catch (error) {
      console.error("Failed to fetch history:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("确定要删除这条记录吗？")) return;

    try {
      await fetch(`/api/history/${id}`, { method: "DELETE" });
      setRecords((prev) => prev.filter((r) => r.id !== id));
      setTotal((prev) => prev - 1);
      if (selectedRecord?.id === id) {
        setSelectedRecord(null);
      }
    } catch (error) {
      console.error("Failed to delete record:", error);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const truncateText = (text: string, maxLen = 80) => {
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen) + "...";
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="flex h-screen">
      {/* 左侧列表 */}
      <aside className="w-96 bg-surface-900/50 backdrop-blur-sm border-r border-surface-800 flex flex-col">
        {/* 头部 */}
        <div className="p-4 border-b border-surface-800 flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-surface-800 rounded-lg transition-colors text-surface-400 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h2 className="text-lg font-semibold text-white">历史记录</h2>
            <p className="text-xs text-surface-500">共 {total} 条记录</p>
          </div>
        </div>

        {/* 列表 */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-surface-500">
              <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <p>暂无记录</p>
            </div>
          ) : (
            <div className="divide-y divide-surface-800">
              {records.map((record) => (
                <div
                  key={record.id}
                  onClick={() => setSelectedRecord(record)}
                  className={`p-4 cursor-pointer transition-colors hover:bg-surface-800/50 ${
                    selectedRecord?.id === record.id ? "bg-surface-800" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 text-xs bg-accent/20 text-accent rounded">
                        {record.prompt_name}
                      </span>
                      <span className="px-2 py-0.5 text-xs bg-surface-700 text-surface-300 rounded">
                        {record.model_name}
                      </span>
                      {record.has_images === 1 && (
                        <span className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded">
                          📷 图片
                        </span>
                      )}
                    </div>
                    <button
                      onClick={(e) => handleDelete(record.id, e)}
                      className="p-1 hover:bg-red-500/20 rounded text-surface-500 hover:text-red-400 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-sm text-surface-300 mb-1 line-clamp-2">
                    {truncateText(record.user_message)}
                  </p>
                  <p className="text-xs text-surface-500">{formatDate(record.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-surface-800 flex items-center justify-between">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 text-sm bg-surface-800 hover:bg-surface-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors text-surface-300"
            >
              上一页
            </button>
            <span className="text-sm text-surface-500">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 text-sm bg-surface-800 hover:bg-surface-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors text-surface-300"
            >
              下一页
            </button>
          </div>
        )}
      </aside>

      {/* 右侧详情 */}
      <main className="flex-1 bg-surface-950 overflow-auto">
        {selectedRecord ? (
          <div className="max-w-4xl mx-auto p-8">
            {/* 元信息 */}
            <div className="mb-6 pb-6 border-b border-surface-800">
              <div className="flex items-center gap-3 mb-3">
                <span className="px-3 py-1 text-sm bg-accent/20 text-accent rounded-lg">
                  {selectedRecord.prompt_name}
                </span>
                <span className="px-3 py-1 text-sm bg-surface-700 text-surface-300 rounded-lg">
                  {selectedRecord.model_name}
                </span>
              </div>
              <p className="text-sm text-surface-500">
                {formatDate(selectedRecord.created_at)}
              </p>
            </div>

            {/* 用户消息 */}
            <div className="mb-8">
              <h3 className="text-sm font-medium text-surface-400 mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-surface-700 flex items-center justify-center text-xs">
                  👤
                </span>
                用户输入
              </h3>
              <div className="bg-surface-900 rounded-xl p-4">
                <p className="text-surface-200 whitespace-pre-wrap">{selectedRecord.user_message}</p>
              </div>
            </div>

            {/* AI 回复 */}
            <div>
              <h3 className="text-sm font-medium text-surface-400 mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-xs">
                  🤖
                </span>
                AI 回复
              </h3>
              <div className="bg-surface-900/50 rounded-xl p-4">
                <div className="markdown-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {selectedRecord.assistant_message}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-surface-500">
            <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p>选择一条记录查看详情</p>
          </div>
        )}
      </main>
    </div>
  );
}
