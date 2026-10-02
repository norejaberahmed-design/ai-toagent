import React from 'react';
import { CheckCircle2, Loader2, ShieldCheck, X } from 'lucide-react';

export interface AnalysisStage {
  id: string;
  labelAr: string;
  status: 'done' | 'running' | 'pending';
  detail?: string;
}

interface AnalysisJourneyModalProps {
  isOpen: boolean;
  stages: AnalysisStage[];
  onClose?: () => void;
  isComplete: boolean;
}

export const AnalysisJourneyModal: React.FC<AnalysisJourneyModalProps> = ({
  isOpen,
  stages,
  onClose,
  isComplete,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-neutral-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-neutral-200 overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-neutral-900 text-white flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-neutral-900">
                المستشار يعمل
              </h2>
              <p className="text-2xs text-neutral-500">
                فحص البيانات وبناء صورة الشركة الحتمية
              </p>
            </div>
          </div>
          {isComplete && onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Stages List */}
        <div className="p-5 space-y-3">
          {stages.map((stage) => (
            <div
              key={stage.id}
              className="flex items-start gap-3 text-xs"
            >
              <div className="mt-0.5 shrink-0">
                {stage.status === 'done' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : stage.status === 'running' ? (
                  <Loader2 className="w-4 h-4 text-neutral-900 animate-spin" />
                ) : (
                  <div className="w-4 h-4 rounded-full border border-neutral-300" />
                )}
              </div>
              <div className="flex-1">
                <span
                  className={`font-semibold ${
                    stage.status === 'done'
                      ? 'text-neutral-900'
                      : stage.status === 'running'
                      ? 'text-neutral-900 font-bold'
                      : 'text-neutral-400'
                  }`}
                >
                  {stage.labelAr}
                </span>
                {stage.detail && (
                  <p className="text-2xs text-neutral-500 mt-0.5">{stage.detail}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-100 bg-neutral-50/50 flex items-center justify-between text-2xs">
          <span className="text-neutral-400">
            {isComplete ? 'اكتمل بناء صورة الشركة بنجاح' : 'جارٍ التدقيق الحسابي...'}
          </span>
          {isComplete && onClose && (
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white font-medium rounded-md transition-colors cursor-pointer"
            >
              عرض صورة الشركة
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
