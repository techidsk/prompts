import { useState, useEffect, useRef, useCallback } from "react";
import { useSearch, useNavigate } from "@tanstack/react-router";
import PromptSelector from "../components/PromptSelector";
import ModelSelector from "../components/ModelSelector";
import ChatArea from "../components/ChatArea";

export interface ImageAttachment {
  id: string;
  file: File;
  preview: string;
  base64?: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  images?: ImageAttachment[];
}

export interface Prompt {
  id: string;
  name: string;
  filename: string;
  content?: string;
}

export interface Model {
  id: string;
  name: string;
}

export default function PlaygroundPage() {
  const search = useSearch({ from: "/" });
  const navigate = useNavigate();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const historyLoadedRef = useRef(false);

  // 加载提示词列表
  useEffect(() => {
    fetch("/api/prompts")
      .then((res) => res.json())
      .then((data) => {
        setPrompts(data);
        // 如果有 search params 中的 promptId，优先使用
        if (search.promptId) {
          const targetPrompt = data.find((p: Prompt) => p.id === search.promptId);
          if (targetPrompt) {
            handleSelectPrompt(targetPrompt, true); // 不清空消息
            return;
          }
        }
        if (data.length > 0) {
          handleSelectPrompt(data[0]);
        }
      })
      .catch(console.error);
  }, []);

  // 加载模型列表
  useEffect(() => {
    fetch("/api/models")
      .then((res) => res.json())
      .then((data) => {
        setModels(data);
        // 如果有 search params 中的 modelId，优先使用
        if (search.modelId) {
          const targetModel = data.find((m: Model) => m.id === search.modelId);
          if (targetModel) {
            setSelectedModel(targetModel);
            return;
          }
        }
        if (data.length > 0) {
          setSelectedModel(data[0]);
        }
      })
      .catch(console.error);
  }, []);

  // 从历史记录加载对话
  useEffect(() => {
    if (search.historyId && !historyLoadedRef.current) {
      historyLoadedRef.current = true;
      fetch(`/api/history/${search.historyId}`)
        .then((res) => res.json())
        .then((record) => {
          if (record && !record.error) {
            // 创建消息
            const userMessage: Message = {
              id: `history-user-${record.id}`,
              role: "user",
              content: record.user_message,
            };
            const assistantMessage: Message = {
              id: `history-assistant-${record.id}`,
              role: "assistant",
              content: record.assistant_message,
            };
            setMessages([userMessage, assistantMessage]);
            
            // 清除 URL 参数
            navigate({ to: "/", search: {}, replace: true });
          }
        })
        .catch(console.error);
    }
  }, [search.historyId, navigate]);

  // 选择提示词
  const handleSelectPrompt = async (prompt: Prompt, keepMessages = false) => {
    try {
      const res = await fetch(`/api/prompts/${prompt.id}`);
      const data = await res.json();
      setSelectedPrompt({ ...prompt, content: data.content });
      // 切换提示词时清空对话（除非指定保留）
      if (!keepMessages) {
        setMessages([]);
      }
    } catch (error) {
      console.error("Failed to load prompt:", error);
    }
  };

  // 发送消息
  const handleSendMessage = useCallback(
    async (content: string, images?: ImageAttachment[]) => {
      if ((!content.trim() && (!images || images.length === 0)) || !selectedPrompt?.content || !selectedModel) return;

      const userMessage: Message = {
        id: Date.now().toString(),
        role: "user",
        content: content.trim(),
        images: images,
      };

      const newMessages = [...messages, userMessage];
      setMessages(newMessages);
      setIsLoading(true);
      setIsStreaming(true);

      // 创建 assistant 消息占位
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "",
      };
      setMessages([...newMessages, assistantMessage]);

      try {
        abortControllerRef.current = new AbortController();

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: newMessages.map((m) => ({
              role: m.role,
              content: m.content,
              // 只发送图片的 id 和 base64 数据
              images: m.images?.map((img) => ({
                id: img.id,
                base64: img.base64,
              })),
            })),
            systemPrompt: selectedPrompt.content,
            model: selectedModel.id,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error("Failed to get response");
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (reader) {
          let fullContent = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            fullContent += chunk;

            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMessage.id
                  ? { ...m, content: fullContent }
                  : m
              )
            );
          }

          // 保存到历史记录
          if (fullContent && selectedPrompt && selectedModel) {
            fetch("/api/history", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                prompt_id: selectedPrompt.id,
                prompt_name: selectedPrompt.name,
                model_id: selectedModel.id,
                model_name: selectedModel.name,
                user_message: content.trim(),
                assistant_message: fullContent,
                has_images: images && images.length > 0,
              }),
            }).catch(console.error);
          }
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          console.log("Request aborted");
        } else {
          console.error("Chat error:", error);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessage.id
                ? { ...m, content: "❌ 请求失败，请检查 API Key 配置" }
                : m
            )
          );
        }
      } finally {
        setIsLoading(false);
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [messages, selectedPrompt, selectedModel]
  );

  // 停止生成
  const handleStopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  // 清空对话
  const handleClearChat = useCallback(() => {
    setMessages([]);
  }, []);

  return (
    <div className="flex h-full overflow-hidden">
      {/* 左侧边栏 */}
      <aside className="w-80 bg-surface-900/50 backdrop-blur-sm border-r border-surface-800 flex flex-col">
        {/* 提示词选择 */}
        <div className="p-4 border-b border-surface-800">
          <PromptSelector
            prompts={prompts}
            selectedPrompt={selectedPrompt}
            onSelect={handleSelectPrompt}
          />
        </div>

        {/* 模型选择 */}
        <div className="p-4 border-b border-surface-800">
          <ModelSelector
            models={models}
            selectedModel={selectedModel}
            onSelect={setSelectedModel}
          />
        </div>

        {/* 当前提示词预览 */}
        <div className="flex-1 p-4 overflow-hidden flex flex-col">
          <h3 className="text-sm font-medium text-surface-400 mb-2">
            System Prompt
          </h3>
          <div className="flex-1 bg-surface-950 rounded-lg p-3 overflow-auto">
            <pre className="text-xs text-surface-400 whitespace-pre-wrap font-mono leading-relaxed">
              {selectedPrompt?.content || "选择一个提示词..."}
            </pre>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="p-4 border-t border-surface-800">
          <button
            onClick={handleClearChat}
            className="w-full py-2 px-4 bg-surface-800 hover:bg-surface-700 text-surface-300 rounded-lg transition-colors text-sm"
          >
            🗑️ 清空对话
          </button>
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 flex flex-col bg-surface-950 overflow-hidden">
        <ChatArea
          messages={messages}
          isLoading={isLoading}
          isStreaming={isStreaming}
          onSendMessage={handleSendMessage}
          onStopGeneration={handleStopGeneration}
        />
      </main>
    </div>
  );
}
