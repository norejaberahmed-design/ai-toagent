import React, { useState, useRef, useMemo } from 'react';
import {
  Building2,
  Search,
  ShieldCheck,
  Database,
  BarChart3,
  FileText,
  Bell,
  Settings as SettingsIcon,
  X,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Info,
  Upload,
  Lock,
  RefreshCw,
  TrendingUp,
  Package,
  Users,
  AlertTriangle,
  FileCheck,
  Check,
  Layers,
  TrendingDown,
  Lightbulb,
  ExternalLink,
  Eye,
  Filter,
  Activity,
} from 'lucide-react';

import {
  SQLiteCompanySource,
  createVerifiedPosTestDatabase,
  createNoCostTestDatabase,
  VerificationStep,
} from './services/sqliteEngine';
import { discoverBusinessData, DataDiscoveryResult } from './services/discoveryEngine';
import { calculateDeterministicMetrics, CompanyMetrics, MetricProvenance } from './services/metricsEngine';
import { queryCompanyAdvisor, AdvisorAnswer } from './services/advisorEngine';

import { CONNECTOR_CATALOG, getConnectorsByCategory } from './connectors/registry';
import { ConnectorMetadata, SourceCategory } from './connectors/types';
import { ExcelConnector, CSVConnector } from './connectors/fileConnectors';
import { PostgreSQLConnector, MySQLConnector } from './connectors/sqlDatabaseConnectors';
import { mapTablesToBusinessConcepts } from './connectors/semanticMapper';
import { buildUnifiedDataset, calculateMetricsFromUnified } from './connectors/unifiedModel';
import { EvidenceDrawer, EvidenceDrawerItem } from './components/EvidenceDrawer';
import { UniversalConnectModal } from './components/UniversalConnectModal';
import { PipelineExecutionResult } from './connectors/universal/universalPipeline';
import { DeveloperAuditModal } from './components/DeveloperAuditModal';
import { executeDiagnosticAnalysis } from './diagnostics/analyzer';
import { DeveloperDiagnosticReport, UserReliabilityStatus } from './diagnostics/types';

interface CompanySettings {
  companyName: string;
  currency: string;
  industry: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'analysis' | 'reports' | 'alerts' | 'source'>('home');
  const [analysisSubTab, setAnalysisSubTab] = useState<'sales' | 'profit' | 'costs' | 'customers' | 'inventory'>('sales');

  const [queryInput, setQueryInput] = useState('');
  const [advisorAnswer, setAdvisorAnswer] = useState<AdvisorAnswer | null>(null);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);

  // Active Connection states
  const [activeSourceName, setActiveSourceName] = useState<string>('');
  const [activeSourceType, setActiveSourceType] = useState<string>('');
  const [lastReadTimestamp, setLastReadTimestamp] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const [discovery, setDiscovery] = useState<DataDiscoveryResult | null>(null);
  const [metrics, setMetrics] = useState<CompanyMetrics | null>(null);

  // SQLite Engine reference
  const [sqliteEngine] = useState(() => new SQLiteCompanySource());

  // Evidence Drawer state
  const [evidenceDrawerData, setEvidenceDrawerData] = useState<EvidenceDrawerItem | null>(null);
  const [isEvidenceDrawerOpen, setIsEvidenceDrawerOpen] = useState(false);

  // Modals & wizards
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isDeveloperAuditModalOpen, setIsDeveloperAuditModalOpen] = useState(false);
  const [latestDiagnosticReport, setLatestDiagnosticReport] = useState<DeveloperDiagnosticReport | null>(null);
  const [currentReliabilityStatus, setCurrentReliabilityStatus] = useState<UserReliabilityStatus | null>(null);
  const [selectedConnector, setSelectedConnector] = useState<ConnectorMetadata | null>(null);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<SourceCategory | 'all'>('all');
  const [sourceSearchTerm, setSourceSearchTerm] = useState('');

  // Reports Filter & Search
  const [reportSearchTerm, setReportSearchTerm] = useState('');
  const [reportStatusFilter, setReportStatusFilter] = useState<'all' | 'VALIDATED' | 'WITHHELD'>('all');

  const [verificationSteps, setVerificationSteps] = useState<VerificationStep[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  // Database Connection Form State
  const [dbForm, setDbForm] = useState({
    host: 'localhost',
    port: '5432',
    database: '',
    user: '',
    password: '',
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [currentFileFormat, setCurrentFileFormat] = useState<string>('.db,.sqlite,.sqlite3,.xlsx,.xls,.csv');

  const [companySettings, setCompanySettings] = useState<CompanySettings>({
    companyName: 'مؤسسة الأفق للتجارة والتقنية',
    currency: 'ريال',
    industry: 'تجارة تجزئة وخدمات أعمال',
  });

  // Executive suggested questions
  const executiveQuestions = [
    'ما وضع أرباحي؟',
    'أين ترتفع التكاليف؟',
    'ما المنتجات الأعلى مبيعًا؟',
    'هل توجد منتجات مبيعاتها مرتفعة لكن ربحيتها منخفضة؟',
    'ما المبالغ التي لم يتم تحصيلها؟',
    'ما أهم شيء يحتاج إلى انتباهي الآن؟',
  ];

  // Helper to format timestamps
  const getCurrentFormattedTime = () => {
    return new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) + ' اليوم';
  };

  // Helper to open Evidence Drawer for a specific metric
  const openMetricEvidence = (
    metricKey: string,
    metricLabel: string,
    value: string | number | null | undefined,
    isComplete: boolean = true,
    statusMessage?: string
  ) => {
    const matchedProvenance = metrics?.provenanceRecords?.find((p) => p.metricKey === metricKey);

    setEvidenceDrawerData({
      title: `إثبات ${metricLabel}`,
      metricLabel,
      value: value ?? null,
      currency: companySettings.currency,
      period: 'الفترة المسجلة في المصدر المعتمد',
      source: activeSourceName || 'سجلات الشركة الرسمية',
      readTime: lastReadTimestamp || 'عند الفحص الأخير',
      isComplete,
      statusMessage: statusMessage || (isComplete ? 'مثبت ومحقق من واقع السجلات' : 'بيانات جزئية غير كافية للإثبات الكامل'),
      advancedDetails: matchedProvenance
        ? {
            auditId: matchedProvenance.provenanceId,
            sqlQuery: matchedProvenance.sqlQuery,
            sourceTable: matchedProvenance.sourceTable,
          }
        : undefined,
    });
    setIsEvidenceDrawerOpen(true);
  };

  // Helper to open Evidence Drawer for an Advisor Answer
  const openAdvisorEvidence = (answer: AdvisorAnswer) => {
    setEvidenceDrawerData({
      title: 'إثبات إجابة المستشار التنفيذي',
      metricLabel: 'المستشار التنفيذي',
      value: answer.summary,
      currency: '',
      period: 'الفترة الحالية',
      source: activeSourceName || 'سجلات الشركة الرسمية',
      readTime: lastReadTimestamp || 'عند الفحص الأخير',
      isComplete: answer.isSupported,
      statusMessage: answer.isSupported ? 'إجابة مثبتة ومحققة من واقع السجلات' : 'تنبيه: البيانات المتاحة لا تكفي للإثبات',
      evidenceItems: answer.evidence,
      advancedDetails: answer.provenanceId
        ? {
            auditId: answer.provenanceId,
            sqlQuery: 'استعلام مطابق للقراءة فقط من قاعدة البيانات المعتمدة',
          }
        : undefined,
    });
    setIsEvidenceDrawerOpen(true);
  };

  // ================= 1. CONNECT SQLITE =================
  const handleConnectSQLiteBuffer = async (buffer: Uint8Array, fileName: string) => {
    setIsVerifying(true);
    setVerificationError(null);
    setVerificationSteps([]);

    const stepsMap: Record<string, VerificationStep> = {};

    try {
      await sqliteEngine.connect(buffer, fileName, (step) => {
        stepsMap[step.id] = step;
        setVerificationSteps(Object.values(stepsMap));
      });

      const disc = discoverBusinessData(sqliteEngine);
      setDiscovery(disc);

      const met = calculateDeterministicMetrics(sqliteEngine, disc);
      setMetrics(met);

      const time = getCurrentFormattedTime();
      setActiveSourceName(fileName);
      setActiveSourceType('قاعدة بيانات معتمدة (SQLite)');
      setLastReadTimestamp(time);
      setIsConnected(true);
      setIsVerifying(false);
      setIsConnectModalOpen(false);

      setAdvisorAnswer({
        summary: `تم التحقق بنجاح من بيانات (${fileName}) بصيغة القراءة فقط.`,
        answerText: `تم فحص وتدقيق سجلات الشركة بنجاح. أصبحت مؤشرات المبيعات والتكاليف والمخزون محدثة ومستخرجة مباشرة من واقع سجلاتك الرسمية.`,
        details: [
          `مصدر البيانات: ${fileName} (محصن 100% ضد التعديل)`,
          `إجمالي السجلات المفحوصة: ${Object.values(disc.recordCounts).reduce((a, b) => a + b, 0)} سجل معتمد`,
          `حالة الأرباح: ${disc.capabilities.profitExplanation || 'معتمدة'}`,
        ],
        evidence: [
          `مصدر موثوق ومقفل للقراءة فقط`,
          `إجمالي السجلات: ${Object.values(disc.recordCounts).reduce((a, b) => a + b, 0)} سجل`,
        ],
        isSupported: true,
        category: 'alerts',
      });
    } catch (err: any) {
      setIsVerifying(false);
      setVerificationError(err.message || 'حدث خطأ أثناء فحص ملف قاعدة البيانات.');
      setIsConnected(false);
    }
  };

  // ================= 2. CONNECT EXCEL WORKBOOK =================
  const handleConnectExcelBuffer = async (buffer: Uint8Array, fileName: string) => {
    setIsVerifying(true);
    setVerificationError(null);

    try {
      const connector = new ExcelConnector();
      const res = await connector.connect({
        sourceId: 'excel_file',
        sourceType: 'file',
        fileBuffer: buffer,
        fileName,
      });

      if (!res.success) {
        throw new Error(res.message);
      }

      const schema = await connector.discoverSchema();
      const tablesData: Record<string, Record<string, any>[]> = {};

      for (const t of schema.tables) {
        const batch = await connector.extractTableData(t.name);
        tablesData[t.name] = batch.rows;
      }

      const conceptMappings = mapTablesToBusinessConcepts(schema.tables.map((t) => t.name));
      const dataset = buildUnifiedDataset(tablesData, conceptMappings);
      const unifiedMetrics = calculateMetricsFromUnified(dataset, fileName);

      setMetrics(unifiedMetrics);
      setDiscovery({
        tablesFound: schema.tables.map((t) => t.name),
        capabilities: {
          salesSupported: dataset.sales.length > 0,
          productsSupported: dataset.products.length > 0,
          customersSupported: dataset.customers.length > 0,
          expensesSupported: dataset.expenses.length > 0,
          costSupported: dataset.hasCostData,
          profitSupported: dataset.hasCostData,
          profitExplanation: dataset.hasCostData
            ? 'بيانات التكلفة متوفرة بدقة ويمكن احتساب إجمالي الربح وهامش الربح.'
            : 'لا تتوفر بيانات تكلفة كافية لحساب الربح بدقة.',
          paymentsSupported: dataset.sales.some((s) => !!s.paymentMethod),
          inventorySupported: dataset.products.length > 0,
        },
        entities: {},
        recordCounts: schema.tables.reduce((acc, t) => ({ ...acc, [t.name]: t.rowCount || 0 }), {}),
      });

      const time = getCurrentFormattedTime();
      setActiveSourceName(fileName);
      setActiveSourceType('مصنف Excel');
      setLastReadTimestamp(time);
      setIsConnected(true);
      setIsVerifying(false);
      setIsConnectModalOpen(false);

      setAdvisorAnswer({
        summary: `تم استيراد وقراءة مصنف Excel (${fileName}) بنجاح.`,
        answerText: `تم استخراج ${dataset.sales.length} عملية مبيعات وفحص السجلات ومطابقتها وفق النموذج التجاري الموحد.`,
        details: [
          `مصنف Excel: ${schema.tables.length} صفحات عمل مفحوصة`,
          `المبيعات المستخرجة: ${dataset.sales.length} معاملة`,
          `حالة التكاليف: ${dataset.hasCostData ? 'متوفرة' : 'غير متوفرة في الملف'}`,
        ],
        evidence: [`مصنف Excel: ${schema.tables.length} صفحات عمل مفحوصة`],
        isSupported: true,
      });
    } catch (err: any) {
      setIsVerifying(false);
      setVerificationError(err.message || 'فشل فحص مصنف Excel.');
    }
  };

  // ================= 3. CONNECT CSV FILE =================
  const handleConnectCSVBuffer = async (buffer: Uint8Array, fileName: string) => {
    setIsVerifying(true);
    setVerificationError(null);

    try {
      const connector = new CSVConnector();
      const res = await connector.connect({
        sourceId: 'csv_file',
        sourceType: 'file',
        fileBuffer: buffer,
        fileName,
      });

      if (!res.success) {
        throw new Error(res.message);
      }

      const schema = await connector.discoverSchema();
      const tableName = schema.tables[0]?.name || 'csv_data';
      const batch = await connector.extractTableData(tableName);

      const tablesData = { [tableName]: batch.rows };
      const conceptMappings = { sales: tableName };
      const dataset = buildUnifiedDataset(tablesData, conceptMappings);
      const unifiedMetrics = calculateMetricsFromUnified(dataset, fileName);

      setMetrics(unifiedMetrics);
      setDiscovery({
        tablesFound: [tableName],
        capabilities: {
          salesSupported: dataset.sales.length > 0,
          productsSupported: dataset.products.length > 0,
          customersSupported: dataset.customers.length > 0,
          expensesSupported: dataset.expenses.length > 0,
          costSupported: dataset.hasCostData,
          profitSupported: dataset.hasCostData,
          profitExplanation: dataset.hasCostData
            ? 'بيانات التكلفة متوفرة بدقة ويمكن احتساب إجمالي الربح وهامش الربح.'
            : 'لا تتوفر بيانات تكلفة كافية لحساب الربح بدقة.',
          paymentsSupported: true,
          inventorySupported: false,
        },
        entities: {},
        recordCounts: { [tableName]: batch.totalCount },
      });

      const time = getCurrentFormattedTime();
      setActiveSourceName(fileName);
      setActiveSourceType('ملف CSV مجدول');
      setLastReadTimestamp(time);
      setIsConnected(true);
      setIsVerifying(false);
      setIsConnectModalOpen(false);

      setAdvisorAnswer({
        summary: `تم فحص ملف CSV (${fileName}) بنجاح.`,
        answerText: `تمت قراءة ${batch.totalCount} سجلاً فعلياً ومطابقة قنوات الدفع والمبيعات.`,
        evidence: [`ملف CSV مجدول`],
        isSupported: true,
      });
    } catch (err: any) {
      setIsVerifying(false);
      setVerificationError(err.message || 'فشل فحص ملف CSV.');
    }
  };

  // ================= 4. CONNECT SQL DATABASE =================
  const handleConnectSQLDatabase = async () => {
    if (!selectedConnector) return;
    setIsVerifying(true);
    setVerificationError(null);

    try {
      let res;
      if (selectedConnector.id === 'postgresql') {
        const connector = new PostgreSQLConnector();
        res = await connector.connect({
          sourceId: 'postgresql',
          sourceType: 'database',
          host: dbForm.host,
          port: Number(dbForm.port) || 5432,
          database: dbForm.database,
          user: dbForm.user,
          password: dbForm.password,
        });
      } else {
        const connector = new MySQLConnector();
        res = await connector.connect({
          sourceId: 'mysql',
          sourceType: 'database',
          host: dbForm.host,
          port: Number(dbForm.port) || 3306,
          database: dbForm.database,
          user: dbForm.user,
          password: dbForm.password,
        });
      }

      if (!res.success) {
        throw new Error(res.message);
      }

      const time = getCurrentFormattedTime();
      setActiveSourceName(`${dbForm.database}@${dbForm.host}`);
      setActiveSourceType(selectedConnector.name);
      setLastReadTimestamp(time);
      setIsConnected(true);
      setIsVerifying(false);
      setIsConnectModalOpen(false);
    } catch (err: any) {
      setIsVerifying(false);
      setVerificationError(err.message || 'تعذر الاتصال بقاعدة البيانات.');
    }
  };

  // File Upload Dispatcher
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const arrayBuffer = evt.target?.result as ArrayBuffer;
      if (arrayBuffer) {
        const u8 = new Uint8Array(arrayBuffer);
        const ext = file.name.split('.').pop()?.toLowerCase();

        if (ext === 'xlsx' || ext === 'xls') {
          await handleConnectExcelBuffer(u8, file.name);
        } else if (ext === 'csv') {
          await handleConnectCSVBuffer(u8, file.name);
        } else {
          await handleConnectSQLiteBuffer(u8, file.name);
        }
      }
    };
    reader.onerror = () => {
      setVerificationError('تعذر قراءة الملف من جهازك.');
    };
    reader.readAsArrayBuffer(file);
  };

  // Disconnect handler
  const handleDisconnect = () => {
    sqliteEngine.disconnect();
    setIsConnected(false);
    setActiveSourceName('');
    setActiveSourceType('');
    setLastReadTimestamp('');
    setDiscovery(null);
    setMetrics(null);
    setAdvisorAnswer(null);
    setQueryInput('');
  };

  // Universal Connect Handler
  const handleUniversalConnectSuccess = (pipeRes: PipelineExecutionResult) => {
    setActiveSourceName(pipeRes.sourceDisplayName);
    setActiveSourceType(pipeRes.connectorId);
    setLastReadTimestamp(pipeRes.readAt);
    setIsConnected(true);
    setDiscovery(pipeRes.discovery);
    setMetrics(pipeRes.metrics);
  };

  // Question submission handler
  const handleQuerySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryInput.trim()) return;
    const diagRes = executeDiagnosticAnalysis(queryInput, metrics, discovery, companySettings.currency);
    setAdvisorAnswer({
      summary: diagRes.userView.summary,
      answerText: diagRes.userView.answerText,
      details: diagRes.userView.details,
      evidence: diagRes.userView.evidence,
      isSupported: diagRes.userView.isReliable,
      provenanceId: diagRes.userView.provenanceId,
    });
    setLatestDiagnosticReport(diagRes.developerReport);
    setCurrentReliabilityStatus(diagRes.userView.reliabilityStatus);
    setIsDetailsExpanded(true);
  };

  const handleSampleClick = (question: string) => {
    setQueryInput(question);
    const diagRes = executeDiagnosticAnalysis(question, metrics, discovery, companySettings.currency);
    setAdvisorAnswer({
      summary: diagRes.userView.summary,
      answerText: diagRes.userView.answerText,
      details: diagRes.userView.details,
      evidence: diagRes.userView.evidence,
      isSupported: diagRes.userView.isReliable,
      provenanceId: diagRes.userView.provenanceId,
    });
    setLatestDiagnosticReport(diagRes.developerReport);
    setCurrentReliabilityStatus(diagRes.userView.reliabilityStatus);
    setIsDetailsExpanded(true);
  };

  // Cost calculation for Company Pulse: strictly (totalSales - grossProfit) only if both are present
  const calculatedCostValue = useMemo(() => {
    if (metrics?.totalSales !== null && metrics?.totalSales !== undefined && metrics?.grossProfit !== null && metrics?.grossProfit !== undefined) {
      return metrics.totalSales - metrics.grossProfit;
    }
    return null;
  }, [metrics?.totalSales, metrics?.grossProfit]);

  // Collections calculation from payment methods
  const calculatedCollectionsValue = useMemo(() => {
    if (metrics?.paymentMethods && metrics.paymentMethods.length > 0) {
      return metrics.paymentMethods.reduce((acc, p) => acc + p.totalAmount, 0);
    }
    return null;
  }, [metrics?.paymentMethods]);

  // Filtered Provenance Records for Reports
  const filteredProvenanceRecords = useMemo(() => {
    if (!metrics?.provenanceRecords) return [];
    return metrics.provenanceRecords.filter((record) => {
      const matchesSearch =
        reportSearchTerm.trim() === '' ||
        record.metricLabel.toLowerCase().includes(reportSearchTerm.toLowerCase()) ||
        record.metricKey.toLowerCase().includes(reportSearchTerm.toLowerCase()) ||
        record.provenanceId.toLowerCase().includes(reportSearchTerm.toLowerCase()) ||
        record.sourceTable.toLowerCase().includes(reportSearchTerm.toLowerCase());

      const matchesStatus =
        reportStatusFilter === 'all' || record.validationStatus === reportStatusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [metrics?.provenanceRecords, reportSearchTerm, reportStatusFilter]);

  // Filtered Connector Catalog for Sources Page
  const filteredConnectors = useMemo(() => {
    return CONNECTOR_CATALOG.filter((connector) => {
      const matchesCategory =
        activeCategoryFilter === 'all' || connector.category === activeCategoryFilter;
      const matchesSearch =
        sourceSearchTerm.trim() === '' ||
        connector.name.toLowerCase().includes(sourceSearchTerm.toLowerCase()) ||
        connector.description.toLowerCase().includes(sourceSearchTerm.toLowerCase()) ||
        connector.categoryLabel.toLowerCase().includes(sourceSearchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [activeCategoryFilter, sourceSearchTerm]);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans flex flex-col selection:bg-neutral-200" dir="rtl">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept={currentFileFormat}
        className="hidden"
      />

      {/* Top Header Navigation (Executive Command Header) */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-neutral-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Brand Logo & Name */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-neutral-900 text-white flex items-center justify-center">
                <Building2 className="w-4 h-4 text-neutral-100" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-base text-neutral-900 tracking-tight">
                    مستشار ذكاء الشركة
                  </span>
                  <span className="text-[11px] font-medium text-neutral-500">
                    · الحقيقة قبل الذكاء
                  </span>
                </div>
              </div>
            </div>

            {/* Desktop Navigation Links (Clean Minimal Unboxed Links) */}
            <nav className="hidden md:flex items-center gap-1 text-xs font-semibold">
              <button
                onClick={() => setActiveTab('home')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  activeTab === 'home'
                    ? 'bg-neutral-900 text-white'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                }`}
              >
                الرئيسية
              </button>
              <button
                onClick={() => setActiveTab('analysis')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                  activeTab === 'analysis'
                    ? 'bg-neutral-900 text-white'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                التحليل
              </button>
              <button
                onClick={() => setActiveTab('reports')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                  activeTab === 'reports'
                    ? 'bg-neutral-900 text-white'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                التقارير
              </button>
              <button
                onClick={() => setActiveTab('alerts')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                  activeTab === 'alerts'
                    ? 'bg-neutral-900 text-white'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                }`}
              >
                <Bell className="w-3.5 h-3.5" />
                التنبيهات
              </button>
              <button
                onClick={() => setActiveTab('source')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                  activeTab === 'source'
                    ? 'bg-neutral-900 text-white'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                المصادر
              </button>
            </nav>

            {/* Header Right Actions */}
            <div className="flex items-center gap-2">
              {isConnected ? (
                <div className="flex items-center gap-2 text-xs text-neutral-700 bg-neutral-100 px-3 py-1.5 rounded-lg border border-neutral-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  <span className="font-semibold">{activeSourceName}</span>
                  <span className="text-neutral-400">·</span>
                  <span className="text-neutral-500 text-[11px]">{lastReadTimestamp}</span>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setSelectedConnector(null);
                    setIsConnectModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 transition-colors shadow-xs"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>ربط بيانات الشركة</span>
                </button>
              )}

              <button
                onClick={() => setIsDeveloperAuditModalOpen(true)}
                title="مرصد التشخيص والتدقيق M4.5"
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 rounded-lg transition-colors cursor-pointer"
                aria-label="مرصد التشخيص والتدقيق M4.5"
              >
                <Activity className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">تشخيص M4.5</span>
              </button>

              <button
                onClick={() => setIsSettingsModalOpen(true)}
                title="إعدادات المنشأة"
                className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
                aria-label="إعدادات المنشأة"
              >
                <SettingsIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Bar */}
        <div className="md:hidden flex items-center justify-around border-t border-neutral-100 py-1.5 px-2 bg-neutral-50 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('home')}
            className={`px-2.5 py-1 rounded-md ${activeTab === 'home' ? 'bg-neutral-900 text-white' : 'text-neutral-600'}`}
          >
            الرئيسية
          </button>
          <button
            onClick={() => setActiveTab('analysis')}
            className={`px-2.5 py-1 rounded-md ${activeTab === 'analysis' ? 'bg-neutral-900 text-white' : 'text-neutral-600'}`}
          >
            التحليل
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-2.5 py-1 rounded-md ${activeTab === 'reports' ? 'bg-neutral-900 text-white' : 'text-neutral-600'}`}
          >
            التقارير
          </button>
          <button
            onClick={() => setActiveTab('alerts')}
            className={`px-2.5 py-1 rounded-md ${activeTab === 'alerts' ? 'bg-neutral-900 text-white' : 'text-neutral-600'}`}
          >
            التنبيهات
          </button>
          <button
            onClick={() => setActiveTab('source')}
            className={`px-2.5 py-1 rounded-md ${activeTab === 'source' ? 'bg-neutral-900 text-white' : 'text-neutral-600'}`}
          >
            المصادر
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* ================= TAB 1: HOME (EXECUTIVE COMMAND LAYER) ================= */}
        {activeTab === 'home' && (
          <>
            {/* 1. DISCONNECTED STATE: EXACT BRIEF COMPLIANCE */}
            {!isConnected ? (
              <div className="bg-white border border-neutral-200 rounded-2xl p-7 sm:p-9 text-center space-y-5">
                <div className="w-12 h-12 rounded-xl bg-neutral-100 text-neutral-800 flex items-center justify-center mx-auto">
                  <Database className="w-6 h-6" />
                </div>
                
                <div className="space-y-1.5 max-w-lg mx-auto">
                  <h2 className="text-xl sm:text-2xl font-extrabold text-neutral-900 tracking-tight">
                    البيانات بانتظار الربط
                  </h2>
                  <p className="text-xs sm:text-sm text-neutral-500 leading-relaxed">
                    اربط مصدر بيانات شركتك لتكوين صورة حقيقية قابلة للتحقق.
                  </p>
                </div>

                <div>
                  <button
                    onClick={() => {
                      setSelectedConnector(null);
                      setIsConnectModalOpen(true);
                    }}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-neutral-900 text-white text-xs font-bold rounded-xl hover:bg-neutral-800 transition-colors shadow-xs"
                  >
                    <Database className="w-4 h-4" />
                    <span>ربط بيانات الشركة</span>
                  </button>
                </div>

                {/* All 18 Supported Data Sources Display (No omissions) */}
                <div className="pt-6 border-t border-neutral-100 text-right space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-neutral-900">مصادر البيانات المدعومة في النظام ({CONNECTOR_CATALOG.length} مصدراً)</span>
                    <span className="text-neutral-500">اختر أي مصدر لبدء الفحص</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {CONNECTOR_CATALOG.map((connector) => (
                      <button
                        key={connector.id}
                        type="button"
                        onClick={() => {
                          setSelectedConnector(connector);
                          setIsConnectModalOpen(true);
                        }}
                        className="p-3 text-right rounded-xl border border-neutral-200/90 hover:border-neutral-900 hover:bg-neutral-50/60 transition-all text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-neutral-900">{connector.name}</span>
                          <span className="text-[10px] text-neutral-500">
                            {connector.isImplemented ? 'متاح للربط' : 'قيد التجهيز'}
                          </span>
                        </div>
                        <div className="text-[11px] text-neutral-500 line-clamp-1">
                          {connector.categoryLabel}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* 2. CONNECTED EXECUTIVE BANNER */
              <div className="bg-white border border-neutral-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 shrink-0" />
                  <div>
                    <div className="font-bold text-neutral-900">
                      المصدر المتصل: {activeSourceName}
                    </div>
                    <div className="text-neutral-500 text-[11px] mt-0.5">
                      {activeSourceType} · آخر قراءة حقيقية: {lastReadTimestamp} · مقفل للقراءة فقط 100%
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab('source')}
                    className="px-3 py-1.5 rounded-lg border border-neutral-200 text-neutral-700 font-semibold hover:bg-neutral-50 transition-colors"
                  >
                    إدارة المصدر
                  </button>
                  <button
                    onClick={handleDisconnect}
                    className="px-3 py-1.5 rounded-lg bg-neutral-100 text-neutral-600 hover:text-rose-700 hover:bg-rose-50 transition-colors font-semibold"
                  >
                    فصل
                  </button>
                </div>
              </div>
            )}

            {/* SECTION: اسأل عن شركتك (The Advisor - Strict Advisor Engine) */}
            <section className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-neutral-900" />
                    <span>اسأل عن شركتك</span>
                  </h2>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    إجابات تنفيذية حتمية مبنية على سجلاتك الفعلية
                  </p>
                </div>

                <div className="text-xs text-neutral-500 hidden sm:flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>محصن ضد الأرقام الافتراضية</span>
                </div>
              </div>

              {/* Search Form */}
              <form onSubmit={handleQuerySubmit} className="space-y-3">
                <div className="relative">
                  <input
                    type="text"
                    value={queryInput}
                    onChange={(e) => setQueryInput(e.target.value)}
                    placeholder="ما الذي تريد معرفته عن أرباحك، مبيعاتك، تكاليفك أو مخزونك؟"
                    className="w-full pl-24 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-neutral-900 transition-colors placeholder:text-neutral-400 font-medium"
                  />
                  <button
                    type="submit"
                    className="absolute left-1.5 top-1.5 bottom-1.5 px-4 bg-neutral-900 text-white text-xs font-semibold rounded-lg hover:bg-neutral-800 transition-colors flex items-center gap-1.5"
                  >
                    <Search className="w-3 h-3" />
                    <span>استعلام</span>
                  </button>
                </div>

                {/* Suggested Questions */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] font-semibold text-neutral-500 ml-1">مقترحات تنفيذية:</span>
                  {executiveQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSampleClick(q)}
                      className="text-[11px] px-2.5 py-1 rounded-md bg-neutral-100 hover:bg-neutral-200 text-neutral-700 transition-colors text-right"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </form>

              {/* Advisor Response Area */}
              {advisorAnswer && (
                <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-4 sm:p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {advisorAnswer.isSupported ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <Info className="w-4 h-4 text-amber-600 shrink-0" />
                      )}
                      <span className="text-xs font-bold text-neutral-800">
                        {advisorAnswer.isSupported ? 'الإجابة التنفيذية المعتمدة' : 'تنبيه التدقيق المالي'}
                      </span>
                      {currentReliabilityStatus && (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            currentReliabilityStatus === 'موثوق'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : currentReliabilityStatus === 'بيانات ناقصة'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : currentReliabilityStatus === 'تحتاج مراجعة'
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : 'bg-rose-100 text-rose-800 border border-rose-200'
                          }`}
                        >
                          حالة النتيجة: {currentReliabilityStatus}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsDeveloperAuditModalOpen(true)}
                        className="text-[11px] font-semibold text-neutral-700 bg-white hover:bg-neutral-100 border border-neutral-300 rounded-md px-2 py-0.5 flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                        title="عرض تقرير التشخيص الداخلي للمبرمج"
                      >
                        <Activity className="w-3 h-3 text-emerald-600" />
                        <span>تشخيص M4.5</span>
                      </button>
                      {advisorAnswer.provenanceId && (
                        <span className="text-[10px] text-neutral-500 font-mono">
                          {advisorAnswer.provenanceId}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => openAdvisorEvidence(advisorAnswer)}
                        className="text-xs font-semibold text-neutral-900 underline hover:text-neutral-700"
                      >
                        عرض الدليل
                      </button>
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="text-sm font-bold text-neutral-900 leading-snug">
                    {advisorAnswer.summary}
                  </div>

                  {/* Text */}
                  <p className="text-xs text-neutral-700 leading-relaxed">
                    {advisorAnswer.answerText}
                  </p>

                  {/* Expandable Supporting Details */}
                  {advisorAnswer.details && advisorAnswer.details.length > 0 && (
                    <div className="pt-2 border-t border-neutral-200 space-y-1.5">
                      <button
                        type="button"
                        onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
                        className="text-xs font-semibold text-neutral-600 hover:text-neutral-900 flex items-center gap-1"
                      >
                        <span>{isDetailsExpanded ? 'إخفاء التفاصيل' : 'عرض التفاصيل المساندة'}</span>
                        {isDetailsExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      {isDetailsExpanded && (
                        <ul className="text-xs space-y-1 text-neutral-700 pr-2 border-r-2 border-neutral-300">
                          {advisorAnswer.details.map((d, i) => (
                            <li key={i}>{d}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* SECTION: نبض الشركة (Company Pulse - 11 Strict Fields) */}
            {isConnected && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-neutral-900">نبض الشركة</h3>
                    <p className="text-xs text-neutral-500">
                      المجالات المالية المتوفرة فعلياً من واقع سجلات المنشأة المعتمدة
                    </p>
                  </div>
                  <span className="text-[11px] font-semibold text-neutral-500">
                    أرقام حتمية مثبّتة
                  </span>
                </div>

                {/* 11 Executive Cards: Small, Calm, Executive */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  
                  {/* 1. المبيعات (Sales) */}
                  <div className="bg-white border border-neutral-200 rounded-xl p-3.5 space-y-2 flex flex-col justify-between">
                    <div>
                      <div className="text-xs text-neutral-500 font-medium">المبيعات</div>
                      <div className="text-lg font-bold text-neutral-900 mt-1">
                        {metrics?.totalSales !== null && metrics?.totalSales !== undefined ? (
                          `${metrics.totalSales.toLocaleString('ar-SA')} ${companySettings.currency}`
                        ) : (
                          <span className="text-neutral-400 text-sm font-semibold">غير متوفر</span>
                        )}
                      </div>
                      <div className="text-[10px] text-neutral-400 mt-0.5">
                        {metrics?.transactionCount ? `${metrics.transactionCount} عملية مثبتة` : 'الفترة الحالية'}
                      </div>
                    </div>
                    {metrics?.totalSales !== null && (
                      <div className="pt-1.5 border-t border-neutral-100 flex justify-end">
                        <button
                          type="button"
                          onClick={() => openMetricEvidence('totalSales', 'المبيعات', metrics?.totalSales)}
                          className="text-[11px] font-semibold text-neutral-700 hover:text-neutral-900 underline"
                        >
                          عرض الدليل
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 2. الإيرادات (Revenue) */}
                  <div className="bg-white border border-neutral-200 rounded-xl p-3.5 space-y-2 flex flex-col justify-between">
                    <div>
                      <div className="text-xs text-neutral-500 font-medium">الإيرادات</div>
                      <div className="text-lg font-bold text-neutral-900 mt-1">
                        {metrics?.totalSales !== null && metrics?.totalSales !== undefined ? (
                          `${metrics.totalSales.toLocaleString('ar-SA')} ${companySettings.currency}`
                        ) : (
                          <span className="text-neutral-400 text-sm font-semibold">غير متوفر</span>
                        )}
                      </div>
                      <div className="text-[10px] text-neutral-400 mt-0.5">الفترة الحالية</div>
                    </div>
                    {metrics?.totalSales !== null && (
                      <div className="pt-1.5 border-t border-neutral-100 flex justify-end">
                        <button
                          type="button"
                          onClick={() => openMetricEvidence('totalSales', 'الإيرادات', metrics?.totalSales)}
                          className="text-[11px] font-semibold text-neutral-700 hover:text-neutral-900 underline"
                        >
                          عرض الدليل
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 3. إجمالي الربح (Gross Profit) */}
                  <div className="bg-white border border-neutral-200 rounded-xl p-3.5 space-y-2 flex flex-col justify-between">
                    <div>
                      <div className="text-xs text-neutral-500 font-medium">إجمالي الربح</div>
                      <div className="text-lg font-bold text-neutral-900 mt-1">
                        {metrics?.grossProfit !== null && metrics?.grossProfit !== undefined ? (
                          `${metrics.grossProfit.toLocaleString('ar-SA')} ${companySettings.currency}`
                        ) : (
                          <span className="text-neutral-400 text-sm font-semibold">غير متوفر</span>
                        )}
                      </div>
                      <div className="text-[10px] text-neutral-400 mt-0.5">
                        {metrics?.grossProfit !== null ? 'محسوب بالتكاليف' : 'يتطلب حقول تكلفة الشراء'}
                      </div>
                    </div>
                    {metrics?.grossProfit !== null && (
                      <div className="pt-1.5 border-t border-neutral-100 flex justify-end">
                        <button
                          type="button"
                          onClick={() => openMetricEvidence('grossProfit', 'إجمالي الربح', metrics?.grossProfit)}
                          className="text-[11px] font-semibold text-neutral-700 hover:text-neutral-900 underline"
                        >
                          عرض الدليل
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 4. صافي الربح (Net Profit) */}
                  <div className="bg-white border border-neutral-200 rounded-xl p-3.5 space-y-2 flex flex-col justify-between">
                    <div>
                      <div className="text-xs text-neutral-500 font-medium">صافي الربح</div>
                      <div className="text-lg font-bold text-neutral-900 mt-1">
                        {metrics?.netProfit !== null && metrics?.netProfit !== undefined ? (
                          `${metrics.netProfit.toLocaleString('ar-SA')} ${companySettings.currency}`
                        ) : (
                          <span className="text-neutral-400 text-sm font-semibold">غير متوفر</span>
                        )}
                      </div>
                      <div className="text-[10px] text-neutral-400 mt-0.5">
                        {metrics?.netProfit !== null ? 'بعد خصم المصروفات' : 'يتطلب بيانات الربح والمصروفات'}
                      </div>
                    </div>
                    {metrics?.netProfit !== null && (
                      <div className="pt-1.5 border-t border-neutral-100 flex justify-end">
                        <button
                          type="button"
                          onClick={() => openMetricEvidence('netProfit', 'صافي الربح', metrics?.netProfit)}
                          className="text-[11px] font-semibold text-neutral-700 hover:text-neutral-900 underline"
                        >
                          عرض الدليل
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 5. هامش الربح (Profit Margin) */}
                  <div className="bg-white border border-neutral-200 rounded-xl p-3.5 space-y-2 flex flex-col justify-between">
                    <div>
                      <div className="text-xs text-neutral-500 font-medium">هامش الربح</div>
                      <div className="text-lg font-bold text-neutral-900 mt-1">
                        {metrics?.profitMarginPercent !== null && metrics?.profitMarginPercent !== undefined ? (
                          `${metrics.profitMarginPercent.toFixed(1)}%`
                        ) : (
                          <span className="text-neutral-400 text-sm font-semibold">غير متوفر</span>
                        )}
                      </div>
                      <div className="text-[10px] text-neutral-400 mt-0.5">
                        {metrics?.profitMarginPercent !== null ? 'نسبة إجمالي الربح للمبيعات' : 'غير مثبت'}
                      </div>
                    </div>
                    {metrics?.profitMarginPercent !== null && (
                      <div className="pt-1.5 border-t border-neutral-100 flex justify-end">
                        <button
                          type="button"
                          onClick={() => openMetricEvidence('profitMarginPercent', 'هامش الربح', `${metrics?.profitMarginPercent?.toFixed(1)}%`)}
                          className="text-[11px] font-semibold text-neutral-700 hover:text-neutral-900 underline"
                        >
                          عرض الدليل
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 6. التكاليف (Costs) */}
                  <div className="bg-white border border-neutral-200 rounded-xl p-3.5 space-y-2 flex flex-col justify-between">
                    <div>
                      <div className="text-xs text-neutral-500 font-medium">التكاليف</div>
                      <div className="text-lg font-bold text-neutral-900 mt-1">
                        {calculatedCostValue !== null ? (
                          `${calculatedCostValue.toLocaleString('ar-SA')} ${companySettings.currency}`
                        ) : (
                          <span className="text-neutral-400 text-sm font-semibold">غير متوفر</span>
                        )}
                      </div>
                      <div className="text-[10px] text-neutral-400 mt-0.5">تكلفة البضاعة المباعة</div>
                    </div>
                    {calculatedCostValue !== null && (
                      <div className="pt-1.5 border-t border-neutral-100 flex justify-end">
                        <button
                          type="button"
                          onClick={() => openMetricEvidence('costOfGoods', 'التكاليف', calculatedCostValue)}
                          className="text-[11px] font-semibold text-neutral-700 hover:text-neutral-900 underline"
                        >
                          عرض الدليل
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 7. المصروفات (Expenses) */}
                  <div className="bg-white border border-neutral-200 rounded-xl p-3.5 space-y-2 flex flex-col justify-between">
                    <div>
                      <div className="text-xs text-neutral-500 font-medium">المصروفات</div>
                      <div className="text-lg font-bold text-neutral-900 mt-1">
                        {metrics?.totalExpenses !== null && metrics?.totalExpenses !== undefined ? (
                          `${metrics.totalExpenses.toLocaleString('ar-SA')} ${companySettings.currency}`
                        ) : (
                          <span className="text-neutral-400 text-sm font-semibold">غير متوفر</span>
                        )}
                      </div>
                      <div className="text-[10px] text-neutral-400 mt-0.5">المصروفات التشغيلية</div>
                    </div>
                    {metrics?.totalExpenses !== null && (
                      <div className="pt-1.5 border-t border-neutral-100 flex justify-end">
                        <button
                          type="button"
                          onClick={() => openMetricEvidence('totalExpenses', 'المصروفات', metrics?.totalExpenses)}
                          className="text-[11px] font-semibold text-neutral-700 hover:text-neutral-900 underline"
                        >
                          عرض الدليل
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 8. التحصيلات (Collections) */}
                  <div className="bg-white border border-neutral-200 rounded-xl p-3.5 space-y-2 flex flex-col justify-between">
                    <div>
                      <div className="text-xs text-neutral-500 font-medium">التحصيلات</div>
                      <div className="text-lg font-bold text-neutral-900 mt-1">
                        {calculatedCollectionsValue !== null ? (
                          `${calculatedCollectionsValue.toLocaleString('ar-SA')} ${companySettings.currency}`
                        ) : (
                          <span className="text-neutral-400 text-sm font-semibold">غير متوفر</span>
                        )}
                      </div>
                      <div className="text-[10px] text-neutral-400 mt-0.5">عبر قنوات الدفع المثبتة</div>
                    </div>
                    {calculatedCollectionsValue !== null && (
                      <div className="pt-1.5 border-t border-neutral-100 flex justify-end">
                        <button
                          type="button"
                          onClick={() => openMetricEvidence('collections', 'التحصيلات', calculatedCollectionsValue)}
                          className="text-[11px] font-semibold text-neutral-700 hover:text-neutral-900 underline"
                        >
                          عرض الدليل
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 9. الذمم المدينة (Receivables) */}
                  <div className="bg-white border border-neutral-200 rounded-xl p-3.5 space-y-2 flex flex-col justify-between">
                    <div>
                      <div className="text-xs text-neutral-500 font-medium">الذمم المدينة</div>
                      <div className="text-sm font-semibold text-neutral-400 mt-1">
                        غير متوفر
                      </div>
                      <div className="text-[10px] text-neutral-400 mt-0.5">غير مثبت بالبيانات المتاحة</div>
                    </div>
                  </div>

                  {/* 10. المخزون (Inventory) */}
                  <div className="bg-white border border-neutral-200 rounded-xl p-3.5 space-y-2 flex flex-col justify-between">
                    <div>
                      <div className="text-xs text-neutral-500 font-medium">المخزون</div>
                      <div className="text-lg font-bold text-neutral-900 mt-1">
                        {metrics?.inventoryItems ? (
                          `${metrics.inventoryItems.length} صنف`
                        ) : (
                          <span className="text-neutral-400 text-sm font-semibold">غير متوفر</span>
                        )}
                      </div>
                      <div className="text-[10px] text-neutral-400 mt-0.5">
                        {metrics?.inventoryItems
                          ? `${metrics.inventoryItems.filter((i) => i.status !== 'normal').length} أصناف منخفضة`
                          : 'لا تتوفر سجلات مستودعات'}
                      </div>
                    </div>
                    {metrics?.inventoryItems && (
                      <div className="pt-1.5 border-t border-neutral-100 flex justify-end">
                        <button
                          type="button"
                          onClick={() => openMetricEvidence('inventoryItems', 'المخزون', `${metrics.inventoryItems.length} صنف`)}
                          className="text-[11px] font-semibold text-neutral-700 hover:text-neutral-900 underline"
                        >
                          عرض الدليل
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 11. التدفق النقدي (Cash Flow) */}
                  <div className="bg-white border border-neutral-200 rounded-xl p-3.5 space-y-2 flex flex-col justify-between">
                    <div>
                      <div className="text-xs text-neutral-500 font-medium">التدفق النقدي</div>
                      <div className="text-sm font-semibold text-neutral-400 mt-1">
                        غير متوفر
                      </div>
                      <div className="text-[10px] text-neutral-400 mt-0.5">غير مثبت بالبيانات المتاحة</div>
                    </div>
                  </div>

                </div>
              </section>
            )}

            {/* SECTION: ماذا يحدث الآن؟ وما يحتاج انتباهك (Executive Proven Insights) */}
            {isConnected && metrics && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* 1. ماذا يحدث الآن؟ (Proven Changes Only) */}
                <div className="bg-white border border-neutral-200 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between border-b border-neutral-100 pb-2.5">
                    <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
                      ماذا يحدث الآن؟
                    </h4>
                    <span className="text-[11px] text-neutral-500">تغيرات مثبتة</span>
                  </div>

                  <div className="space-y-2 text-xs text-neutral-700">
                    {metrics.topProducts.length > 0 && (
                      <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/80 space-y-1">
                        <div className="font-bold text-neutral-900">
                          تركّز الإيراد في المنتج «{metrics.topProducts[0].name}»
                        </div>
                        <p className="text-[11px] text-neutral-600 leading-relaxed">
                          حقق المنتج إيراداً مثبتاً بقيمة {metrics.topProducts[0].totalRevenue.toLocaleString('ar-SA')} {companySettings.currency} عبر {metrics.topProducts[0].soldQuantity} وحدة مباعة.
                        </p>
                        <div className="text-[10px] text-neutral-400 pt-0.5">
                          البيانات المتاحة تثبت التغير، لكنها لا تكفي لإثبات سببه.
                        </div>
                      </div>
                    )}

                    {metrics.grossProfit !== null ? (
                      <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/80 space-y-1">
                        <div className="font-bold text-neutral-900">
                          هامش الربحية الإجمالي المحقق
                        </div>
                        <p className="text-[11px] text-neutral-600 leading-relaxed">
                          سجلت العمليات هامش ربح محقق بنسبة {metrics.profitMarginPercent?.toFixed(1)}% من واقع التكاليف الفعلية.
                        </p>
                      </div>
                    ) : (
                      <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/80 text-[11px] text-neutral-600 leading-relaxed">
                        تعذر رصد اتجاهات الربحية الإجمالية لعدم قيد تكلفة الشراء في السجلات المربوطة.
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. ما يحتاج انتباهك (Discovery Signals with Strict Severities) */}
                <div className="bg-white border border-neutral-200 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between border-b border-neutral-100 pb-2.5">
                    <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
                      ما يحتاج انتباهك
                    </h4>
                    <span className="text-[11px] text-neutral-500">إشارات المحرك الرقابي</span>
                  </div>

                  <div className="space-y-2 text-xs">
                    {/* CRITICAL SIGNALS */}
                    {metrics.inventoryItems.filter((i) => i.status === 'critical').map((item, idx) => (
                      <div key={idx} className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-rose-950">اقتراب نفاد المخزون: {item.name}</span>
                          <span className="text-[10px] font-bold text-rose-800">حرج</span>
                        </div>
                        <p className="text-[11px] text-rose-900">
                          الرصيد المتبقي {item.stock} وحدات فقط في المستودع.
                        </p>
                      </div>
                    ))}

                    {/* WARNING SIGNALS */}
                    {metrics.inventoryItems.filter((i) => i.status === 'low').map((item, idx) => (
                      <div key={idx} className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-amber-950">مستوى مخزون منخفض: {item.name}</span>
                          <span className="text-[10px] font-bold text-amber-800">تحذير</span>
                        </div>
                        <p className="text-[11px] text-amber-900">
                          الرصيد المتاح {item.stock} وحدات.
                        </p>
                      </div>
                    ))}

                    {metrics.slowMovingProducts.length > 0 && (
                      <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-neutral-900">ركود نسبي في بعض الأصناف</span>
                          <span className="text-[10px] font-bold text-neutral-700">تحذير</span>
                        </div>
                        <p className="text-[11px] text-neutral-600">
                          تم رصد {metrics.slowMovingProducts.length} أصناف بحركة مبيعات بطيئة.
                        </p>
                      </div>
                    )}

                    {/* OPPORTUNITY SIGNALS */}
                    {metrics.topCustomers.length > 0 && (
                      <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-emerald-950">ولاء كبار العملاء</span>
                          <span className="text-[10px] font-bold text-emerald-800">فرصة</span>
                        </div>
                        <p className="text-[11px] text-emerald-900">
                          العميل «{metrics.topCustomers[0].name}» أنجز {metrics.topCustomers[0].orderCount} طلبات بقيمة {metrics.topCustomers[0].totalSpent.toLocaleString('ar-SA')} {companySettings.currency}.
                        </p>
                      </div>
                    )}

                    {/* Empty signals state */}
                    {metrics.inventoryItems.filter((i) => i.status !== 'normal').length === 0 && metrics.slowMovingProducts.length === 0 && (
                      <div className="p-4 text-center text-xs text-neutral-500 bg-neutral-50 rounded-xl">
                        لا توجد إشارات حرجة تتطلب تدخلاً فورياً حالياً.
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}
          </>
        )}

        {/* ================= TAB 2: DETAILED ANALYSIS ================= */}
        {activeTab === 'analysis' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-neutral-900">التحليل التنفيذي المتخصص</h2>
                <p className="text-xs text-neutral-500">فحص تفصيلي لمحاور الأعمال من واقع السجلات المحققة</p>
              </div>

              {/* Segmented Sub-Tabs */}
              <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-xl text-xs font-semibold overflow-x-auto">
                <button
                  onClick={() => setAnalysisSubTab('sales')}
                  className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${analysisSubTab === 'sales' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-600 hover:text-neutral-900'}`}
                >
                  المبيعات
                </button>
                <button
                  onClick={() => setAnalysisSubTab('profit')}
                  className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${analysisSubTab === 'profit' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-600 hover:text-neutral-900'}`}
                >
                  الربحية
                </button>
                <button
                  onClick={() => setAnalysisSubTab('costs')}
                  className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${analysisSubTab === 'costs' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-600 hover:text-neutral-900'}`}
                >
                  التكاليف
                </button>
                <button
                  onClick={() => setAnalysisSubTab('customers')}
                  className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${analysisSubTab === 'customers' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-600 hover:text-neutral-900'}`}
                >
                  العملاء والتحصيلات
                </button>
                <button
                  onClick={() => setAnalysisSubTab('inventory')}
                  className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${analysisSubTab === 'inventory' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-600 hover:text-neutral-900'}`}
                >
                  المخزون
                </button>
              </div>
            </div>

            {isConnected && metrics ? (
              <div className="space-y-4">
                {/* 1. SALES SUB-TAB */}
                {analysisSubTab === 'sales' && (
                  <div className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-neutral-900">جدول المنتجات الأعلى مبيعاً</h3>
                      <button
                        type="button"
                        onClick={() => openMetricEvidence('totalSales', 'إجمالي المبيعات', metrics.totalSales)}
                        className="text-xs font-semibold text-neutral-700 underline hover:text-neutral-900"
                      >
                        عرض الدليل المالي
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-right text-xs">
                        <thead>
                          <tr className="border-b border-neutral-200 text-neutral-500 font-semibold">
                            <th className="py-2.5 px-3">المنتج</th>
                            <th className="py-2.5 px-3">الكمية المباعة</th>
                            <th className="py-2.5 px-3">إجمالي الإيراد</th>
                            <th className="py-2.5 px-3">نسبة المساهمة</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                          {metrics.topProducts.map((p, idx) => {
                            const share = metrics.totalSales ? ((p.totalRevenue / metrics.totalSales) * 100).toFixed(1) : '0';
                            return (
                              <tr key={idx} className="hover:bg-neutral-50">
                                <td className="py-2.5 px-3 font-bold text-neutral-900">{p.name}</td>
                                <td className="py-2.5 px-3 text-neutral-600">{p.soldQuantity} وحدة</td>
                                <td className="py-2.5 px-3 font-semibold text-neutral-900">{p.totalRevenue.toLocaleString('ar-SA')} {companySettings.currency}</td>
                                <td className="py-2.5 px-3 text-neutral-500">{share}%</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 2. PROFIT SUB-TAB */}
                {analysisSubTab === 'profit' && (
                  <div className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-4">
                    <h3 className="text-sm font-bold text-neutral-900">تحليل هوامش الربحية</h3>
                    {metrics.grossProfit !== null ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                          <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 text-center space-y-1">
                            <span className="text-xs text-neutral-500">إجمالي المبيعات</span>
                            <div className="text-base font-bold text-neutral-900">{metrics.totalSales?.toLocaleString('ar-SA')} {companySettings.currency}</div>
                          </div>
                          <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 text-center space-y-1">
                            <span className="text-xs text-neutral-500">إجمالي الربح</span>
                            <div className="text-base font-bold text-neutral-900">{metrics.grossProfit.toLocaleString('ar-SA')} {companySettings.currency}</div>
                            <span className="text-[11px] text-neutral-600 block">هامش: {metrics.profitMarginPercent?.toFixed(1)}%</span>
                          </div>
                          <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 text-center space-y-1">
                            <span className="text-xs text-neutral-500">صافي الربح</span>
                            <div className="text-base font-bold text-neutral-900">{metrics.netProfit?.toLocaleString('ar-SA')} {companySettings.currency}</div>
                          </div>
                        </div>

                        <div className="flex justify-end pt-2">
                          <button
                            type="button"
                            onClick={() => openMetricEvidence('grossProfit', 'إجمالي الربح', metrics.grossProfit)}
                            className="text-xs font-semibold text-neutral-900 underline hover:text-neutral-700"
                          >
                            عرض الدليل المحاسبي للأرباح
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 rounded-xl bg-neutral-50 border border-neutral-200 text-center space-y-2">
                        <Info className="w-5 h-5 text-neutral-400 mx-auto" />
                        <h4 className="text-xs font-bold text-neutral-800">بيانات غير كافية لحساب هذا المؤشر</h4>
                        <p className="text-xs text-neutral-500 max-w-md mx-auto">
                          يتطلب حساب الربح توفر حقول تكلفة الشراء الفعلية في السجلات المربوطة. يلتزم النظام بعدم اختلاق أي هوامش تقديرية.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* 3. COSTS SUB-TAB */}
                {analysisSubTab === 'costs' && (
                  <div className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-4">
                    <h3 className="text-sm font-bold text-neutral-900">هيكل المصروفات والتكاليف</h3>
                    {metrics.totalExpenses !== null ? (
                      <div className="space-y-3">
                        <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-neutral-600">إجمالي المصروفات المقيدة:</span>
                            <span className="font-bold text-neutral-900">{metrics.totalExpenses.toLocaleString('ar-SA')} {companySettings.currency}</span>
                          </div>
                          {metrics.totalSales && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-neutral-600">نسبة المصروفات إلى المبيعات:</span>
                              <span className="font-bold text-neutral-900">{((metrics.totalExpenses / metrics.totalSales) * 100).toFixed(1)}%</span>
                            </div>
                          )}
                        </div>

                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => openMetricEvidence('totalExpenses', 'المصروفات', metrics.totalExpenses)}
                            className="text-xs font-semibold text-neutral-900 underline hover:text-neutral-700"
                          >
                            عرض دليل المصروفات
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 rounded-xl bg-neutral-50 border border-neutral-200 text-center text-xs text-neutral-500">
                        لا توجد مصروفات تشغيلية مقيدة في المصدر المربوط حالياً.
                      </div>
                    )}
                  </div>
                )}

                {/* 4. CUSTOMERS & COLLECTIONS SUB-TAB */}
                {analysisSubTab === 'customers' && (
                  <div className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-5">
                    {/* Payment methods breakdown */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-neutral-900">قنوات التحصيل ووسائل الدفع</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {metrics.paymentMethods.map((pm, idx) => (
                          <div key={idx} className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200 space-y-1">
                            <span className="text-xs font-semibold text-neutral-500">{pm.method}</span>
                            <div className="text-base font-bold text-neutral-900">
                              {pm.totalAmount.toLocaleString('ar-SA')} {companySettings.currency}
                            </div>
                            <div className="text-[11px] text-neutral-500">{pm.percentage.toFixed(1)}% من الإجمالي</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Top customers */}
                    <div className="space-y-3 pt-3 border-t border-neutral-100">
                      <h4 className="text-xs font-bold text-neutral-900">أكبر العملاء حسب حجم التعامل</h4>
                      <div className="divide-y divide-neutral-100 text-xs">
                        {metrics.topCustomers.map((c, idx) => (
                          <div key={idx} className="py-2.5 flex items-center justify-between">
                            <span className="font-bold text-neutral-900">{c.name}</span>
                            <div className="text-left">
                              <span className="font-semibold text-neutral-900">{c.totalSpent.toLocaleString('ar-SA')} {companySettings.currency}</span>
                              <span className="text-[11px] text-neutral-500 block">({c.orderCount} طلبات)</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. INVENTORY SUB-TAB */}
                {analysisSubTab === 'inventory' && (
                  <div className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-4">
                    <h3 className="text-sm font-bold text-neutral-900">حالة أرصدة المخزون</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-right text-xs">
                        <thead>
                          <tr className="border-b border-neutral-200 text-neutral-500 font-semibold">
                            <th className="py-2.5 px-3">المنتج</th>
                            <th className="py-2.5 px-3">الرصيد المتاح</th>
                            <th className="py-2.5 px-3">حالة الرصيد</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                          {metrics.inventoryItems.map((item, idx) => (
                            <tr key={idx} className="hover:bg-neutral-50">
                              <td className="py-2.5 px-3 font-bold text-neutral-900">{item.name}</td>
                              <td className="py-2.5 px-3 text-neutral-600">{item.stock} وحدة</td>
                              <td className="py-2.5 px-3">
                                <span className={`text-[11px] font-semibold ${
                                  item.status === 'critical'
                                    ? 'text-rose-700'
                                    : item.status === 'low'
                                    ? 'text-amber-700'
                                    : 'text-neutral-600'
                                }`}>
                                  {item.status === 'critical' ? 'حرج جداً' : item.status === 'low' ? 'منخفض' : 'آمن'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white border border-neutral-200 rounded-2xl p-10 text-center space-y-3">
                <Database className="w-8 h-8 text-neutral-400 mx-auto" />
                <h4 className="text-sm font-bold text-neutral-900">البيانات بانتظار الربط</h4>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                  اربط مصدر بيانات شركتك لبدء استعراض تحليلات المبيعات وهوامش الربحية وتوزيع العملاء.
                </p>
                <button
                  onClick={() => setIsConnectModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 mt-2"
                >
                  ربط بيانات الشركة
                </button>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 3: AUDIT & REPORTS ================= */}
        {activeTab === 'reports' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-neutral-900">التقارير وسجل إثبات المؤشرات</h2>
                <p className="text-xs text-neutral-500">
                  سجل تدقيق محاسبي حتمي: كل رقم معروض موثق بقيد واستعلام من السجلات
                </p>
              </div>

              {isConnected && metrics && (
                <div className="text-xs text-neutral-500">
                  آخر تدقيق: {lastReadTimestamp}
                </div>
              )}
            </div>

            {isConnected && metrics ? (
              <div className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-4">
                {/* Search & Filter Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-3 border-b border-neutral-100">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute right-3 top-3 text-neutral-400" />
                    <input
                      type="text"
                      value={reportSearchTerm}
                      onChange={(e) => setReportSearchTerm(e.target.value)}
                      placeholder="بحث في المؤشرات، معرفات الإثبات، أو الجداول..."
                      className="w-full pr-8 pl-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-900"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setReportStatusFilter('all')}
                      className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                        reportStatusFilter === 'all' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                      }`}
                    >
                      الكل ({metrics.provenanceRecords.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportStatusFilter('VALIDATED')}
                      className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                        reportStatusFilter === 'VALIDATED' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                      }`}
                    >
                      معتمد ومثبت
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportStatusFilter('WITHHELD')}
                      className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                        reportStatusFilter === 'WITHHELD' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                      }`}
                    >
                      محجوب بأمان
                    </button>
                  </div>
                </div>

                {/* Provenance Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="border-b border-neutral-200 text-neutral-500 font-semibold">
                        <th className="py-2.5 px-3">المؤشر</th>
                        <th className="py-2.5 px-3">القيمة المعتمدة</th>
                        <th className="py-2.5 px-3">حالة التدقيق</th>
                        <th className="py-2.5 px-3">معرف الإثبات (Audit ID)</th>
                        <th className="py-2.5 px-3 text-left">الإجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {filteredProvenanceRecords.map((p, idx) => (
                        <tr key={idx} className="hover:bg-neutral-50">
                          <td className="py-2.5 px-3 font-bold text-neutral-900">{p.metricLabel}</td>
                          <td className="py-2.5 px-3 text-neutral-800 font-medium">
                            {p.calculatedValue !== null
                              ? `${typeof p.calculatedValue === 'number' ? p.calculatedValue.toLocaleString('ar-SA') : p.calculatedValue} ${companySettings.currency}`
                              : 'محجوب بأمان'}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`text-[11px] font-semibold ${
                              p.validationStatus === 'VALIDATED' ? 'text-emerald-700' : 'text-amber-800'
                            }`}>
                              {p.validationStatus === 'VALIDATED' ? 'مثبت ومحقق' : 'محجوب لغياب التكلفة'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-neutral-400 font-mono text-[11px]">{p.provenanceId}</td>
                          <td className="py-2.5 px-3 text-left">
                            <button
                              type="button"
                              onClick={() => {
                                setEvidenceDrawerData({
                                  title: `إثبات ${p.metricLabel}`,
                                  metricLabel: p.metricLabel,
                                  value: p.calculatedValue,
                                  currency: companySettings.currency,
                                  period: 'الفترة المسجلة في السجلات',
                                  source: activeSourceName || 'سجلات الشركة',
                                  readTime: p.timestamp,
                                  isComplete: p.validationStatus === 'VALIDATED',
                                  statusMessage: p.reason || (p.validationStatus === 'VALIDATED' ? 'مثبت ومحقق' : 'محجوب بأمان'),
                                  advancedDetails: {
                                    auditId: p.provenanceId,
                                    sourceTable: p.sourceTable,
                                    sqlQuery: p.sqlQuery,
                                  },
                                });
                                setIsEvidenceDrawerOpen(true);
                              }}
                              className="text-xs font-semibold text-neutral-900 underline hover:text-neutral-700"
                            >
                              عرض الدليل
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-neutral-200 rounded-2xl p-10 text-center space-y-3">
                <FileText className="w-8 h-8 text-neutral-400 mx-auto" />
                <h4 className="text-sm font-bold text-neutral-900">البيانات بانتظار الربط</h4>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                  تظهر سجلات الإثبات والتقارير الموثقة فور فحص واعتماد مصدر بيانات شركتك.
                </p>
                <button
                  onClick={() => setIsConnectModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 mt-2"
                >
                  ربط بيانات الشركة
                </button>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 4: ALERTS ================= */}
        {activeTab === 'alerts' && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold text-neutral-900">التنبيهات والملاحظات الرقابية</h2>
              <p className="text-xs text-neutral-500">
                مؤشرات حقيقية استنتجها النظام من واقع السجلات تتطلب تدخلاً أو متابعة
              </p>
            </div>

            {isConnected && metrics ? (
              <div className="space-y-3">
                {/* Critical Inventory */}
                {metrics.inventoryItems.filter((i) => i.status === 'critical').map((item, idx) => (
                  <div key={idx} className="bg-white border border-neutral-200 rounded-2xl p-4 flex items-start justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-rose-700">مخزون حرج جداً: {item.name}</span>
                        <span className="text-[10px] text-neutral-400">· السجلات المعتمدة</span>
                      </div>
                      <p className="text-neutral-600">
                        الكمية المتبقية {item.stock} وحدات. يوصى بمراجعة أوامر التوريد لتجنب انقطاع المبيعات.
                      </p>
                    </div>
                    <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded shrink-0">
                      حرج
                    </span>
                  </div>
                ))}

                {/* Low Inventory */}
                {metrics.inventoryItems.filter((i) => i.status === 'low').map((item, idx) => (
                  <div key={idx} className="bg-white border border-neutral-200 rounded-2xl p-4 flex items-start justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-amber-800">مخزون منخفض: {item.name}</span>
                        <span className="text-[10px] text-neutral-400">· السجلات المعتمدة</span>
                      </div>
                      <p className="text-neutral-600">
                        الكمية المتاحة {item.stock} وحدات تقترب من حد إعادة الطلب.
                      </p>
                    </div>
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded shrink-0">
                      تحذير
                    </span>
                  </div>
                ))}

                {/* Slow Moving */}
                {metrics.slowMovingProducts.length > 0 && (
                  <div className="bg-white border border-neutral-200 rounded-2xl p-4 flex items-start justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-neutral-900">منتجات بطيئة الحركة</span>
                        <span className="text-[10px] text-neutral-400">· حركة المبيعات</span>
                      </div>
                      <p className="text-neutral-600">
                        تم رصد {metrics.slowMovingProducts.length} أصناف برصيد مبيعات منخفض مقابل مخزون متوفر. يوصى بتنشيط مبيعاتها.
                      </p>
                    </div>
                    <span className="text-[10px] font-bold text-neutral-700 bg-neutral-100 px-2 py-0.5 rounded shrink-0">
                      تحذير
                    </span>
                  </div>
                )}

                {/* Empty State when no alerts in data */}
                {metrics.inventoryItems.filter((i) => i.status !== 'normal').length === 0 && metrics.slowMovingProducts.length === 0 && (
                  <div className="bg-white border border-neutral-200 rounded-2xl p-10 text-center space-y-2">
                    <CheckCircle2 className="w-7 h-7 text-emerald-600 mx-auto" />
                    <h4 className="text-xs font-bold text-neutral-900">لا توجد ملاحظات رقابية حرجة في السجلات الحالية</h4>
                    <p className="text-xs text-neutral-500">
                      جميع الأصناف والمؤشرات المفحوصة تقع ضمن النطاقات الآمنة.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white border border-neutral-200 rounded-2xl p-10 text-center space-y-3">
                <Bell className="w-8 h-8 text-neutral-400 mx-auto" />
                <h4 className="text-sm font-bold text-neutral-900">لا توجد تنبيهات حالياً</h4>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                  تظهر التنبيهات تلقائياً عند فحص بيانات المخزون والمبيعات والمصروفات الفعلية.
                </p>
                <button
                  onClick={() => setIsConnectModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 mt-2"
                >
                  ربط بيانات الشركة
                </button>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 5: DATA SOURCES (EXECUTIVE CATALOG) ================= */}
        {activeTab === 'source' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-neutral-900">إدارة مصادر بيانات الشركة</h2>
                <p className="text-xs text-neutral-500">
                  دليل الموصلات الشامل ({CONNECTOR_CATALOG.length} موصلاً) وحالة التحقق من القراءة فقط
                </p>
              </div>

              {isConnected && (
                <button
                  onClick={handleDisconnect}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-neutral-100 text-neutral-700 hover:text-rose-700 hover:bg-rose-50 transition-colors self-start sm:self-auto"
                >
                  فصل الاتصال النشط
                </button>
              )}
            </div>

            {/* Active Connected Source Banner */}
            {isConnected ? (
              <div className="bg-white border border-neutral-200 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-neutral-900 text-white flex items-center justify-center">
                      <Database className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-neutral-900">{activeSourceName}</h3>
                      <div className="text-xs text-neutral-500 mt-0.5">
                        {activeSourceType} · آخر قراءة: {lastReadTimestamp}
                      </div>
                    </div>
                  </div>

                  <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                    متصل ومحصن 100%
                  </span>
                </div>

                {/* Capabilities check */}
                {discovery && (
                  <div className="pt-3 border-t border-neutral-100 space-y-2">
                    <span className="text-xs font-bold text-neutral-900 block">القدرات المحاسبية المعتمدة في هذا المصدر:</span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="p-2.5 bg-neutral-50 rounded-lg border border-neutral-200 flex items-center justify-between">
                        <span>المبيعات</span>
                        <span className="font-semibold text-emerald-700">معتمدة</span>
                      </div>
                      <div className="p-2.5 bg-neutral-50 rounded-lg border border-neutral-200 flex items-center justify-between">
                        <span>المنتجات</span>
                        <span className="font-semibold text-emerald-700">معتمدة</span>
                      </div>
                      <div className="p-2.5 bg-neutral-50 rounded-lg border border-neutral-200 flex items-center justify-between">
                        <span>العملاء</span>
                        <span className="font-semibold text-emerald-700">معتمدة</span>
                      </div>
                      <div className="p-2.5 bg-neutral-50 rounded-lg border border-neutral-200 flex items-center justify-between">
                        <span>الأرباح</span>
                        <span className={`font-semibold ${discovery.capabilities.profitSupported ? 'text-emerald-700' : 'text-neutral-500'}`}>
                          {discovery.capabilities.profitSupported ? 'بالتكاليف' : 'محجوب لغياب التكلفة'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white border border-neutral-200 rounded-2xl p-6 text-center space-y-3">
                <Database className="w-8 h-8 text-neutral-400 mx-auto" />
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-neutral-900">لا يوجد مصدر بيانات متصل حالياً</h3>
                  <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                    اختر أحد الموصلات المعتمدة أدناه لبدء فحص السجلات وتأمين القراءة فقط.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedConnector(null);
                    setIsConnectModalOpen(true);
                  }}
                  className="px-4 py-2 bg-neutral-900 text-white rounded-xl text-xs font-semibold hover:bg-neutral-800"
                >
                  ربط مصدر بيانات جديد
                </button>
              </div>
            )}

            {/* FULL CONNECTORS DIRECTORY (Strict 18 Connectors with Truthful Status) */}
            <div className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-3 border-b border-neutral-100">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute right-3 top-3 text-neutral-400" />
                  <input
                    type="text"
                    value={sourceSearchTerm}
                    onChange={(e) => setSourceSearchTerm(e.target.value)}
                    placeholder="بحث في الموصلات وقواعد البيانات والأنظمة..."
                    className="w-full pr-8 pl-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-900"
                  />
                </div>

                <div className="flex items-center gap-1 overflow-x-auto text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setActiveCategoryFilter('all')}
                    className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                      activeCategoryFilter === 'all' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }`}
                  >
                    الكل ({CONNECTOR_CATALOG.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveCategoryFilter('file')}
                    className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                      activeCategoryFilter === 'file' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }`}
                  >
                    الملفات (4)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveCategoryFilter('database')}
                    className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                      activeCategoryFilter === 'database' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }`}
                  >
                    خوادم SQL (5)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveCategoryFilter('accounting_erp')}
                    className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                      activeCategoryFilter === 'accounting_erp' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }`}
                  >
                    أنظمة ERP (5)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveCategoryFilter('pos_ecommerce')}
                    className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                      activeCategoryFilter === 'pos_ecommerce' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }`}
                  >
                    نقاط البيع (3)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveCategoryFilter('cloud_storage')}
                    className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                      activeCategoryFilter === 'cloud_storage' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }`}
                  >
                    السحابية (1)
                  </button>
                </div>
              </div>

              {/* Table of Connectors */}
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-neutral-200 text-neutral-500 font-semibold">
                      <th className="py-2.5 px-3">اسم المصدر</th>
                      <th className="py-2.5 px-3">نوع المصدر</th>
                      <th className="py-2.5 px-3">الحالة</th>
                      <th className="py-2.5 px-3">آخر قراءة حقيقية</th>
                      <th className="py-2.5 px-3">حالة البيانات</th>
                      <th className="py-2.5 px-3 text-left">الإجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {filteredConnectors.map((connector) => {
                      const isThisActive = isConnected && (
                        (connector.id === 'sqlite_file' && activeSourceType.includes('SQLite')) ||
                        (connector.id === 'excel_file' && activeSourceType.includes('Excel')) ||
                        (connector.id === 'csv_file' && activeSourceType.includes('CSV')) ||
                        (connector.id === 'postgresql' && activeSourceType.includes('PostgreSQL')) ||
                        (connector.id === 'mysql' && activeSourceType.includes('MySQL'))
                      );

                      // Allowed States: 'متصل' | 'غير متصل' | 'بانتظار الإعداد' | 'بيانات جزئية' | 'فشل آخر قراءة'
                      let statusText = 'غير متصل';
                      let statusColor = 'text-neutral-500';

                      if (isThisActive) {
                        if (metrics?.grossProfit === null && discovery?.capabilities?.profitSupported === false) {
                          statusText = 'بيانات جزئية';
                          statusColor = 'text-amber-800';
                        } else {
                          statusText = 'متصل';
                          statusColor = 'text-emerald-700 font-bold';
                        }
                      } else if (!connector.isImplemented) {
                        statusText = 'بانتظار الإعداد';
                        statusColor = 'text-neutral-400';
                      }

                      const lastRead = isThisActive ? lastReadTimestamp : '—';
                      const dataCondition = isThisActive
                        ? (metrics?.grossProfit !== null ? 'معتمد ومثبت' : 'بيانات جزئية (غياب التكلفة)')
                        : (!connector.isImplemented ? 'غير متاح في البيئة' : 'بانتظار ربط البيانات');

                      return (
                        <tr key={connector.id} className="hover:bg-neutral-50">
                          <td className="py-3 px-3">
                            <div className="font-bold text-neutral-900">{connector.name}</div>
                            <div className="text-[11px] text-neutral-500 line-clamp-1">{connector.description}</div>
                          </td>
                          <td className="py-3 px-3 text-neutral-600">{connector.categoryLabel}</td>
                          <td className="py-3 px-3">
                            <span className={`text-[11px] font-semibold ${statusColor}`}>
                              {statusText}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-neutral-500 font-mono text-[11px]">{lastRead}</td>
                          <td className="py-3 px-3 text-neutral-600">{dataCondition}</td>
                          <td className="py-3 px-3 text-left">
                            {isThisActive ? (
                              <button
                                type="button"
                                onClick={handleDisconnect}
                                className="text-xs font-semibold text-rose-700 hover:text-rose-900"
                              >
                                فصل
                              </button>
                            ) : connector.isImplemented ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedConnector(connector);
                                  setIsConnectModalOpen(true);
                                }}
                                className="text-xs font-semibold text-neutral-900 underline hover:text-neutral-700"
                              >
                                اتصال
                              </button>
                            ) : (
                              connector.officialIntegrationDoc ? (
                                <a
                                  href={connector.officialIntegrationDoc}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs font-semibold text-neutral-500 hover:text-neutral-900 inline-flex items-center gap-1"
                                >
                                  <span>التوثيق</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              ) : (
                                <span className="text-neutral-400 text-xs">قيد التجهيز</span>
                              )
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-neutral-200 bg-white py-4 text-xs text-neutral-500">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-neutral-900">مستشار ذكاء الشركة</span>
            <span>·</span>
            <span>الحقيقة قبل الذكاء</span>
          </div>
          <div>
            طبقة ذكاء تنفيذي بدون استنتاجات تقديرية أو Mock Data
          </div>
        </div>
      </footer>

      {/* ================= EVIDENCE DRAWER ================= */}
      <EvidenceDrawer
        isOpen={isEvidenceDrawerOpen}
        onClose={() => setIsEvidenceDrawerOpen(false)}
        data={evidenceDrawerData}
      />

      {/* ================= MODAL: UNIVERSAL APPLICATION CONNECTORS ================= */}
      <UniversalConnectModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        onConnectSuccess={handleUniversalConnectSuccess}
      />

      {/* ================= MODAL: DEVELOPER DIAGNOSTIC & AUDIT (M4.5) ================= */}
      <DeveloperAuditModal
        isOpen={isDeveloperAuditModalOpen}
        onClose={() => setIsDeveloperAuditModalOpen(false)}
        latestReport={latestDiagnosticReport}
        metricsAvailable={Boolean(metrics)}
        hasCostData={Boolean(discovery?.capabilities.profitSupported)}
      />

      {/* ================= MODAL: COMPANY SETTINGS ================= */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/40 backdrop-blur-xs">
          <div className="bg-white border border-neutral-200 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between border-b border-neutral-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-neutral-900">إعدادات ملف المنشأة</h3>
                <p className="text-xs text-neutral-500">تخصيص الهوية والعملة المعتمدة في المؤشرات</p>
              </div>
              <button
                onClick={() => setIsSettingsModalOpen(false)}
                className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-neutral-700 block mb-1">اسم المنشأة أو الشركة</label>
                <input
                  type="text"
                  value={companySettings.companyName}
                  onChange={(e) => setCompanySettings({ ...companySettings, companyName: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:border-neutral-900"
                />
              </div>

              <div>
                <label className="font-semibold text-neutral-700 block mb-1">العملة الأساسية</label>
                <select
                  value={companySettings.currency}
                  onChange={(e) => setCompanySettings({ ...companySettings, currency: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:border-neutral-900 bg-white"
                >
                  <option value="ريال">ريال سعودي (SAR)</option>
                  <option value="درهم">درهم إماراتي (AED)</option>
                  <option value="دينار">دينار كويتي (KWD)</option>
                  <option value="دولار">دولار أمريكي (USD)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-neutral-700 block mb-1">قطاع النشاط</label>
                <input
                  type="text"
                  value={companySettings.industry}
                  onChange={(e) => setCompanySettings({ ...companySettings, industry: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:border-neutral-900"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsSettingsModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 transition-colors shadow-xs"
              >
                حفظ الإعدادات
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
