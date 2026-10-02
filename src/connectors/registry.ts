import { ConnectorMetadata, SourceCategory } from './types';

export const CONNECTOR_CATALOG: ConnectorMetadata[] = [
  // 1. Files
  {
    id: 'sqlite_file',
    name: 'ملف قاعدة بيانات SQLite (.db / .sqlite)',
    category: 'file',
    categoryLabel: 'الملفات وقواعد البيانات المحلية',
    description: 'قراءة وفحص ملفات SQLite المحلية مباشرة في بيئة معزولة ومحصنة للقراءة فقط 100%.',
    isImplemented: true,
    supportedFormats: ['.db', '.sqlite', '.sqlite3'],
  },
  {
    id: 'excel_file',
    name: 'جداول Excel (.xlsx / .xls)',
    category: 'file',
    categoryLabel: 'الملفات وقواعد البيانات المحلية',
    description: 'استيراد وفحص جداول المبيعات والمصروفات من مصنفات إكسل الفعلية.',
    isImplemented: true,
    supportedFormats: ['.xlsx', '.xls'],
  },
  {
    id: 'csv_file',
    name: 'ملفات CSV المجدولة',
    category: 'file',
    categoryLabel: 'الملفات وقواعد البيانات المحلية',
    description: 'تحليل السجلات المصدرة من أي نظام تجاري بصيغة CSV القياسية.',
    isImplemented: true,
    supportedFormats: ['.csv'],
  },
  {
    id: 'json_file',
    name: 'ملفات البيانات المهيكلة JSON',
    category: 'file',
    categoryLabel: 'الملفات وقواعد البيانات المحلية',
    description: 'استخراج السجلات والبيانات المصدرة بصيغة كائنات ومصفوفات JSON.',
    isImplemented: true,
    supportedFormats: ['.json'],
  },

  // 2. Relational SQL Databases
  {
    id: 'postgresql',
    name: 'خادم PostgreSQL',
    category: 'database',
    categoryLabel: 'قواعد البيانات العلائقية (SQL)',
    description: 'الاتصال المباشر بخادم PostgreSQL بصلاحية القراءة فقط عبر بروتوكول آمن.',
    isImplemented: true,
    requiresServerProxy: true,
  },
  {
    id: 'mysql',
    name: 'خادم MySQL / MariaDB',
    category: 'database',
    categoryLabel: 'قواعد البيانات العلائقية (SQL)',
    description: 'ربط مباشر لقواعد بيانات MySQL واستخراج سجلات المعاملات بأمان.',
    isImplemented: true,
    requiresServerProxy: true,
  },
  {
    id: 'sqlserver',
    name: 'Microsoft SQL Server',
    category: 'database',
    categoryLabel: 'قواعد البيانات العلائقية (SQL)',
    description: 'التكامل مع قواعد بيانات MS SQL Server لأنظمة المؤسسات.',
    isImplemented: true,
    requiresServerProxy: true,
  },
  {
    id: 'oracle_db',
    name: 'Oracle Database',
    category: 'database',
    categoryLabel: 'قواعد البيانات العلائقية (SQL)',
    description: 'الاتصال بقواعد بيانات أوراكل المؤسسية.',
    isImplemented: false,
    officialIntegrationDoc: 'https://docs.oracle.com/database/',
  },
  {
    id: 'firebird',
    name: 'Firebird SQL',
    category: 'database',
    categoryLabel: 'قواعد البيانات العلائقية (SQL)',
    description: 'قواعد بيانات فايربيرد الشائعة في أنظمة المحاسبة ونقاط البيع المحلية.',
    isImplemented: false,
  },

  // 3. Accounting & ERP Systems
  {
    id: 'odoo_erp',
    name: 'أودو (Odoo ERP)',
    category: 'accounting_erp',
    categoryLabel: 'أنظمة المحاسبة وإدارة المؤسسات (ERP)',
    description: 'الربط المباشر مع واجهة XML-RPC / JSON-API الرسمية لنظام أودو لقراءة المبيعات والفواتير.',
    isImplemented: true,
    officialIntegrationDoc: 'https://www.odoo.com/documentation/master/developer/reference/external_api.html',
  },
  {
    id: 'quickbooks',
    name: 'QuickBooks Online',
    category: 'accounting_erp',
    categoryLabel: 'أنظمة المحاسبة وإدارة المؤسسات (ERP)',
    description: 'تكامل محاسبي مع واجهة Intuit QuickBooks API عبر بروتوكول OAuth 2.0.',
    isImplemented: false,
    officialIntegrationDoc: 'https://developer.intuit.com/app/developer/qbo/docs/api',
  },
  {
    id: 'xero',
    name: 'Xero Accounting',
    category: 'accounting_erp',
    categoryLabel: 'أنظمة المحاسبة وإدارة المؤسسات (ERP)',
    description: 'قراءة الحسابات والفواتير عبر واجهة Xero API الرسمية.',
    isImplemented: false,
    officialIntegrationDoc: 'https://developer.xero.com/documentation/api/accounting/overview',
  },
  {
    id: 'zoho_books',
    name: 'Zoho Books',
    category: 'accounting_erp',
    categoryLabel: 'أنظمة المحاسبة وإدارة المؤسسات (ERP)',
    description: 'استخراج قيود اليومية وتقارير المبيعات عبر Zoho Books REST API.',
    isImplemented: false,
    officialIntegrationDoc: 'https://www.zoho.com/books/api/v3/',
  },
  {
    id: 'sap_business_one',
    name: 'SAP Business One',
    category: 'accounting_erp',
    categoryLabel: 'أنظمة المحاسبة وإدارة المؤسسات (ERP)',
    description: 'التكامل المؤسسي مع SAP Service Layer لقراءة بيانات الشركات الضخمة.',
    isImplemented: false,
    officialIntegrationDoc: 'https://help.sap.com/viewer/product/SAP_BUSINESS_ONE/',
  },

  // 4. POS & Ecommerce
  {
    id: 'pos_system',
    name: 'أنظمة نقاط البيع المحلية (POS)',
    category: 'pos_ecommerce',
    categoryLabel: 'نقاط البيع والمتاجر الإلكترونية',
    description: 'قراءة فورية ومباشرة من قواعد بيانات وسجلات أجهزة نقاط البيع بفروعك.',
    isImplemented: true,
  },
  {
    id: 'salla',
    name: 'منصة سلة (Salla)',
    category: 'pos_ecommerce',
    categoryLabel: 'نقاط البيع والمتاجر الإلكترونية',
    description: 'الربط السحابي مع واجهة منصة سلة وقراءة طلبات المتجر تلقائياً.',
    isImplemented: false,
    officialIntegrationDoc: 'https://docs.salla.dev/',
  },
  {
    id: 'zid',
    name: 'منصة زد (Zid)',
    category: 'pos_ecommerce',
    categoryLabel: 'نقاط البيع والمتاجر الإلكترونية',
    description: 'التكامل عبر Zid App Marketplace لاستيراد الفواتير والعملاء.',
    isImplemented: false,
    officialIntegrationDoc: 'https://docs.zid.sa/',
  },

  // 5. Cloud Storage
  {
    id: 'google_sheets',
    name: 'جداول بيانات Google Sheets',
    category: 'cloud_storage',
    categoryLabel: 'المصادر السحابية المشتركة',
    description: 'استيراد السجلات مباشرة من جداول جوجل السحابية عبر OAuth الآمن.',
    isImplemented: false,
    officialIntegrationDoc: 'https://developers.google.com/sheets/api',
  },
];

export function getConnectorsByCategory(): Record<string, { label: string; connectors: ConnectorMetadata[] }> {
  const result: Record<string, { label: string; connectors: ConnectorMetadata[] }> = {
    file: { label: 'الملفات وقواعد البيانات المحلية', connectors: [] },
    database: { label: 'قواعد البيانات العلائقية (SQL)', connectors: [] },
    accounting_erp: { label: 'أنظمة المحاسبة وإدارة المؤسسات (ERP)', connectors: [] },
    pos_ecommerce: { label: 'نقاط البيع والمتاجر الإلكترونية', connectors: [] },
    cloud_storage: { label: 'المصادر السحابية المشتركة', connectors: [] },
  };

  for (const item of CONNECTOR_CATALOG) {
    if (!result[item.category]) {
      result[item.category] = { label: item.categoryLabel || item.category, connectors: [] };
    }
    result[item.category].connectors.push(item);
  }

  return result;
}
