import { AlertTriangle } from "lucide-react";

export default function ClaudePage() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 text-center px-4">
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-full p-5">
        <AlertTriangle size={40} className="text-yellow-400" />
      </div>
      <div>
        <h2 className="text-xl font-semibold text-white mb-2">Claude временно недоступен</h2>
        <p className="text-muted max-w-sm">
          Провайдер проводит технические работы. Модели Claude будут восстановлены в ближайшее время.
        </p>
      </div>
      <p className="text-xs text-muted">Попробуйте ChatGPT или Gemini пока Claude недоступен</p>
    </div>
  );
}
