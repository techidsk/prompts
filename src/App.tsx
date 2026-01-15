// 此文件已弃用，请使用 router.tsx 和 pages/ 目录下的组件
// This file is deprecated, please use router.tsx and components in pages/

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

export default function App() {
  return null;
}
