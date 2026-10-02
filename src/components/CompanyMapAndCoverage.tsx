import React from 'react';
import { Check, AlertTriangle, X, ShieldAlert, EyeOff } from 'lucide-react';
import { ConceptCoverageStatus } from '../services/executiveSnapshotService';

interface CompanyMapAndCoverageProps {
  coverageList: ConceptCoverageStatus[];
  unknowns: string[];
}

export const CompanyMapAndCoverage: React.FC<CompanyMapAndCoverageProps> = ({
  coverageList,
  unknowns,
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* 1. خريطة الشركة وتغطية البيانات (2 cols) */}
      <section className="lg:col-span-2 bg-white rounded-xl border border-neutral-200/90 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
        <div>
          <div className="pb-4 border-b border-neutral-100">
            <h2 className="text-lg font-bold text-neutral-900 tracking-tight">
              خريطة الشركة وتغطية البيانات (Company Coverage)
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              ما الذي يستطيع المستشار رؤيته والتحقق منه في مصادر الشركة الحالية
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
            {coverageList.map((item) => {
              let icon = <Check className="w-3.5 h-3.5 text-emerald-700" />;
              let statusLabel = 'مكتملة';
              let badgeStyle = 'text-emerald-800 bg-emerald-50/70 border-emerald-200/70';

              if (item.status === 'partial') {
                icon = <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />;
                statusLabel = 'مكتملة جزئياً';
                badgeStyle = 'text-amber-800 bg-amber-50/70 border-amber-200/70';
              } else if (item.status === 'unavailable') {
                icon = <X className="w-3.5 h-3.5 text-neutral-400" />;
                statusLabel = 'غير متوفرة';
                badgeStyle = 'text-neutral-500 bg-neutral-100 border-neutral-200/60';
              }

              return (
                <div
                  key={item.concept}
                  className="rounded-lg border border-neutral-200/70 p-3 bg-neutral-50/20 flex flex-col justify-between text-xs"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-neutral-900">
                      {item.labelAr}
                    </span>
                    <span className={`inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded border ${badgeStyle}`}>
                      {icon}
                      <span>{statusLabel}</span>
                    </span>
                  </div>
                  <p className="text-2xs text-neutral-500 mt-1 leading-snug">
                    {item.detailsAr}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-5 pt-3 border-t border-neutral-100 text-2xs text-neutral-400">
          * لا يتم إظهار أي نسبة مئوية إجمالية مصطنعة؛ التغطية تعكس الحالة الفردية لكل مفهوم تجاري.
        </div>
      </section>

      {/* 2. ما لا نعرفه — حدود الرؤية الحالية (1 col) */}
      <section className="bg-white rounded-xl border border-neutral-200/90 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
        <div>
          <div className="pb-4 border-b border-neutral-100 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-neutral-900 tracking-tight flex items-center gap-1.5">
                <span>ما لا نعرفه</span>
                <span className="text-2xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                  حدود الرؤية
                </span>
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                حدود البيانات الحالية وما لا يستطيع المستشار إثباته
              </p>
            </div>
            <EyeOff className="w-5 h-5 text-neutral-400" />
          </div>

          <div className="space-y-3 mt-5">
            {unknowns.map((msg, index) => (
              <div
                key={index}
                className="rounded-lg border border-amber-200/70 bg-amber-50/30 p-3 text-xs text-neutral-700 flex items-start gap-2.5"
              >
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{msg}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 pt-3 border-t border-neutral-100 text-2xs text-neutral-500 leading-relaxed bg-neutral-50 p-2.5 rounded border border-neutral-200/60">
          <span className="font-semibold block text-neutral-700 mb-0.5">مبدأ الأمانة المحاسبية:</span>
          النظام لا يملأ الفراغات بالتخمين ولا يبتكر بيانات مفقودة؛ عندما تغيب البيانات يتم الإقرار بحدود الرؤية بوضوح تام.
        </div>
      </section>

    </div>
  );
};
