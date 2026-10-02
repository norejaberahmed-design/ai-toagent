import React from 'react';
import { CompanyTrendStatus } from '../services/executiveSnapshotService';

interface CompanyStatusProps {
  trendStatuses: CompanyTrendStatus[];
  companyName: string;
}

export const CompanyStatus: React.FC<CompanyStatusProps> = ({ trendStatuses, companyName }) => {
  return (
    <section className="bg-white rounded-xl border border-neutral-200/90 p-5 sm:p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between pb-4 border-b border-neutral-100 gap-2">
        <div>
          <h2 className="text-lg font-bold text-neutral-900 tracking-tight">
            صورة الشركة الآن
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            الاتجاهات الفعلية المشتقة من سجلات {companyName} دون أحكام مسبقة أو درجات تقديرية
          </p>
        </div>
        <div className="text-xs text-neutral-400 font-medium">
          اتجاهات قائمة على القياس المحاسبي الحتمي
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 sm:gap-4 mt-5">
        {trendStatuses.map((item) => {
          let symbolColor = 'text-neutral-500';
          let bgTone = 'bg-neutral-50/70 border-neutral-200/70';

          if (item.trend === 'rising') {
            if (item.category === 'expenses') {
              symbolColor = 'text-amber-700';
              bgTone = 'bg-amber-50/40 border-amber-200/50';
            } else {
              symbolColor = 'text-emerald-700';
              bgTone = 'bg-emerald-50/30 border-emerald-200/40';
            }
          } else if (item.trend === 'falling') {
            if (item.category === 'expenses') {
              symbolColor = 'text-emerald-700';
              bgTone = 'bg-emerald-50/30 border-emerald-200/40';
            } else {
              symbolColor = 'text-amber-700';
              bgTone = 'bg-amber-50/40 border-amber-200/50';
            }
          } else if (item.trend === 'sharp_fall') {
            symbolColor = 'text-rose-700 font-extrabold';
            bgTone = 'bg-rose-50/40 border-rose-200/60';
          } else if (item.trend === 'stable') {
            symbolColor = 'text-neutral-700';
            bgTone = 'bg-neutral-50 border-neutral-200/70';
          }

          return (
            <div
              key={item.category}
              className={`rounded-lg border p-3.5 flex flex-col justify-between transition-all ${bgTone}`}
            >
              <div>
                <span className="text-xs font-semibold text-neutral-500 block">
                  {item.labelAr}
                </span>
                <div className="flex items-baseline justify-between mt-2">
                  <span
                    className={`text-2xl font-bold tracking-tight font-mono ${symbolColor}`}
                  >
                    {item.trendSymbol}
                  </span>
                  <span className="text-2xs text-neutral-400 font-medium">
                    {item.trend === 'sharp_fall'
                      ? 'تراجع حاد'
                      : item.trend === 'falling'
                      ? 'تراجع'
                      : item.trend === 'rising'
                      ? 'نمو/صعود'
                      : item.trend === 'stable'
                      ? 'مستقر'
                      : 'غير متوفر'}
                  </span>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-neutral-200/40 text-2xs text-neutral-600 leading-snug">
                {item.summaryAr}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
