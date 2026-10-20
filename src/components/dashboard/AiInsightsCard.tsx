import { useEffect, useState } from 'react';
import { Sparkles, Bot, AlertCircle, RefreshCw, CheckCircle2, ShieldAlert } from 'lucide-react';
import { api } from '../../services/apiClient';
import { Badge } from '../common/Badge';

interface AiInsightsCardProps {
  date: string;
  meal: string;
  predictedDiners: number;
  baselineDiners: number | null;
  context: string;
  items?: Array<{ name: string; suggestedPrep: number }>;
}

export function AiInsightsCard({
  date,
  meal,
  predictedDiners,
  baselineDiners,
  context,
  items,
}: AiInsightsCardProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    available: boolean;
    reason?: string;
    model?: string;
    insights: string[];
  } | null>(null);

  const fetchInsights = async () => {
    setLoading(true);
    try {
      const res = await api.getAiInsights({
        date,
        meal,
        predictedDiners,
        baselineDiners,
        context,
        items,
      });
      setData(res);
    } catch {
      setData({
        available: false,
        reason: 'Network or server error',
        insights: [
          `Historical demand baseline for ${meal} is ${baselineDiners ?? 450} diners; model predicted ${predictedDiners} diners.`,
          `Safety buffer covers expected variance. Monitor line prep execution closely for main dishes.`,
          `End-of-service surplus should be logged in Kitchen Operations to continuously improve accuracy.`,
        ],
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchInsights();
  }, [date, meal, predictedDiners, context]);

  return (
    <div className="rounded-xl border border-brand-200/80 bg-gradient-to-br from-brand-50/40 via-white to-emerald-50/20 p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-100 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white shadow-xs">
            <Sparkles size={16} aria-hidden />
          </span>
          <div>
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              Gemini AI Forecast Insights
              {data?.available ? (
                <Badge tone="brand">
                  <span className="flex items-center gap-1">
                    <Bot size={11} /> {data.model || 'gemini-3.8-flash'}
                  </span>
                </Badge>
              ) : (
                <Badge tone="neutral">
                  <span className="flex items-center gap-1">
                    <ShieldAlert size={11} /> Unconfigured Fallback
                  </span>
                </Badge>
              )}
            </h3>
            <p className="text-[11px] text-gray-500">
              Server-side model analysis of upcoming {meal} demand & risk factors
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void fetchInsights()}
          disabled={loading}
          className="flex items-center gap-1 text-xs text-brand-700 hover:text-brand-800 font-medium disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {loading ? (
        <div className="py-6 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
          <RefreshCw size={14} className="animate-spin text-brand-600" />
          <span>Generating AI Insights via Gemini 3.8 Flash server endpoint...</span>
        </div>
      ) : (
        <div className="mt-3.5 space-y-2.5">
          {!data?.available && (
            <div className="rounded-lg bg-amber-50 p-2.5 border border-amber-200/80 text-[11px] text-amber-800 flex items-center gap-2">
              <AlertCircle size={14} className="text-amber-600 shrink-0" />
              <span>
                <strong>Server Notice:</strong> {data?.reason || 'GEMINI_API_KEY unconfigured'}. Displaying fallback operational guidance.
              </span>
            </div>
          )}

          <ul className="space-y-2 text-xs text-gray-700">
            {data?.insights.map((bullet, idx) => (
              <li key={idx} className="flex items-start gap-2 bg-white/80 p-2.5 rounded-lg border border-gray-100">
                <CheckCircle2 size={15} className="text-brand-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{bullet}</span>
              </li>
            ))}
          </ul>

          <p className="text-[10px] text-gray-400 text-right italic">
            Executed server-side via Express API proxy. Never exposes API keys to client.
          </p>
        </div>
      )}
    </div>
  );
}
