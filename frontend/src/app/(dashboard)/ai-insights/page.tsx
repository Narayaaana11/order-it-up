'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Sparkles,
  Send,
  Loader2,
  TrendingUp,
  AlertTriangle,
  ChefHat,
  Flame,
  Clock,
  ArrowUpRight,
  DollarSign,
  PieChart,
  RefreshCw,
  CheckCircle2,
  HelpCircle,
  Lightbulb,
  Settings,
  Key,
  Eye,
  EyeOff,
  Zap,
  Check,
  X,
  ShieldCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';

interface PrepItem {
  item: string;
  station: string;
  recommended_batches: number;
  unit: string;
  confidence: string;
  urgency: 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';
  reasoning: string;
}

interface MatrixItem {
  name: string;
  sold: number;
  revenue: number;
  avg_price: number;
  category: string;
  strategy: string;
  advice: string;
}

interface AiConfigData {
  enabled: boolean;
  model: string;
  is_configured: boolean;
  source: string;
  has_key: boolean;
  api_key_masked: string;
  popular_models: Array<{ id: string; name: string; provider: string }>;
}

interface AiInsightsData {
  ok: boolean;
  generated_at: string;
  weekend_boost: boolean;
  bcg_matrix: {
    stars: MatrixItem[];
    plowhorses: MatrixItem[];
    puzzles: MatrixItem[];
    dogs: MatrixItem[];
  };
  prep_forecast: PrepItem[];
  kitchen_metrics: {
    avg_turnaround_mins: number;
    peak_delay_station: string;
    peak_delay_item: string;
    bottleneck_risk: string;
    mitigation_tip: string;
  };
}

export default function AiInsightsPage() {
  const fmt = useFormatCurrency();

  const [insights, setInsights] = useState<AiInsightsData | null>(null);
  const [loading, setLoading] = useState(true);

  // OpenRouter Configuration State
  const [configOpen, setConfigOpen] = useState(false);
  const [aiConfig, setAiConfig] = useState<AiConfigData | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [modelInput, setModelInput] = useState('meta-llama/llama-3.3-70b-instruct:free');
  const [customModel, setCustomModel] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; latencyMs?: number; model?: string } | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);

  // Copilot chat state
  const [question, setQuestion] = useState('');
  const [answering, setAnswering] = useState(false);
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'ai'; text: string; action?: string }>>([
    {
      role: 'ai',
      text: "Hello Chef! I'm your Order It Up AI Copilot. Ask me about prep quantities for dinner, margin optimization opportunities, or how your revenue is pacing today.",
    },
  ]);

  const fetchInsights = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/ai/insights');
      if (data.ok) {
        setInsights(data);
      }
    } catch {
      toast.error('Failed to load AI insights');
    } finally {
      setLoading(false);
    }
  };

  const fetchConfig = async () => {
    try {
      const { data } = await api.get('/ai/config');
      if (data.ok) {
        setAiConfig(data);
        if (data.model) {
          setModelInput(data.model);
        }
      }
    } catch {}
  };

  useEffect(() => {
    fetchInsights();
    fetchConfig();
  }, []);

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const activeModel = modelInput === 'custom' ? customModel.trim() : modelInput;
      const { data } = await api.post('/ai/test-connection', {
        api_key: apiKeyInput.trim() || undefined,
        model: activeModel,
      });
      setTestResult(data);
      if (data.ok) {
        toast.success(data.message || 'Connected to OpenRouter!');
      } else {
        toast.error(data.message || 'Failed to connect to OpenRouter');
      }
    } catch (err: any) {
      setTestResult({ ok: false, message: err.message || 'Network error' });
      toast.error('Test connection failed');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      const activeModel = modelInput === 'custom' ? customModel.trim() : modelInput;
      const { data } = await api.post('/ai/config', {
        api_key: apiKeyInput.trim() || undefined,
        model: activeModel,
        enabled: true,
      });
      if (data.ok) {
        toast.success('AI configuration saved successfully');
        setAiConfig(data);
        setApiKeyInput('');
        fetchInsights();
      }
    } catch {
      toast.error('Failed to save AI configuration');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleAsk = async (queryToAsk?: string) => {
    const q = queryToAsk || question;
    if (!q.trim() || answering) return;

    setChatHistory((prev) => [...prev, { role: 'user', text: q }]);
    if (!queryToAsk) setQuestion('');
    setAnswering(true);

    try {
      const { data } = await api.post('/ai/ask', { question: q });
      if (data.ok) {
        setChatHistory((prev) => [
          ...prev,
          { role: 'ai', text: data.answer, action: data.action_item },
        ]);
      } else {
        toast.error(data.error || 'AI Copilot encountered an error');
      }
    } catch {
      toast.error('Failed to connect to AI Copilot');
    } finally {
      setAnswering(false);
    }
  };

  const QUICK_PROMPTS = [
    '🎯 Prep recommendations for tomorrow',
    '💰 Which items should I price hike for higher margins?',
    '📈 What is my sales performance today?',
    '🛵 How to optimize Swiggy & Zomato margins?',
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] p-4 md:p-6 overflow-y-auto bg-background space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Sparkles className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  AI Restaurant Copilot & Intelligence
                </h1>
                {aiConfig?.is_configured ? (
                  <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    <Zap className="size-3 text-emerald-600 fill-emerald-500" />
                    OpenRouter Active
                  </span>
                ) : (
                  <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border">
                    Offline Local Heuristics
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Powered by OpenRouter LLMs with instant offline culinary & financial fallback
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfigOpen(!configOpen)}
            className={`border-border text-foreground hover:bg-muted ${configOpen ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-300' : ''}`}
          >
            <Settings className="size-3.5 me-1.5 text-purple-600" />
            OpenRouter Settings
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchInsights}
            disabled={loading}
            className="border-border text-muted-foreground hover:bg-muted"
          >
            <RefreshCw className={`size-3.5 me-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Models
          </Button>
        </div>
      </div>

      {/* ── OpenRouter Configuration Card (Expandable) ──────────────── */}
      {configOpen && (
        <div className="border border-purple-200 dark:border-purple-900 rounded-2xl bg-gradient-to-r from-purple-50/70 via-background to-card dark:from-purple-950/20 dark:via-background dark:to-card p-5 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-purple-600 text-white">
                <Zap className="size-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">OpenRouter AI Integration Settings</h3>
                <p className="text-xs text-muted-foreground">
                  Connect any free or custom OpenRouter LLM for conversational waiters and executive analytics
                </p>
              </div>
            </div>
            <button
              onClick={() => setConfigOpen(false)}
              className="p-1 rounded-md hover:bg-muted text-muted-foreground"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* API Key */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Key className="size-3.5 text-purple-600" />
                OpenRouter API Key
                {aiConfig?.has_key && (
                  <span className="text-[10px] font-normal text-emerald-600 flex items-center gap-0.5">
                    <ShieldCheck className="size-3" /> Configured ({aiConfig.api_key_masked})
                  </span>
                )}
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  placeholder={aiConfig?.has_key ? 'Enter new key to update...' : 'sk-or-v1-...'}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  className="w-full text-xs px-3 py-2 pe-9 rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Get a free API key at <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-purple-600 underline hover:text-purple-500">openrouter.ai/keys</a>. Free models do not require credits.
              </p>
            </div>

            {/* Model Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-purple-600" />
                Model Selection (Recommended Free Models)
              </label>
              <select
                value={modelInput}
                onChange={(e) => setModelInput(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {(aiConfig?.popular_models || [
                  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B Instruct (Free)', provider: 'Meta' },
                  { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash (Free)', provider: 'Google' },
                  { id: 'meta-llama/llama-3.1-8b-instruct:free', name: 'Llama 3.1 8B Instruct (Free)', provider: 'Meta' },
                  { id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B Instruct (Free)', provider: 'Mistral' },
                  { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1 Reasoning (Free)', provider: 'DeepSeek' },
                  { id: 'qwen/qwen-2.5-coder-32b-instruct:free', name: 'Qwen 2.5 Coder 32B (Free)', provider: 'Qwen' },
                ]).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
                <option value="custom">-- Custom Model Identifier --</option>
              </select>

              {modelInput === 'custom' && (
                <input
                  type="text"
                  placeholder="e.g. meta-llama/llama-3.3-70b-instruct:free"
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                  className="w-full text-xs px-3 py-2 mt-1.5 rounded-xl border border-border bg-card text-foreground font-mono"
                />
              )}
            </div>
          </div>

          {/* Test Status Feedback */}
          {testResult && (
            <div className={`p-3 rounded-xl text-xs flex items-center justify-between ${testResult.ok ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800'}`}>
              <div className="flex items-center gap-2">
                {testResult.ok ? <CheckCircle2 className="size-4 text-emerald-600" /> : <AlertTriangle className="size-4 text-red-600" />}
                <span>{testResult.message}</span>
              </div>
              {testResult.latencyMs && (
                <span className="font-mono text-[11px] font-bold">
                  Latency: {testResult.latencyMs}ms
                </span>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={testingConnection}
              className="text-xs"
            >
              {testingConnection ? <Loader2 className="size-3.5 animate-spin me-1.5" /> : <Zap className="size-3.5 me-1.5 text-amber-500" />}
              Test Connection
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleSaveConfig}
              disabled={savingConfig}
              className="text-xs bg-purple-600 hover:bg-purple-700 text-white"
            >
              {savingConfig ? <Loader2 className="size-3.5 animate-spin me-1.5" /> : <Check className="size-3.5 me-1.5" />}
              Save Configuration
            </Button>
          </div>
        </div>
      )}

      {/* ── 1. "Ask OIU" Conversational Copilot ─────────────────────── */}
      <div className="border border-purple-200 dark:border-purple-950/60 rounded-2xl bg-gradient-to-b from-purple-50/40 via-card to-card dark:from-purple-950/10 dark:via-card dark:to-card p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-purple-600 animate-pulse" />
            <h2 className="text-base font-bold text-foreground">Ask OIU AI Copilot</h2>
          </div>
          <span className="text-[11px] font-semibold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/40 px-2.5 py-0.5 rounded-full">
            Real-time Sales & Menu Grounding
          </span>
        </div>

        {/* Chat History Box */}
        <div className="space-y-3 max-h-64 overflow-y-auto pe-1">
          {chatHistory.map((msg, idx) => (
            <div
              key={idx}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                  msg.role === 'user'
                    ? 'bg-brand text-white rounded-br-xs'
                    : 'bg-card border border-border text-foreground rounded-bl-xs shadow-xs'
                }`}
              >
                <p className="leading-relaxed">{msg.text}</p>
                {msg.action && (
                  <div className="mt-2.5 pt-2 border-t border-border/60 flex items-center gap-1.5 text-xs text-purple-700 dark:text-purple-300 font-semibold">
                    <Lightbulb className="size-3.5 shrink-0" />
                    <span>Recommended Action: {msg.action}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
          {answering && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground italic py-1">
              <Loader2 className="size-3.5 animate-spin text-purple-600" />
              <span>Analyzing live tenant orders, food costs, and hourly run rates...</span>
            </div>
          )}
        </div>

        {/* Quick Question Chips */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          <span className="text-xs text-muted-foreground me-1 flex items-center gap-1">
            <HelpCircle className="size-3" /> Quick Prompts:
          </span>
          {QUICK_PROMPTS.map((prompt, i) => (
            <button
              key={i}
              onClick={() => handleAsk(prompt)}
              disabled={answering}
              className="text-xs px-2.5 py-1 rounded-full border border-purple-200 dark:border-purple-900 bg-card hover:bg-purple-50 dark:hover:bg-purple-950/40 text-foreground transition-colors disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Ask Input Bar */}
        <div className="flex gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAsk();
            }}
            placeholder="Ask anything (e.g. How can we cut food waste by 15% this weekend?)"
            className="flex-1 px-4 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/30"
          />
          <Button
            onClick={() => handleAsk()}
            disabled={answering || !question.trim()}
            className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl px-5"
          >
            {answering ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>
      </div>

      {/* ── 2. Tomorrow's Smart Prep Forecast ──────────────────────── */}
      <div className="border border-border rounded-2xl bg-card overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-muted/40">
          <div className="flex items-center gap-2">
            <ChefHat className="size-5 text-brand" />
            <div>
              <h2 className="text-base font-bold text-foreground">Tomorrow's Smart Prep Schedule</h2>
              <p className="text-xs text-muted-foreground">
                Predictive batch quantities to prevent 8:00 PM kitchen stockouts and eliminate over-prepping food waste
              </p>
            </div>
          </div>
          {insights?.weekend_boost && (
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 flex items-center gap-1 self-start sm:self-auto">
              <Flame className="size-3.5 fill-amber-600" />
              +35% Weekend Surge Multiplier Applied
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/20 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <th className="py-3 px-4">Item & Batch Base</th>
                <th className="py-3 px-4">Kitchen Station</th>
                <th className="py-3 px-4">Recommended Prep</th>
                <th className="py-3 px-4">AI Confidence</th>
                <th className="py-3 px-4">Urgency</th>
                <th className="py-3 px-4">Rationale</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(insights?.prep_forecast || []).map((p, idx) => (
                <tr key={idx} className="hover:bg-muted/30 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-foreground">{p.item}</td>
                  <td className="py-3.5 px-4 text-xs text-muted-foreground">{p.station}</td>
                  <td className="py-3.5 px-4">
                    <span className="font-extrabold text-brand font-mono text-base">
                      {p.recommended_batches}
                    </span>{' '}
                    <span className="text-xs text-muted-foreground">{p.unit}</span>
                  </td>
                  <td className="py-3.5 px-4 text-xs font-semibold text-emerald-600">
                    {p.confidence}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                        p.urgency === 'CRITICAL'
                          ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                          : p.urgency === 'HIGH'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                      }`}
                    >
                      {p.urgency}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-xs text-muted-foreground max-w-xs">
                    {p.reasoning}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 3. Dynamic Menu Engineering (BCG Matrix) ───────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <PieChart className="size-5 text-blue-600" />
              Menu Engineering & Profit Optimizer (BCG Matrix)
            </h2>
            <p className="text-xs text-muted-foreground">
              Categorizes your menu items by sales volume and profit margin to unlock maximum net profitability
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* STARS */}
          <div className="border border-emerald-200 dark:border-emerald-950/50 bg-emerald-50/30 dark:bg-emerald-950/10 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 font-extrabold text-sm">
                <span>🌟 Stars (High Volume · High Profit)</span>
              </div>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 rounded-full">
                Protect & Feature
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              The engines of your restaurant. Never alter recipes or reduce portions. Prime candidates for website & menu hero banners.
            </p>
            <div className="space-y-2">
              {(insights?.bcg_matrix?.stars || []).map((item, idx) => (
                <div key={idx} className="bg-card border border-border rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-sm text-foreground">{item.name}</div>
                    <div className="text-xs text-muted-foreground">{item.sold} orders · {fmt(item.revenue)}</div>
                  </div>
                  <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 rounded-md">
                    {fmt(item.avg_price)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* PLOWHORSES */}
          <div className="border border-amber-200 dark:border-amber-950/50 bg-amber-50/30 dark:bg-amber-950/10 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-extrabold text-sm">
                <span>🐎 Plowhorses (High Volume · Low Margin)</span>
              </div>
              <span className="text-[11px] font-semibold text-amber-700 bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded-full">
                Price Hike Candidates
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Popular crowd favorites that suffer from rising food costs. Guests have high loyalty and tolerate a +₹15 to +₹20 price hike.
            </p>
            <div className="space-y-2">
              {(insights?.bcg_matrix?.plowhorses || []).map((item, idx) => (
                <div key={idx} className="bg-card border border-border rounded-xl p-3 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-sm text-foreground">{item.name}</div>
                    <span className="text-xs font-bold text-amber-700">{fmt(item.avg_price)}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">{item.advice}</div>
                </div>
              ))}
            </div>
          </div>

          {/* PUZZLES */}
          <div className="border border-blue-200 dark:border-blue-950/50 bg-blue-50/30 dark:bg-blue-950/10 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-blue-800 dark:text-blue-300 font-extrabold text-sm">
                <span>🧩 Puzzles (Low Volume · High Profit)</span>
              </div>
              <span className="text-[11px] font-semibold text-blue-700 bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 rounded-full">
                Promote & Upsell
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Highly lucrative items that customers overlook. Have servers actively recommend them or pair them as combo add-ons.
            </p>
            <div className="space-y-2">
              {(insights?.bcg_matrix?.puzzles || []).map((item, idx) => (
                <div key={idx} className="bg-card border border-border rounded-xl p-3 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-sm text-foreground">{item.name}</div>
                    <span className="text-xs font-bold text-blue-700">{fmt(item.avg_price)}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">{item.advice}</div>
                </div>
              ))}
            </div>
          </div>

          {/* DOGS */}
          <div className="border border-red-200 dark:border-red-950/50 bg-red-50/30 dark:bg-red-950/10 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-red-800 dark:text-red-300 font-extrabold text-sm">
                <span>🐕 Dogs (Low Volume · Low Profit)</span>
              </div>
              <span className="text-[11px] font-semibold text-red-700 bg-red-100 dark:bg-red-900/40 px-2 py-0.5 rounded-full">
                Retire or Re-engineer
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Dishes occupying kitchen mise-en-place and inventory capital without contributing to profit. Replace with seasonal specials.
            </p>
            <div className="space-y-2">
              {(insights?.bcg_matrix?.dogs || []).map((item, idx) => (
                <div key={idx} className="bg-card border border-border rounded-xl p-3 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-sm text-foreground">{item.name}</div>
                    <span className="text-xs font-bold text-red-700">{fmt(item.avg_price)}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">{item.advice}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. Kitchen Bottleneck Detective ─────────────────────────── */}
      <div className="border border-border rounded-2xl bg-card p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="size-5 text-orange-500" />
            <h2 className="text-base font-bold text-foreground">Kitchen Bottleneck Detective</h2>
          </div>
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300">
            Avg Turnaround: {insights?.kitchen_metrics?.avg_turnaround_mins || 16.4} mins
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl border border-border bg-muted/30">
            <span className="text-xs text-muted-foreground">Peak Delay Station</span>
            <div className="text-base font-black text-foreground mt-1">
              {insights?.kitchen_metrics?.peak_delay_station || 'Tandoor & Clay Oven'}
            </div>
          </div>
          <div className="p-3.5 rounded-xl border border-border bg-muted/30">
            <span className="text-xs text-muted-foreground">Highest Latency Item</span>
            <div className="text-base font-black text-foreground mt-1">
              {insights?.kitchen_metrics?.peak_delay_item || 'Tandoori Chicken Platter'}
            </div>
          </div>
          <div className="p-3.5 rounded-xl border border-border bg-muted/30">
            <span className="text-xs text-muted-foreground">Bottleneck Severity</span>
            <div className="text-base font-black text-amber-600 mt-1">
              {insights?.kitchen_metrics?.bottleneck_risk || 'MODERATE'}
            </div>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900 flex items-start gap-2.5 text-xs text-purple-900 dark:text-purple-200">
          <Lightbulb className="size-4 shrink-0 text-purple-600 mt-0.5" />
          <div>
            <span className="font-bold">AI Mitigation Advice: </span>
            {insights?.kitchen_metrics?.mitigation_tip || 'Pre-roast tandoori meats to 70% par-cooked stage at 6:30 PM before dinner peak.'}
          </div>
        </div>
      </div>
    </div>
  );
}
