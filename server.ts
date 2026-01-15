import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamText as streamTextResponse } from "hono/streaming";
import { serve } from "@hono/node-server";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import {
  saveChatRecord,
  getChatRecords,
  getChatRecord,
  deleteChatRecord,
  getChatRecordCount,
} from "./db";

const app = new Hono();

// CORS 配置
app.use("/api/*", cors());

// OpenRouter 客户端
const openrouter = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY || "",
  baseURL: "https://openrouter.ai/api/v1",
});

// 提示词目录
const PROMPTS_DIR = "./local-dev";

// 可用模型列表
const AVAILABLE_MODELS = [
  { id: "google/gemini-3-flash-preview", name: "Gemini 3 Flash Preview" },
  { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash" },
  { id: "x-ai/grok-4.1-fast", name: "Grok 4.1 Fast" },
  { id: "openai/gpt-5-mini", name: "GPT-5 Mini" },
  { id: "anthropic/claude-haiku-4.5", name: "Claude Haiku 4.5" },
  { id: "deepseek/deepseek-v3.2", name: "DeepSeek V3.2" },
  { id: "z-ai/glm-4.7", name: "GLM 4.7" },
  { id: "minimax/minimax-m2.1", name: "MiniMax M2.1" },
  { id: "xiaomi/mimo-v2-flash:free", name: "MiMo V2 Flash (Free)" },
];

// 获取可用模型列表
app.get("/api/models", (c) => {
  return c.json(AVAILABLE_MODELS);
});

// 获取所有提示词文件列表
app.get("/api/prompts", async (c) => {
  try {
    const files = await readdir(PROMPTS_DIR);
    const prompts = files
      .filter((f) => f.endsWith(".md"))
      .map((f) => ({
        id: f.replace(".md", ""),
        name: f.replace(".md", "").replace(/-/g, " "),
        filename: f,
      }));
    return c.json(prompts);
  } catch (error) {
    return c.json({ error: "Failed to read prompts directory" }, 500);
  }
});

// 获取指定提示词内容
app.get("/api/prompts/:name", async (c) => {
  const name = c.req.param("name");
  const filepath = join(PROMPTS_DIR, `${name}.md`);

  try {
    const content = await readFile(filepath, "utf-8");
    return c.json({ id: name, content });
  } catch (error) {
    return c.json({ error: "Prompt not found" }, 404);
  }
});

// 图片附件接口
interface ImageAttachment {
  id: string;
  base64: string;
}

// 消息接口
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  images?: ImageAttachment[];
}

// 构建多模态消息内容
function buildMessageContent(message: ChatMessage) {
  // 如果没有图片，直接返回文本
  if (!message.images || message.images.length === 0) {
    return message.content;
  }

  // 构建多模态内容数组
  const content: Array<
    | { type: "text"; text: string }
    | { type: "image"; image: string }
  > = [];

  // 添加图片
  for (const img of message.images) {
    // 从 base64 data URL 中提取纯 base64 数据
    const base64Data = img.base64.includes(",")
      ? img.base64.split(",")[1]
      : img.base64;

    content.push({
      type: "image",
      image: base64Data,
    });
  }

  // 添加文本（如果有）
  if (message.content.trim()) {
    content.push({
      type: "text",
      text: message.content,
    });
  }

  return content;
}

// 流式对话接口
app.post("/api/chat", async (c) => {
  const body = await c.req.json();
  const { messages, systemPrompt, model } = body as {
    messages: ChatMessage[];
    systemPrompt: string;
    model: string;
  };

  if (!process.env.OPENROUTER_API_KEY) {
    return c.json({ error: "OPENROUTER_API_KEY not configured" }, 500);
  }

  const selectedModel = model || "anthropic/claude-3.5-sonnet";

  try {
    // 转换消息格式，支持多模态
    const formattedMessages = messages.map((msg) => {
      const content = buildMessageContent(msg);
      if (msg.role === "user") {
        return {
          role: "user" as const,
          content,
        };
      }
      // assistant 消息只能是纯文本
      return {
        role: "assistant" as const,
        content: typeof content === "string" ? content : msg.content,
      };
    });

    const result = streamText({
      model: openrouter(selectedModel),
      system: systemPrompt,
      messages: formattedMessages,
    });

    // 使用 SSE 流式返回
    return streamTextResponse(c, async (stream) => {
      for await (const chunk of result.textStream) {
        await stream.write(chunk);
      }
    });
  } catch (error) {
    console.error("Chat error:", error);
    return c.json({ error: "Failed to generate response" }, 500);
  }
});

// 健康检查
app.get("/api/health", (c) => {
  return c.json({
    status: "ok",
    hasApiKey: !!process.env.OPENROUTER_API_KEY,
  });
});

// 保存聊天记录
app.post("/api/history", async (c) => {
  try {
    const body = await c.req.json();
    const { prompt_id, prompt_name, model_id, model_name, user_message, assistant_message, has_images } = body;
    
    const id = saveChatRecord({
      prompt_id,
      prompt_name,
      model_id,
      model_name,
      user_message,
      assistant_message,
      has_images: has_images ? 1 : 0,
    });
    
    return c.json({ id, success: true });
  } catch (error) {
    console.error("Save history error:", error);
    return c.json({ error: "Failed to save history" }, 500);
  }
});

// 获取聊天记录列表
app.get("/api/history", (c) => {
  try {
    const limit = parseInt(c.req.query("limit") || "50");
    const offset = parseInt(c.req.query("offset") || "0");
    
    const records = getChatRecords(limit, offset);
    const total = getChatRecordCount();
    
    return c.json({ records, total });
  } catch (error) {
    console.error("Get history error:", error);
    return c.json({ error: "Failed to get history" }, 500);
  }
});

// 获取单条记录
app.get("/api/history/:id", (c) => {
  try {
    const id = parseInt(c.req.param("id"));
    const record = getChatRecord(id);
    
    if (!record) {
      return c.json({ error: "Record not found" }, 404);
    }
    
    return c.json(record);
  } catch (error) {
    console.error("Get history record error:", error);
    return c.json({ error: "Failed to get record" }, 500);
  }
});

// 删除记录
app.delete("/api/history/:id", (c) => {
  try {
    const id = parseInt(c.req.param("id"));
    deleteChatRecord(id);
    return c.json({ success: true });
  } catch (error) {
    console.error("Delete history error:", error);
    return c.json({ error: "Failed to delete record" }, 500);
  }
});

const port = 9988;

serve({
  fetch: app.fetch,
  port,
}, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
