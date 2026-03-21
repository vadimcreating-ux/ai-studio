import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Zap, BarChart2, TrendingDown, TrendingUp, ChevronLeft, ChevronRight,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { creditsApi, type CreditStatGroup, type CreditTransaction } from "../shared/api/credits";

type StatPeriod = "7d" | "30d" | "all";

const GROUP_META: Record<string, { color: string; bar: string }> = {
  "Чаты":        { color: "text-orange-400", bar: "bg-orange-400" },
  "Изображения": { color: "text-blue-400",   bar: "bg-blue-400" },
  "Видео":       { color: "text-pink-400",   bar: "bg-pink-400" },
  "Улучшения":   { color: "text-purple-400", bar: "bg-purple-400" },
  "Прочее":      { color: "text-muted",      bar: "bg-muted" },
};

const PERIOD_LABELS: Record<StatPeriod, string> = {
  "7d":  "7 дней",
  "30d": "30 дней",
  "all": "Всё время",
};

const TX_PAGE_SIZE = 20;

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("ru", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function CreditsPage() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<StatPeriod>("30d");
  const [txPage, setTxPage] = useState(0);

  const { data: statsData } = useQuery({
    queryKey: ["credits-stats", period],
    queryFn: () => creditsApi.stats(period),
  });

  const { data: txData } = useQuery({
    queryKey: ["credits-history", txPage],
    queryFn: () => creditsApi.history(TX_PAGE_SIZE, txPage * TX_PAGE_SIZE),
  });

  const creditStats = (statsData as { ok: boolean; data: { period: string; total_spent: number; total_refunded: number; total_added: number; tx_count: number; by_group: CreditStatGroup[] } } | undefined)?.data;
  const byGroup = creditStats?.by_group ?? [];
  const maxGroupSpent = byGroup.reduce((m, g) => Math.max(m, g.total_spent), 0);

  const txItems: CreditTransaction[] = (txData as { ok: boolean; data: { items: CreditTransaction[]; total: number } } | undefined)?.data?.items ?? [];
  const txTotal: number = (txData as { ok: boolean; data: { items: CreditTransaction[]; total: number } } | undefined)?.data?.total ?? 0;
  const totalPages = Math.ceil(txTotal / TX_PAGE_SIZE);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Кредиты</h1>
          <p className="text-muted text-sm mt-1">Баланс, статистика и история списаний</p>
        </div>

        {/* Balance + summary row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="col-span-2 sm:col-span-1 bg-panel border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={16} className="text-accent" fill="currentColor" />
              <span className="text-xs text-muted uppercase tracking-wide">Баланс</span>
            </div>
            <div className="text-3xl font-bold text-white">{Number(user?.credits_balance ?? 0).toFixed(2)}</div>
            <div className="text-xs text-muted mt-1">кредитов</div>
          </div>

          <div className="bg-panel border border-border rounded-xl p-5">
            <div className="text-xs text-muted uppercase tracking-wide mb-2">Потрачено (30д)</div>
            <div className="text-2xl font-bold text-red-400">{(creditStats?.total_spent ?? 0).toFixed(1)}</div>
            <div className="text-xs text-muted mt-1">{creditStats?.tx_count ?? 0} операций</div>
          </div>

          <div className="bg-panel border border-border rounded-xl p-5">
            <div className="text-xs text-muted uppercase tracking-wide mb-2">Возвращено (30д)</div>
            <div className="text-2xl font-bold text-green-400">{(creditStats?.total_refunded ?? 0).toFixed(1)}</div>
            <div className="text-xs text-muted mt-1">рефанды</div>
          </div>

          <div className="bg-panel border border-border rounded-xl p-5">
            <div className="text-xs text-muted uppercase tracking-wide mb-2">Пополнено (30д)</div>
            <div className="text-2xl font-bold text-accent">{(creditStats?.total_added ?? 0).toFixed(1)}</div>
            <div className="text-xs text-muted mt-1">начислено</div>
          </div>
        </div>

        {/* Stats by group */}
        <div className="bg-panel border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <BarChart2 size={15} className="text-accent" />
              Расход по группам
            </h2>
            <div className="flex gap-1">
              {(["7d", "30d", "all"] as StatPeriod[]).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`text-xs px-3 py-1 rounded-lg transition-colors ${
                    period === p
                      ? "bg-accent text-white font-medium"
                      : "bg-surface text-muted hover:text-white"
                  }`}
                >
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          {byGroup.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32">
              <BarChart2 size={28} className="text-muted mb-2" />
              <p className="text-sm text-muted">Нет данных за выбранный период</p>
            </div>
          ) : (
            <div className="space-y-5">
              {byGroup.map((g: CreditStatGroup) => {
                const meta = GROUP_META[g.group_name] ?? GROUP_META["Прочее"];
                const pct = maxGroupSpent > 0 ? (g.total_spent / maxGroupSpent) * 100 : 0;
                const markupPct = g.total_spent > 0 ? (g.markup_total / g.total_spent) * 100 : 0;
                return (
                  <div key={g.group_name}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${meta.color}`}>{g.group_name}</span>
                        <span className="text-xs text-muted">{g.tx_count} операций</span>
                      </div>
                      <div className="flex items-center gap-4 text-right">
                        <div>
                          <div className="text-[11px] text-muted">KIE</div>
                          <div className="text-xs text-white font-mono">{g.kie_total.toFixed(3)}</div>
                        </div>
                        <div>
                          <div className="text-[11px] text-muted">Наценка {markupPct.toFixed(0)}%</div>
                          <div className="text-xs text-white font-mono">{g.markup_total.toFixed(3)}</div>
                        </div>
                        <div>
                          <div className="text-[11px] text-muted">Итого</div>
                          <div className="text-sm font-bold text-white font-mono">{g.total_spent.toFixed(2)}</div>
                        </div>
                      </div>
                    </div>
                    <div className="h-2 bg-surface rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${meta.bar}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Transaction history */}
        <div className="bg-panel border border-border rounded-xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-white">История транзакций</h2>
            <span className="text-xs text-muted">{txTotal} всего</span>
          </div>

          {txItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32">
              <p className="text-sm text-muted">Транзакций пока нет</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {txItems.map((tx) => {
                const amt = Number(tx.amount);
                const isSpend = amt < 0;
                const groupMeta = GROUP_META[tx.group_name] ?? GROUP_META["Прочее"];
                return (
                  <div key={tx.id} className="flex items-center gap-3 px-6 py-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isSpend ? "bg-red-500/10" : "bg-green-500/10"}`}>
                      {isSpend
                        ? <TrendingDown size={13} className="text-red-400" />
                        : <TrendingUp size={13} className="text-green-400" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white truncate">{tx.description || tx.operation}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {tx.group_name && (
                          <span className={`text-[11px] font-medium ${groupMeta.color}`}>{tx.group_name}</span>
                        )}
                        {tx.kie_amount > 0 && (
                          <span className="text-[11px] text-muted">KIE: {Number(tx.kie_amount).toFixed(4)}</span>
                        )}
                        {tx.markup_percent > 0 && (
                          <span className="text-[11px] text-muted">наценка {Number(tx.markup_percent).toFixed(0)}%</span>
                        )}
                        <span className="text-[11px] text-muted">{formatDate(tx.created_at)}</span>
                      </div>
                    </div>

                    <span className={`text-sm font-mono font-bold flex-shrink-0 ${isSpend ? "text-red-400" : "text-green-400"}`}>
                      {amt > 0 ? "+" : ""}{amt.toFixed(3)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-border">
              <button
                onClick={() => setTxPage(p => Math.max(0, p - 1))}
                disabled={txPage === 0}
                className="flex items-center gap-1.5 text-sm text-muted hover:text-white disabled:opacity-30 transition-colors"
              >
                <ChevronLeft size={16} /> Назад
              </button>
              <span className="text-sm text-muted">
                Стр. {txPage + 1} из {totalPages}
              </span>
              <button
                onClick={() => setTxPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={txPage >= totalPages - 1}
                className="flex items-center gap-1.5 text-sm text-muted hover:text-white disabled:opacity-30 transition-colors"
              >
                Вперёд <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
