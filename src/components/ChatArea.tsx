import { useState, useRef, useEffect, useCallback } from "react";
import type { Message, ImageAttachment } from "../App";
import MessageBubble from "./MessageBubble";

interface ChatAreaProps {
  messages: Message[];
  isLoading: boolean;
  isStreaming: boolean;
  onSendMessage: (content: string, images?: ImageAttachment[]) => void;
  onStopGeneration: () => void;
}

export default function ChatArea({
  messages,
  isLoading,
  isStreaming,
  onSendMessage,
  onStopGeneration,
}: ChatAreaProps) {
  const [input, setInput] = useState("");
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 自动调整输入框高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  // 图片压缩配置
  const MAX_WIDTH = 1920;
  const MAX_HEIGHT = 1920;
  const QUALITY = 0.85;
  const MAX_FILE_SIZE = 1024 * 1024; // 1MB，超过此大小才压缩

  // 压缩图片
  const compressImage = useCallback(
    (file: File): Promise<{ blob: Blob; base64: string }> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        img.onload = () => {
          let { width, height } = img;

          // 计算缩放比例
          if (width > MAX_WIDTH || height > MAX_HEIGHT) {
            const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          canvas.width = width;
          canvas.height = height;

          if (ctx) {
            // 使用白色背景（针对透明PNG）
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);

            // 转换为 JPEG 格式（更小的文件大小）
            canvas.toBlob(
              (blob) => {
                if (blob) {
                  const reader = new FileReader();
                  reader.onload = () => {
                    resolve({
                      blob,
                      base64: reader.result as string,
                    });
                  };
                  reader.onerror = reject;
                  reader.readAsDataURL(blob);
                } else {
                  reject(new Error("Failed to compress image"));
                }
              },
              "image/jpeg",
              QUALITY
            );
          } else {
            reject(new Error("Failed to get canvas context"));
          }
        };

        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = URL.createObjectURL(file);
      });
    },
    []
  );

  // 处理图片文件
  const processImageFiles = useCallback(
    async (files: FileList | File[]) => {
      const imageFiles = Array.from(files).filter((file) =>
        file.type.startsWith("image/")
      );

      const newImages: ImageAttachment[] = await Promise.all(
        imageFiles.map(async (file) => {
          let base64: string;
          let finalFile = file;

          // 如果文件大于阈值，进行压缩
          if (file.size > MAX_FILE_SIZE) {
            try {
              const compressed = await compressImage(file);
              base64 = compressed.base64;
              // 创建新的 File 对象
              finalFile = new File([compressed.blob], file.name, {
                type: "image/jpeg",
              });
              console.log(
                `图片压缩: ${(file.size / 1024).toFixed(1)}KB -> ${(compressed.blob.size / 1024).toFixed(1)}KB`
              );
            } catch (error) {
              console.error("压缩失败，使用原图:", error);
              base64 = await fileToBase64(file);
            }
          } else {
            base64 = await fileToBase64(file);
          }

          const preview = URL.createObjectURL(finalFile);

          return {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            file: finalFile,
            preview,
            base64,
          };
        })
      );

      setImages((prev) => [...prev, ...newImages]);
    },
    [compressImage]
  );

  // 文件转 base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });
  };

  // 删除图片
  const removeImage = useCallback((id: string) => {
    setImages((prev) => {
      const image = prev.find((img) => img.id === id);
      if (image) {
        URL.revokeObjectURL(image.preview);
      }
      return prev.filter((img) => img.id !== id);
    });
  }, []);

  // 处理文件选择
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        processImageFiles(e.target.files);
      }
      // 重置 input 以允许选择相同文件
      e.target.value = "";
    },
    [processImageFiles]
  );

  // 拖拽处理
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files) {
        processImageFiles(e.dataTransfer.files);
      }
    },
    [processImageFiles]
  );

  // 粘贴处理
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData.items;
      const imageFiles: File[] = [];

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile();
          if (file) {
            imageFiles.push(file);
          }
        }
      }

      if (imageFiles.length > 0) {
        processImageFiles(imageFiles);
      }
    },
    [processImageFiles]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((input.trim() || images.length > 0) && !isLoading) {
      onSendMessage(input, images.length > 0 ? images : undefined);
      setInput("");
      // 清理图片预览 URL
      images.forEach((img) => URL.revokeObjectURL(img.preview));
      setImages([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div
      className="flex-1 flex flex-col relative overflow-hidden"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* 拖拽覆盖层 */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-surface-950/90 backdrop-blur-sm flex items-center justify-center border-2 border-dashed border-accent rounded-xl m-4">
          <div className="text-center">
            <div className="text-5xl mb-3">📷</div>
            <p className="text-lg font-medium text-white">释放以上传图片</p>
            <p className="text-sm text-surface-400 mt-1">
              支持 JPG、PNG、GIF、WebP
            </p>
          </div>
        </div>
      )}

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-lg px-6">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-accent/20 to-emerald-500/20 flex items-center justify-center">
                <svg
                  className="w-10 h-10 text-accent"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-white mb-3">
                开始对话
              </h2>
              <p className="text-surface-400 mb-6 leading-relaxed">
                选择左侧的提示词和模型，然后在下方输入消息开始测试。
                支持上传多张图片进行多模态对话。
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <div className="flex items-center gap-2 px-3 py-2 bg-surface-800/50 rounded-lg text-sm text-surface-400">
                  <span>📷</span>
                  <span>支持图片上传</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 bg-surface-800/50 rounded-lg text-sm text-surface-400">
                  <span>📋</span>
                  <span>支持粘贴图片</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 bg-surface-800/50 rounded-lg text-sm text-surface-400">
                  <span>🖱️</span>
                  <span>支持拖拽上传</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto py-6 px-4">
            {messages.map((message, index) => (
              <MessageBubble
                key={message.id}
                message={message}
                isStreaming={
                  isStreaming &&
                  index === messages.length - 1 &&
                  message.role === "assistant"
                }
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* 输入区域 */}
      <div className="border-t border-surface-800 bg-surface-900/80 backdrop-blur-md">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto p-4">
          {/* 图片预览区 */}
          {images.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2 p-3 bg-surface-800/50 rounded-xl">
              {images.map((image) => (
                <div key={image.id} className="relative group">
                  <img
                    src={image.preview}
                    alt="预览"
                    className="w-20 h-20 object-cover rounded-lg border border-surface-700"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(image.id)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-400 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                  >
                    ✕
                  </button>
                  <div className="absolute bottom-1 left-1 right-1 text-[10px] text-white bg-black/60 rounded px-1 truncate">
                    {image.file.name}
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-20 h-20 border-2 border-dashed border-surface-600 hover:border-accent rounded-lg flex flex-col items-center justify-center text-surface-500 hover:text-accent transition-colors"
              >
                <span className="text-2xl">+</span>
                <span className="text-[10px]">添加图片</span>
              </button>
            </div>
          )}

          {/* 输入框容器 */}
          <div className="relative bg-surface-800 border border-surface-700 rounded-2xl focus-within:border-accent focus-within:ring-1 focus-within:ring-accent/50 transition-all">
            {/* 工具栏 */}
            <div className="flex items-center gap-1 px-3 pt-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-surface-400 hover:text-accent hover:bg-surface-700 rounded-lg transition-colors"
                title="上传图片"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              {images.length > 0 && (
                <span className="text-xs text-surface-500 ml-2">
                  已选择 {images.length} 张图片
                </span>
              )}
            </div>

            {/* 文本输入 */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="输入消息... (Shift+Enter 换行，可粘贴或拖拽图片)"
              disabled={isLoading}
              rows={1}
              className="w-full bg-transparent px-4 py-3 text-white placeholder-surface-500 resize-none focus:outline-none disabled:opacity-50"
            />

            {/* 发送按钮区 */}
            <div className="flex items-center justify-between px-3 pb-2">
              <p className="text-xs text-surface-600">
                使用 OpenRouter API · 支持多模态模型
              </p>
              <div className="flex gap-2">
                {isStreaming ? (
                  <button
                    type="button"
                    onClick={onStopGeneration}
                    className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                    停止
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={(!input.trim() && images.length === 0) || isLoading}
                    className="px-4 py-2 bg-accent hover:bg-accent-light disabled:bg-surface-700 disabled:text-surface-500 text-white rounded-xl text-sm font-medium transition-colors disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                      />
                    </svg>
                    发送
                  </button>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
