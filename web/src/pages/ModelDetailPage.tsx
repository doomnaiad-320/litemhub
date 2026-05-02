import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ModelOverviewSection from '../components/ModelOverviewSection';
import ModelPricingSection from '../components/ModelPricingSection';
import ModelChannelsSection from '../components/ModelChannelsSection';
import ModelRequestsChart from '../components/ModelRequestsChart';
import { modelsApi, channelsApi, logsApi } from '../api';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface ModelConfig {
  id: string;
  name?: string;
  type?: string;
  owned_by?: string;
  description?: string;
  context_length?: number;
  max_output_length?: number;
  input_price?: number;
  output_price?: number;
  per_request_limits?: Record<string, any>;
  supported_features?: string[];
  status?: string;
  created_at?: string;
  updated_at?: string;
  config?: Record<string, any>;
}

interface Channel {
  id: string;
  name: string;
  type: string;
  status: string;
  models: string[];
  priority: number;
  weight: number;
  created_at: string;
  base_url?: string;
}

interface LogEntry {
  id: string;
  model: string;
  channel_id: string;
  channel_name?: string;
  type: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens?: number;
  latency: number;
  status: number;
  created_at: string;
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */
export default function ModelDetailPage() {
  const { modelId } = useParams<{ modelId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const decodedModelId = modelId ? decodeURIComponent(modelId) : '';

  /* ---- state ---- */
  const [model, setModel] = useState<ModelConfig | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ---- fetch ---- */
  useEffect(() => {
    if (!decodedModelId) return;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [modelRes, channelsRes, logsRes] = await Promise.all([
          modelsApi.getModelDetail(decodedModelId).catch(() => null),
          channelsApi.getChannels().catch(() => ({ data: [] })),
          logsApi
            .getLogs({ model_name: decodedModelId, page: 1, per_page: 100 })
            .catch(() => ({ data: [] })),
        ]);

        if (modelRes?.data) {
          setModel(modelRes.data);
        } else {
          setModel({
            id: decodedModelId,
            name: decodedModelId,
            type: 'chat',
            owned_by: decodedModelId.split('/')[0] || 'unknown',
          });
        }

        const allChannels = channelsRes?.data || [];
        const modelChannels = allChannels.filter((ch: Channel) =>
          ch.models?.some((m: string) => m === decodedModelId || m === '*'),
        );
        setChannels(modelChannels);
        setLogs(logsRes?.data || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load model details');
      } finally {
        setLoading(false);
      }
    })();
  }, [decodedModelId]);

  /* ---- stats derived from logs ---- */
  const stats = useMemo(() => {
    if (!logs.length) return null;

    const total = logs.length;
    const ok = logs.filter((l) => l.status >= 200 && l.status < 300);
    const avgLat =
      ok.length > 0
        ? ok.reduce((s, l) => s + (l.latency || 0), 0) / ok.length
        : 0;
    const totalTokens = logs.reduce(
      (s, l) => s + (l.total_tokens || l.input_tokens + l.output_tokens || 0),
      0,
    );
    const totalInput = logs.reduce((s, l) => s + (l.input_tokens || 0), 0);
    const totalOutput = logs.reduce((s, l) => s + (l.output_tokens || 0), 0);

    return {
      totalRequests: total,
      successRate: (ok.length / total) * 100,
      avgLatency: avgLat,
      totalTokens,
      totalInputTokens: totalInput,
      totalOutputTokens: totalOutput,
    };
  }, [logs]);

  /* ---- loading / error ---- */
  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Loading…
          </span>
        </div>
      </div>
    );

  if (error)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-500 dark:text-red-400 mb-4">{error}</p>
          <button
            onClick={() => navigate('/models')}
            className="text-sm text-blue-500 hover:text-blue-600"
          >
            ← Back to Models
          </button>
        </div>
      </div>
    );

  /* ================================================================ */
  /*  Render — flat, single-page layout (no tabs)                     */
  /* ================================================================ */
  return (
    <div className="space-y-8">
      {/* ---- Header row ---- */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <button
            onClick={() => navigate('/models')}
            className="shrink-0 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Back"
          >
            <svg
              className="w-5 h-5 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
          </button>

          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white truncate">
              {model?.name || decodedModelId}
            </h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
              {model?.owned_by && (
                <span className="text-xs">by {model.owned_by}</span>
              )}
              {model?.type && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                  {model.type}
                </span>
              )}
              {model?.context_length && (
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {(model.context_length / 1000).toFixed(0)}K context
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ---- Stat pills ---- */}
      {stats && (
        <div className="flex flex-wrap gap-3">
          <Pill
            label={t('models.detail.stats.requests', 'Requests')}
            value={stats.totalRequests.toLocaleString()}
          />
          <Pill
            label={t('models.detail.stats.successRate', 'Success')}
            value={`${stats.successRate.toFixed(1)}%`}
            color="green"
          />
          <Pill
            label={t('models.detail.stats.latency', 'Avg Latency')}
            value={
              stats.avgLatency < 1000
                ? `${stats.avgLatency.toFixed(0)}ms`
                : `${(stats.avgLatency / 1000).toFixed(2)}s`
            }
            color="blue"
          />
          <Pill
            label={t('models.detail.stats.totalTokens', 'Tokens')}
            value={formatNumber(stats.totalTokens)}
          />
          <Pill
            label={t('models.detail.stats.inputTokens', 'Input')}
            value={formatNumber(stats.totalInputTokens)}
          />
          <Pill
            label={t('models.detail.stats.outputTokens', 'Output')}
            value={formatNumber(stats.totalOutputTokens)}
          />
        </div>
      )}

      {/* ---- Overview ---- */}
      <ModelOverviewSection model={model} />

      {/* ---- Pricing ---- */}
      <ModelPricingSection model={model} />

      {/* ---- Channels ---- */}
      <ModelChannelsSection channels={channels} modelId={decodedModelId} />

      {/* ---- Analytics ---- */}
      <ModelRequestsChart logs={logs} modelId={decodedModelId} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Pill – small key/value badge (matches ChannelDetailPage style)     */
/* ------------------------------------------------------------------ */
function Pill({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  const ring =
    color === 'green'
      ? 'ring-green-200 dark:ring-green-800'
      : color === 'blue'
        ? 'ring-blue-200 dark:ring-blue-800'
        : 'ring-gray-200 dark:ring-gray-700';

  return (
    <span
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs ring-1 ${ring} bg-white dark:bg-gray-800`}
    >
      <span className="text-gray-400 dark:text-gray-500">{label}</span>
      <span className="font-semibold text-gray-900 dark:text-white">
        {value}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}
