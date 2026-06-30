import { FileText, PieChart, LineChart, Target } from 'lucide-react';

export type StoredReportTemplate = {
  id: number;
  name: string;
  description: string;
  category: string;
  type: string;
  frequency: string;
  lastGenerated?: string;
  nextScheduled?: string;
  recipients: number;
  format: 'csv' | 'pdf' | 'excel';
  size: string;
  iconKey: 'FileText' | 'PieChart' | 'LineChart' | 'Target';
  color: string;
  metrics: string[];
  isActive: boolean;
};

export type ReportTemplate = StoredReportTemplate & {
  icon: typeof FileText;
};

const ICON_MAP = {
  FileText,
  PieChart,
  LineChart,
  Target,
} as const;

export const REPORT_TEMPLATES_STORAGE_KEY = 'coursify_report_templates';

export const DEFAULT_REPORT_TEMPLATES: StoredReportTemplate[] = [
  {
    id: 1,
    name: 'Enrollment Summary',
    description: 'All enrollments with progress and completion status',
    category: 'summary',
    type: 'on-demand',
    frequency: 'Manual',
    recipients: 0,
    format: 'csv',
    size: '—',
    iconKey: 'FileText',
    color: 'blue',
    metrics: ['Enrollments', 'Progress %', 'Completion'],
    isActive: true,
  },
  {
    id: 2,
    name: 'Course Completion Rate',
    description: 'Completion rates grouped by course',
    category: 'completion',
    type: 'scheduled',
    frequency: 'Weekly',
    recipients: 1,
    format: 'excel',
    size: '—',
    iconKey: 'PieChart',
    color: 'green',
    metrics: ['Completion %', 'Completed learners'],
    isActive: true,
  },
  {
    id: 3,
    name: 'Learner Progress',
    description: 'Individual learner progress across courses',
    category: 'performance',
    type: 'on-demand',
    frequency: 'Manual',
    recipients: 0,
    format: 'csv',
    size: '—',
    iconKey: 'LineChart',
    color: 'purple',
    metrics: ['Progress %', 'Last active'],
    isActive: false,
  },
  {
    id: 4,
    name: 'Compliance Snapshot',
    description: 'Learners who have not completed required courses',
    category: 'compliance',
    type: 'scheduled',
    frequency: 'Monthly',
    recipients: 2,
    format: 'pdf',
    size: '—',
    iconKey: 'Target',
    color: 'orange',
    metrics: ['Incomplete enrollments', 'Due date'],
    isActive: false,
  },
];

export function hydrateReportTemplate(stored: StoredReportTemplate): ReportTemplate {
  return {
    ...stored,
    icon: ICON_MAP[stored.iconKey] ?? FileText,
  };
}

export function dehydrateReportTemplate(report: ReportTemplate): StoredReportTemplate {
  const { icon: _icon, ...rest } = report;
  return rest;
}

export function loadReportTemplates(): ReportTemplate[] {
  if (typeof window === 'undefined') {
    return DEFAULT_REPORT_TEMPLATES.map(hydrateReportTemplate);
  }
  try {
    const raw = localStorage.getItem(REPORT_TEMPLATES_STORAGE_KEY);
    if (!raw) return DEFAULT_REPORT_TEMPLATES.map(hydrateReportTemplate);
    const parsed = JSON.parse(raw) as StoredReportTemplate[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return DEFAULT_REPORT_TEMPLATES.map(hydrateReportTemplate);
    }
    return parsed.map(hydrateReportTemplate);
  } catch {
    return DEFAULT_REPORT_TEMPLATES.map(hydrateReportTemplate);
  }
}

export function saveReportTemplates(reports: ReportTemplate[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      REPORT_TEMPLATES_STORAGE_KEY,
      JSON.stringify(reports.map(dehydrateReportTemplate)),
    );
  } catch {
    // ignore quota errors
  }
}
