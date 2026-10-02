import React from 'react';
import { Database, CheckCircle2, Clock, Upload, ShieldCheck, FileSpreadsheet } from 'lucide-react';

interface CompanySourcesProps {
  sourceDisplayName: string;
  lastReadTimestamp: string;
  isComplete: boolean;
  onUploadFile: (file: File) => void;
  onLoadVerifiedPos: () => void;
  onLoadNoCostTest: () => void;
  isAnalyzing: boolean;
}

export const CompanySources: React.FC<CompanySourcesProps> = ({
  sourceDisplayName,
  lastReadTimestamp,
  isComplete,
  onUploadFile,
  onLoadVerifiedPos,
  onLoadNoCostTest,
  isAnalyzing,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const activeSources = [
    {
      name: 'سجلات المبيعات ونقاط البيع (POS)',
      type: 'قاعدة بيانات عملياتية',
      status: 'نشط',
      lastRead: lastReadTimestamp,
      completeness: 'مكتملة ومطابقة',
      hasErrors: false,
    },
    {
      name: 'سجلات المنتجات والأسعار',
      type: 'دليل الأصناف والتكلفة',
      status: 'نشط',
      lastRead: lastReadTimestamp,
      completeness: isComplete ? 'مكتملة مع أسعار التكلفة' : 'ناقصة (غياب التكلفة في بعض البنود)',
      hasErrors: !isComplete,
    },
    {
      name: 'سجلات التحصيل والمدفوعات',
      type: 'دفتر النقدية والمصارف',
      status: 'نشط',
      lastRead: lastReadTimestamp,
      completeness: 'مكتملة',
      hasErrors: false,
    },
    {
      name: 'سجلات المصروفات اليومية',
      type: 'قيود التشغيل',
      status: 'نشط',
      lastRead: lastReadTimestamp,
      completeness: 'مكتملة جزئياً',
      hasErrors: false,
    },
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUploadFile(e.target.files[0]);
    }
  };

  return (
    <section className="bg-white rounded-xl border border-neutral-200/90 p-5 sm:p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between pb-4 border-b border-neutral-100 gap-2">
        <div>
          <h2 className="text-lg font-bold text-neutral-900 tracking-tight flex items-center gap-2">
            <span>مصادر الشركة (Active Sources)</span>
            <span className="text-2xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
              قراءة مؤكدة فقط
            </span>
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            الأنظمة والملفات المتصلة التي يستند إليها المستشار لاستخراج صورة الشركة
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".db,.sqlite,.sqlite3,.xlsx,.xls,.csv"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isAnalyzing}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-800 bg-white hover:bg-neutral-50 border border-neutral-300 rounded-md px-3 py-1.5 shadow-sm transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-neutral-600" />
            <span>رفع ملف شركة (SQLite / Excel / CSV)</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
        {activeSources.map((source, idx) => (
          <div
            key={idx}
            className="rounded-lg border border-neutral-200/80 p-3.5 bg-neutral-50/20 flex flex-col justify-between text-xs"
          >
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-2xs text-neutral-400 font-medium">
                  {source.type}
                </span>
                <span className="inline-flex items-center gap-1 text-2xs text-emerald-700 font-semibold">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>{source.status}</span>
                </span>
              </div>
              <h3 className="font-bold text-neutral-900 text-xs">
                {source.name}
              </h3>
            </div>

            <div className="mt-3 pt-2.5 border-t border-neutral-200/50 text-2xs space-y-1">
              <div className="flex justify-between text-neutral-500">
                <span>آخر قراءة:</span>
                <span className="font-mono text-neutral-700">{source.lastRead}</span>
              </div>
              <div className="flex justify-between text-neutral-500">
                <span>اكتمال البيانات:</span>
                <span className={source.hasErrors ? 'text-amber-700 font-medium' : 'text-neutral-700'}>
                  {source.completeness}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Dataset quick switchers for inspection */}
      <div className="mt-5 pt-4 border-t border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-neutral-50/50 p-3 rounded-lg border border-neutral-200/50">
        <span className="text-neutral-600">
          المصدر الأساسي المحمل حالياً: <strong className="text-neutral-900 font-mono">{sourceDisplayName}</strong>
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={onLoadVerifiedPos}
            disabled={isAnalyzing}
            className="text-2xs font-semibold px-2.5 py-1 rounded bg-white hover:bg-neutral-100 border border-neutral-200 text-neutral-800 transition-colors cursor-pointer"
          >
            قاعدة نقاط بيع نموذجية مكتملة
          </button>
          <button
            onClick={onLoadNoCostTest}
            disabled={isAnalyzing}
            className="text-2xs font-semibold px-2.5 py-1 rounded bg-white hover:bg-neutral-100 border border-neutral-200 text-neutral-800 transition-colors cursor-pointer"
          >
            تجربة فحص قاعدة (بدون بيانات تكلفة)
          </button>
        </div>
      </div>
    </section>
  );
};
