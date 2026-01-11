import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message } from "../App";

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
}

export default function MessageBubble({
  message,
  isStreaming,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  return (
    <>
      <div className={`mb-6 ${isUser ? "text-right" : "text-left"}`}>
        {/* 角色标签 */}
        <div className="flex items-center gap-2 mb-2">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              isUser
                ? "bg-accent/20 text-accent ml-auto"
                : "bg-emerald-500/20 text-emerald-400"
            }`}
          >
            {isUser ? "你" : "AI"}
          </div>
        </div>

        {/* 图片附件 */}
        {message.images && message.images.length > 0 && (
          <div
            className={`flex flex-wrap gap-2 mb-2 ${isUser ? "justify-end" : "justify-start"}`}
          >
            {message.images.map((image) => (
              <button
                key={image.id}
                onClick={() => setLightboxImage(image.preview || image.base64 || "")}
                className="relative group cursor-zoom-in"
              >
                <img
                  src={image.preview || image.base64}
                  alt="附件"
                  className="max-w-[200px] max-h-[200px] object-cover rounded-xl border border-surface-700 hover:border-accent transition-colors"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-xl transition-colors flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
                    />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* 消息内容 */}
        {(message.content || message.role === "assistant") && (
          <div
            className={`inline-block max-w-[85%] rounded-2xl px-4 py-3 ${
              isUser
                ? "bg-accent/20 text-white rounded-br-md"
                : "bg-surface-800/80 text-surface-200 rounded-bl-md"
            }`}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap text-left">{message.content}</p>
            ) : (
              <div
                className={`markdown-content text-left ${isStreaming && !message.content ? "typing-cursor" : ""}`}
              >
                {message.content ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {message.content}
                  </ReactMarkdown>
                ) : (
                  <span className="text-surface-500">思考中...</span>
                )}
                {isStreaming && message.content && (
                  <span className="typing-cursor" />
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 图片灯箱 */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <button
            className="absolute top-4 right-4 w-10 h-10 bg-surface-800 hover:bg-surface-700 rounded-full flex items-center justify-center text-white transition-colors"
            onClick={() => setLightboxImage(null)}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
          <img
            src={lightboxImage}
            alt="放大预览"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
