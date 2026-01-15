import Database from "better-sqlite3";
import { join } from "path";

// 数据库文件路径
const DB_PATH = join(process.cwd(), "data", "history.db");

// 确保数据目录存在
import { mkdirSync } from "fs";
try {
  mkdirSync(join(process.cwd(), "data"), { recursive: true });
} catch {}

// 创建数据库连接
const db = new Database(DB_PATH);

// 初始化表结构
db.exec(`
  CREATE TABLE IF NOT EXISTS chat_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prompt_id TEXT NOT NULL,
    prompt_name TEXT NOT NULL,
    model_id TEXT NOT NULL,
    model_name TEXT NOT NULL,
    user_message TEXT NOT NULL,
    assistant_message TEXT NOT NULL,
    has_images INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  );
  
  CREATE INDEX IF NOT EXISTS idx_chat_history_created_at ON chat_history(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_chat_history_prompt_id ON chat_history(prompt_id);
`);

// 聊天记录接口
export interface ChatRecord {
  id?: number;
  prompt_id: string;
  prompt_name: string;
  model_id: string;
  model_name: string;
  user_message: string;
  assistant_message: string;
  has_images: number;
  created_at?: string;
}

// 保存聊天记录
export function saveChatRecord(record: Omit<ChatRecord, "id" | "created_at">) {
  const stmt = db.prepare(`
    INSERT INTO chat_history (prompt_id, prompt_name, model_id, model_name, user_message, assistant_message, has_images)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  const result = stmt.run(
    record.prompt_id,
    record.prompt_name,
    record.model_id,
    record.model_name,
    record.user_message,
    record.assistant_message,
    record.has_images
  );
  
  return result.lastInsertRowid;
}

// 获取聊天记录列表
export function getChatRecords(limit = 50, offset = 0) {
  const stmt = db.prepare(`
    SELECT * FROM chat_history
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `);
  
  return stmt.all(limit, offset) as ChatRecord[];
}

// 获取单条记录
export function getChatRecord(id: number) {
  const stmt = db.prepare(`SELECT * FROM chat_history WHERE id = ?`);
  return stmt.get(id) as ChatRecord | undefined;
}

// 删除记录
export function deleteChatRecord(id: number) {
  const stmt = db.prepare(`DELETE FROM chat_history WHERE id = ?`);
  return stmt.run(id);
}

// 获取记录总数
export function getChatRecordCount() {
  const stmt = db.prepare(`SELECT COUNT(*) as count FROM chat_history`);
  const result = stmt.get() as { count: number };
  return result.count;
}

export default db;
