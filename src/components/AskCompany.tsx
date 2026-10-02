import React, { useState } from 'react';
import { HelpCircle, Search, Sparkles, CheckCircle2, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import { AdvisorAnswer } from '../services/advisorEngine';

interface AskCompanyProps {
  onAsk: (question: string) => AdvisorAnswer | null;
  suggestedQuestions: string[];
}

export const AskCompany: React.FC<AskCompanyProps> = ({ onAsk, suggestedQuestions }) => {
  const [selectedQuestion, setSelectedQuestion] = useState<string>('');
  const [currentAnswer, setCurrentAnswer] = useState<AdvisorAnswer | null>(null);
  const [customInput, setCustomInput] = useState<string>('');
  const [isEvidenceOpen, setIsEvidenceOpen] = useState(false);

  const handleSelectQuestion = (q: string) => {
    setSelectedQuestion(q);
    setCustomInput(q);
    const ans = onAsk(q);
    setCurrentAnswer(ans);
    setIsEvidenceOpen(false);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim()) return;
    setSelectedQuestion(customInput);
    const ans = onAsk(customInput);
    setCurrentAnswer(ans);
    setIsEvidenceOpen(false);
  };

  return (
    <section className="bg-white rounded-xl border border-neutral-200/90 p-5 sm:p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between pb-4 border-b border-neutral-100 gap-2">
        <div>
          <h2 className="text-lg font-bold text-neutral-900 tracking-tight">
            اسأل شركتك (Ask Your Company)
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            استفسر عن صورة شركتك واحصل على إجابة قاطعة مدعومة بالأدلة والمحاسبة الصارمة دون هلوسة
          </p>
        </div>
        <span className="text-xs text-neutral-400 font-medium">
          إجابات حتمية مستندة إلى البيانات الفعلية
        </span>
      </div>

      {/* Suggested Questions */}
      <div className="mt-4">
        <span className="text-2xs font-semibold text-neutral-500 block mb-2">
          تساؤلات تنفيذية شائعة:
        </span>
        <div className="flex flex-wrap gap-2">
          {suggestedQuestions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSelectQuestion(q)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-all text-right cursor-pointer ${
                selectedQuestion === q
                  ? 'bg-neutral-900 border-neutral-900 text-white font-medium shadow-xs'
                  : 'bg-neutral-50 hover:bg-neutral-100 border-neutral-200 text-neutral-700'
              }`}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Question Form */}
      <form onSubmit={handleCustomSubmit} className="mt-4 flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder="اكتب استفسارك عن مبيعاتك، أرباحك، تحصيلاتك، أو مخزونك..."
            className="w-full text-xs bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 focus:bg-white transition-all"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
        >
          اسأل المستشار
        </button>
      </form>

      {/* Answer Display */}
      {currentAnswer && (
        <div className="mt-5 p-4 rounded-xl border border-neutral-200 bg-neutral-50/70 space-y-3 animate-in fade-in duration-200">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-2xs font-bold text-neutral-500 block mb-1">
                إجابة المستشار عن: «{selectedQuestion}»
              </span>
              <p className="text-sm font-bold text-neutral-900 leading-snug">
                {currentAnswer.summary}
              </p>
            </div>
            {currentAnswer.isSupported && (
              <span className="text-2xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-semibold shrink-0">
                مؤكد بأدلة محاسبية
              </span>
            )}
          </div>

          <p className="text-xs text-neutral-700 leading-relaxed bg-white p-3 rounded-lg border border-neutral-200/60">
            {currentAnswer.answerText}
          </p>

          {currentAnswer.details && currentAnswer.details.length > 0 && (
            <div className="space-y-1 bg-white p-3 rounded-lg border border-neutral-200/60">
              <span className="text-2xs font-bold text-neutral-500 block mb-1">تفاصيل إضافية مثبتة:</span>
              {currentAnswer.details.map((detail, idx) => (
                <div key={idx} className="text-2xs text-neutral-600 flex items-center gap-1.5">
                  <span className="text-neutral-400">•</span>
                  <span>{detail}</span>
                </div>
              ))}
            </div>
          )}

          {currentAnswer.evidence && currentAnswer.evidence.length > 0 && (
            <div className="pt-2">
              <button
                onClick={() => setIsEvidenceOpen(!isEvidenceOpen)}
                className="inline-flex items-center gap-1.5 text-2xs font-semibold text-neutral-700 hover:text-neutral-900 transition-colors cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{isEvidenceOpen ? 'إخفاء دليل الإجابة' : 'عرض الأدلة المحاسبية للإجابة'}</span>
                {isEvidenceOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              {isEvidenceOpen && (
                <div className="mt-2 space-y-1.5 p-3 bg-white rounded-lg border border-neutral-200 text-2xs">
                  {currentAnswer.evidence.map((ev, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-neutral-600">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{ev}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
