import type { Model } from "../App";

interface ModelSelectorProps {
  models: Model[];
  selectedModel: Model | null;
  onSelect: (model: Model) => void;
}

export default function ModelSelector({
  models,
  selectedModel,
  onSelect,
}: ModelSelectorProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-surface-400 mb-2">
        🤖 模型
      </label>
      <div className="relative">
        <select
          value={selectedModel?.id || ""}
          onChange={(e) => {
            const model = models.find((m) => m.id === e.target.value);
            if (model) onSelect(model);
          }}
          className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2.5 text-white text-sm appearance-none cursor-pointer hover:border-surface-600 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50 transition-colors"
        >
          {models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name}
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
