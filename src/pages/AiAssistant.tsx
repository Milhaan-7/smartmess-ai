import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Trash2, HelpCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { Button } from '../components/common/Button';
import { api } from '../services/apiClient';
import { useAppStore } from '../store/AppStore';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  model?: string;
}

const SUGGESTED_PROMPTS = [
  'How much food was wasted in the last 30 days?',
  'Which dishes had the most leftovers?',
  "Compare this month's recorded waste with last month.",
  'How has lunch attendance changed over time?',
  'Which meals consistently have excess preparation?',
  'Summarize recent demand trends.',
  'What practical steps could reduce leftovers?',
  'Show me the current approved preparation targets.',
];

export default function AiAssistant() {
  const { currentUser } = useAppStore();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'msg-welcome',
      role: 'assistant',
      content: `Hello ${currentUser?.name || 'Manager'}! I am your SmartMess AI Assistant, grounded in your institution's operational records, menus, and waste analytics. How can I help you optimize dining hall preparation or reduce waste today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      model: 'smartmess-ai',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (textToSend?: string) => {
    const promptText = textToSend || input;
    if (!promptText.trim() || loading) return;

    const userMsg: Message = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: promptText.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setLoading(true);
    setError(null);

    try {
      const historyPayload = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await api.sendChatMessage(promptText.trim(), historyPayload);

      const assistantMsg: Message = {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant',
        content: res.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: res.model,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error('[AI Assistant] Chat error:', err);
      setError(err?.message || 'Failed to communicate with AI Assistant service');
      
      const errorMsg: Message = {
        id: `msg-${Date.now()}-error`,
        role: 'assistant',
        content: `I encountered an error connecting to the backend intelligence service: ${err?.message || 'Network error'}. Please try your question again or choose a suggested prompt.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: 'system-error',
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: 'msg-welcome',
        role: 'assistant',
        content: `Conversation reset. I am ready to answer your questions about meal demand, preparation plans, and waste analytics.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: 'smartmess-ai',
      },
    ]);
    setError(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Assistant"
        description="Conversational operational intelligence for demand forecasting, kitchen preparation, and waste reduction."
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Chat Window */}
        <div className="lg:col-span-3 rounded-2xl border border-slate-200 bg-white shadow-xs flex flex-col h-[650px]">
          {/* Chat Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/70 rounded-t-2xl">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white shadow-xs">
                <Sparkles size={20} aria-hidden />
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  SmartMess AI Copilot
                  <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-800">
                    Active Session
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Authorized access for: <strong className="capitalize">{currentUser?.role || 'Manager'}</strong> ({currentUser?.name})
                </p>
              </div>
            </div>

            <Button variant="secondary" size="sm" onClick={handleClearChat} className="text-xs text-slate-600 gap-1.5">
              <Trash2 size={13} />
              <span>Clear Chat</span>
            </Button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/30">
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div key={msg.id} className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white shadow-xs ${
                      isUser ? 'bg-slate-700' : 'bg-brand-600'
                    }`}
                  >
                    {isUser ? <User size={15} /> : <Bot size={15} />}
                  </span>

                  <div className={`max-w-[80%] space-y-1 ${isUser ? 'text-right' : 'text-left'}`}>
                    <div
                      className={`rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-xs ${
                        isUser
                          ? 'bg-brand-600 text-white rounded-tr-none'
                          : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
                      }`}
                    >
                      {msg.content}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 px-1">
                      <span>{msg.timestamp}</span>
                      {msg.model && <span>• {msg.model}</span>}
                    </div>
                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white shadow-xs">
                  <Bot size={15} />
                </span>
                <div className="rounded-2xl rounded-tl-none bg-white border border-slate-200 px-4 py-3 text-xs text-slate-500 flex items-center gap-2 shadow-xs">
                  <RefreshCw size={14} className="animate-spin text-brand-600" />
                  <span>Analyzing institutional data & generating response...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {error && (
            <div className="mx-6 mb-2 rounded-xl bg-amber-50 p-3 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
              <AlertCircle size={15} className="text-amber-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Input Bar */}
          <div className="border-t border-slate-100 p-4 bg-white rounded-b-2xl">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSend();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about food waste, leftovers, attendance, or prep targets..."
                disabled={loading}
                className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-hidden disabled:bg-slate-50"
              />
              <Button type="submit" disabled={loading || !input.trim()} className="gap-1.5 px-4 py-2.5 text-xs">
                <span>Send</span>
                <Send size={13} />
              </Button>
            </form>
          </div>
        </div>

        {/* Suggested Prompts Sidebar */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <HelpCircle size={18} className="text-brand-600" />
            <h4 className="text-sm font-bold text-slate-900">Suggested Questions</h4>
          </div>

          <p className="text-xs text-slate-500">
            Click any prompt below to query the assistant instantly:
          </p>

          <div className="space-y-2">
            {SUGGESTED_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => void handleSend(prompt)}
                disabled={loading}
                className="w-full text-left rounded-xl border border-slate-200/80 bg-slate-50/60 p-2.5 text-xs font-medium text-slate-700 hover:bg-brand-50 hover:border-brand-200 hover:text-brand-900 transition-colors disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>

          <div className="rounded-xl bg-brand-50/70 p-3 border border-brand-100 text-[11px] text-brand-900 space-y-1">
            <div className="font-semibold flex items-center gap-1.5">
              <Sparkles size={13} className="text-brand-700" />
              <span>Data-Aware Intelligence</span>
            </div>
            <p className="text-brand-800 leading-relaxed">
              Calculations are computed safely in application code and grounded in actual retrieved records and settings.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
