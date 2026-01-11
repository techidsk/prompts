import type { Prompt } from "../App";

interface PromptSelectorProps {
  prompts: Prompt[];
  selectedPrompt: Prompt | null;
  onSelect: (prompt: Prompt) => void;
}

export default function PromptSelector({
  prompts,
  selectedPrompt,
  onSelect,
}: PromptSelectorProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-surface-400 mb-2">
        📝 提示词
      </label>
      <div className="relative">
        <select
          value={selectedPrompt?.id || ""}
          onChange={(e) => {
            const prompt = prompts.find((p) => p.id === e.target.value);
            if (prompt) onSelect(prompt);
          }}
          className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2.5 text-white text-sm appearance-none cursor-pointer hover:border-surface-600 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50 transition-colors"
        >
          {prompts.map((prompt) => (
            <option key={prompt.id} value={prompt.id}>
              {prompt.name}
            </option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-surface-500">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
