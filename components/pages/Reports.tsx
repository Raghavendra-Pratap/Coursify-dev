'use client'

import React, { useState, useEffect } from 'react';
import { 
  FileText, Download, Filter, Calendar, Send, Eye, Edit, Trash2,
  TrendingUp, CheckCircle, AlertCircle, Target, BookOpen,
  Mail, Share2, Copy, RefreshCw, ChevronDown, ChevronUp,
  Printer, FileDown, Save, Star, Zap, Activity, Percent,
  MoreVertical, X, Upload, PieChart, LineChart, Plus, Search
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { exportReportTable, type ReportExportFormat } from '@/lib/export-report';
import {
  type ReportTemplate,
  loadReportTemplates,
  saveReportTemplates,
} from '@/lib/report-templates';
import { ThemeStatCard, ThemeFilterTab } from '@/components/ui/ThemeStatCard';
import { headerPrimaryBtn, headerSecondaryBtn, iconBtn, pageHeaderActions, primaryBtn } from '@/components/ui/theme-classes';

const Reports: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [reportToSchedule, setReportToSchedule] = useState<any>(null);
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
  const [reportName, setReportName] = useState('');
  const [reportType, setReportType] = useState('completion');
  const [dateRange, setDateRange] = useState('30days');
  const [includeCharts, setIncludeCharts] = useState(true);
  const [scheduleFrequency, setScheduleFrequency] = useState('weekly');
  const [scheduleDay, setScheduleDay] = useState('monday');
  const [recipientEmails, setRecipientEmails] = useState('');
  const [reportMessage, setReportMessage] = useState<string | null>(null);
  const [reportExportFormat, setReportExportFormat] = useState<ReportExportFormat>('csv');
  const [showAllGenerated, setShowAllGenerated] = useState(false);

  type ReportItem = ReportTemplate;

  const [reports, setReports] = useState<ReportItem[]>([]);
  const [templatesLoaded, setTemplatesLoaded] = useState(false);

  useEffect(() => {
    setReports(loadReportTemplates());
    setTemplatesLoaded(true);
  }, []);

  useEffect(() => {
    if (!templatesLoaded) return;
    saveReportTemplates(reports);
  }, [reports, templatesLoaded]);

  // Recent generated reports (empty until report generation is implemented)
  const recentReports: { name: string; date: string; size: string; status: string }[] = [];

  // Stats
  const stats = {
    totalReports: reports.length,
    scheduledReports: reports.filter(r => r.type === 'scheduled').length,
    activeSchedules: reports.filter(r => r.isActive).length,
    recentlyGenerated: recentReports.length
  };

  // Filter reports
  const getFilteredReports = () => {
    let filtered = reports;

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(r => r.category === selectedCategory);
    }

    if (searchQuery) {
      filtered = filtered.filter(r => 
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered;
  };

  const filteredReports = getFilteredReports();

  const fetchEnrollmentReportRows = async () => {
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('id, user_id, course_id, progress_percentage, completed_at, enrolled_at');
    const { data: courses } = await supabase.from('courses').select('id, title');
    const { data: profiles } = await supabase.from('user_profiles').select('id, full_name, organization');
    const courseMap = new Map((courses ?? []).map((c) => [c.id, c.title]));
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, { name: p.full_name ?? '', org: p.organization ?? '' }]));
    const rows = (enrollments ?? []).map((e) => {
      const profile = profileMap.get(e.user_id);
      return {
        course: courseMap.get(e.course_id) ?? e.course_id,
        learner: profile?.name || e.user_id,
        department: profile?.org || '—',
        progress: e.progress_percentage ?? 0,
        completed: e.completed_at ? 'Yes' : 'No',
        enrolled_at: e.enrolled_at ?? '',
      };
    });
    return {
      headers: ['Course', 'Learner', 'Department', 'Progress %', 'Completed', 'Enrolled At'],
      rows: rows.map((r) => [r.course, r.learner, r.department, r.progress, r.completed, r.enrolled_at]),
    };
  };

  const downloadEnrollmentsReport = async (filename: string, format: ReportExportFormat = 'csv') => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      setReportMessage('Configure Supabase to generate reports.');
      setTimeout(() => setReportMessage(null), 4000);
      return;
    }
    try {
      const { headers, rows } = await fetchEnrollmentReportRows();
      exportReportTable(format, filename, filename, headers, rows);
      const label = format === 'pdf' ? 'PDF print dialog opened' : `${format.toUpperCase()} downloaded`;
      setReportMessage(`Report "${filename}" — ${label}.`);
      setTimeout(() => setReportMessage(null), 4000);
    } catch {
      setReportMessage('Failed to generate report.');
      setTimeout(() => setReportMessage(null), 4000);
    }
  };

  const handleCreateReport = async () => {
    const name = reportName || 'enrollment-report';
    await downloadEnrollmentsReport(name, reportExportFormat);
    const created: ReportItem = {
      id: Date.now(),
      name,
      description: 'Custom enrollment export',
      category: 'summary',
      type: 'on-demand',
      frequency: 'Manual',
      recipients: 0,
      format: reportExportFormat,
      size: '—',
      iconKey: 'FileText',
      icon: FileText,
      color: 'blue',
      metrics: ['Enrollments', 'Progress %'],
      isActive: false,
      lastGenerated: new Date().toLocaleDateString(),
    };
    setReports((prev) => [created, ...prev]);
    setShowCreateModal(false);
    setReportName('');
  };

  const handleGenerateReport = async (reportId: number) => {
    const report = reports.find(r => r.id === reportId);
    setActiveDropdown(null);
    await downloadEnrollmentsReport(report?.name ?? 'enrollment-report', report?.format ?? 'csv');
    setReports((prev) =>
      prev.map((r) =>
        r.id === reportId ? { ...r, lastGenerated: new Date().toLocaleDateString() } : r,
      ),
    );
  };

  const handleScheduleReport = (report: any) => {
    setReportToSchedule(report);
    setShowScheduleModal(true);
  };

  const handleDeleteReport = (reportId: number) => {
    setReports(reports.filter(r => r.id !== reportId));
    setActiveDropdown(null);
  };

  const handleDuplicateReport = (report: ReportItem) => {
    const copy: ReportItem = {
      ...report,
      id: Date.now(),
      name: `${report.name} (Copy)`,
      isActive: false,
      lastGenerated: undefined,
      nextScheduled: undefined,
    };
    setReports((prev) => [...prev, copy]);
    setActiveDropdown(null);
    setReportMessage(`Duplicated "${report.name}".`);
    setTimeout(() => setReportMessage(null), 4000);
  };

  const handleEditTemplate = (report: ReportItem) => {
    setReportName(report.name);
    setReportType(report.type);
    setReportExportFormat(report.format);
    setShowCreateModal(true);
    setActiveDropdown(null);
  };

  const handlePreviewReport = async (reportId: number) => {
    setActiveDropdown(null);
    setReportMessage('Generating preview…');
    await downloadEnrollmentsReport(reports.find((r) => r.id === reportId)?.name ?? 'enrollment-report', reports.find((r) => r.id === reportId)?.format ?? 'csv');
  };

  const handleToggleActive = (reportId: number) => {
    setReports(reports.map(r =>
      r.id === reportId ? { ...r, isActive: !r.isActive } : r
    ));
  };

  const saveSchedule = () => {
    if (reportToSchedule) {
      setReportMessage(`Schedule saved for "${reportToSchedule.name}". Cron can call GET /api/reports/generate with Authorization: Bearer CRON_SECRET.`);
      setTimeout(() => setReportMessage(null), 6000);
    }
    setShowScheduleModal(false);
    setReportToSchedule(null);
  };

  const templateVariant: Record<string, 'info' | 'success' | 'warning' | 'neutral' | 'accent'> = {
    blue: 'info',
    green: 'success',
    purple: 'neutral',
    orange: 'warning',
    yellow: 'warning',
    indigo: 'info',
    pink: 'neutral',
    teal: 'info',
  };
  const root = (
    <div>
      {reportMessage && (
        <div className="bg-green-50 dark:bg-green-900/30 border-b border-green-200 dark:border-green-800 px-8 py-2 text-sm text-green-800 dark:text-green-200">
          {reportMessage}
        </div>
      )}
      {/* Header */}
      <div className="bg-surface border-b border-line px-8 py-6 sticky top-0 z-20">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-content">Reports</h1>
            <p className="text-content-secondary mt-1">Generate and schedule automated learning reports</p>
          </div>
          <div className={pageHeaderActions}>
            <button
              type="button"
              onClick={() => downloadEnrollmentsReport('enrollment-report', 'csv')}
              className={headerSecondaryBtn}
            >
              <Download className="w-5 h-5" />
              Export Enrollments CSV
            </button>
            <button 
              onClick={() => setShowCreateModal(true)}
              className={headerPrimaryBtn}
            >
              <Plus className="w-5 h-5" />
              Create Report
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          <ThemeStatCard icon={FileText} title="Total Reports" value={stats.totalReports} variant="info" />
          <ThemeStatCard icon={Calendar} title="Scheduled" value={stats.scheduledReports} variant="success" />
          <ThemeStatCard icon={Activity} title="Active" value={stats.activeSchedules} variant="neutral" />
          <ThemeStatCard icon={CheckCircle} title="Generated" value={stats.recentlyGenerated} variant="warning" />
        </div>

        {/* Categories and Search */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <ThemeFilterTab active={selectedCategory === 'all'} onClick={() => setSelectedCategory('all')}>
              All Reports
            </ThemeFilterTab>
            <ThemeFilterTab active={selectedCategory === 'summary'} onClick={() => setSelectedCategory('summary')}>
              Summary
            </ThemeFilterTab>
            <ThemeFilterTab active={selectedCategory === 'completion'} onClick={() => setSelectedCategory('completion')}>
              Completion
            </ThemeFilterTab>
            <ThemeFilterTab active={selectedCategory === 'compliance'} onClick={() => setSelectedCategory('compliance')}>
              Compliance
            </ThemeFilterTab>
            <ThemeFilterTab active={selectedCategory === 'performance'} onClick={() => setSelectedCategory('performance')}>
              Performance
            </ThemeFilterTab>
          </div>

          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-content-muted" />
            <input 
              type="text" 
              placeholder="Search reports..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 border border-line bg-surface text-content dark:placeholder-gray-400 rounded-lg w-64 focus:ring-2 focus:ring-brand focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-8">
        {/* Recent Generated Reports */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Recently Generated</h2>
            <button
              type="button"
              onClick={() => {
                if (recentReports.length === 0) setShowCreateModal(true);
                else setShowAllGenerated((v) => !v);
              }}
              className="text-accent hover:opacity-80 text-sm font-semibold"
            >
              {showAllGenerated ? 'Show less' : 'View All →'}
            </button>
          </div>
          <div className="grid grid-cols-4 gap-4">
            {recentReports.length === 0 ? (
              <div className="col-span-full py-8 text-center text-gray-500 text-content-secondary text-sm border border-dashed border-gray-200 dark:border-gray-600 rounded-xl">No reports generated yet.</div>
            ) : recentReports.map((report, i) => (
              <div key={i} className="app-card p-4 hover:shadow-lg transition-all cursor-pointer">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 surface-2 rounded-lg flex items-center justify-center border border-line">
                    <FileText className="w-5 h-5 text-accent" />
                  </div>
                  <span className="c-badge c-badge-ok">Ready</span>
                </div>
                <p className="font-semibold text-sm mb-2 line-clamp-2">{report.name}</p>
                <div className="flex items-center justify-between text-xs text-content-secondary">
                  <span>{report.date}</span>
                  <span>{report.size}</span>
                </div>
                <button
                  type="button"
                  onClick={() => downloadEnrollmentsReport(report.name.replace(/\s+/g, '-').toLowerCase(), 'csv')}
                  className={`w-full mt-3 ${primaryBtn} c-btn-sm`}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Report Templates */}
        <div>
          <h2 className="text-xl font-bold mb-4">Report Templates</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredReports.length === 0 ? (
              <div className="col-span-full py-12 text-center text-gray-500 text-content-secondary border border-dashed border-gray-200 dark:border-gray-600 rounded-2xl bg-surface/50">
                <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400 text-content-muted" />
                <p className="font-semibold mb-1 text-content-secondary">No report templates yet</p>
                <p className="text-sm text-content-muted">Create a custom report above to get started.</p>
              </div>
            ) : filteredReports.map((report) => {
              const Icon = report.icon;
              const variant = templateVariant[report.color] ?? 'neutral';
              return (
                <div key={report.id} className={`app-card overflow-hidden hover:shadow-lg transition-all c-stat ${variant}`}>
                  <div className="p-5 border-b border-line surface-2">
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 surface-3 rounded-lg flex items-center justify-center border border-line">
                        <Icon className="w-5 h-5 text-accent" />
                      </div>
                      <div className="flex space-x-2">
                        {report.isActive && (
                          <span className="c-badge c-badge-ok">
                            <Activity className="w-3 h-3" />
                            Active
                          </span>
                        )}
                        <div className="relative">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveDropdown(activeDropdown === report.id ? null : report.id);
                            }}
                            className="c-btn c-btn-ghost c-btn-icon"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {activeDropdown === report.id && (
                            <div className="absolute right-0 mt-2 w-48 app-card shadow-2xl py-2 z-30">
                              <button 
                                onClick={() => {
                                  handleGenerateReport(report.id);
                                }}
                                className="w-full px-4 py-2 text-left hover:bg-raised flex items-center text-sm text-content-secondary"
                              >
                                <RefreshCw className="w-4 h-4 mr-3" />
                                Generate Now
                              </button>
                              <button 
                                onClick={() => {
                                  handleScheduleReport(report);
                                  setActiveDropdown(null);
                                }}
                                className="w-full px-4 py-2 text-left hover:bg-raised flex items-center text-sm text-content-secondary"
                              >
                                <Calendar className="w-4 h-4 mr-3" />
                                Schedule
                              </button>
                              <button 
                                onClick={() => handleEditTemplate(report)}
                                className="w-full px-4 py-2 text-left hover:bg-raised flex items-center text-sm text-content-secondary"
                              >
                                <Edit className="w-4 h-4 mr-3" />
                                Edit Template
                              </button>
                              <button 
                                onClick={() => handleDuplicateReport(report)}
                                className="w-full px-4 py-2 text-left hover:bg-raised flex items-center text-sm text-content-secondary"
                              >
                                <Copy className="w-4 h-4 mr-3" />
                                Duplicate
                              </button>
                              <button 
                                onClick={() => {
                                  handleToggleActive(report.id);
                                  setActiveDropdown(null);
                                }}
                                className="w-full px-4 py-2 text-left hover:bg-raised flex items-center text-sm text-content-secondary"
                              >
                                <Activity className="w-4 h-4 mr-3" />
                                {report.isActive ? 'Deactivate' : 'Activate'}
                              </button>
                              <hr className="c-divider my-2" />
                              <button 
                                onClick={() => handleDeleteReport(report.id)}
                                className="w-full px-4 py-2 text-left hover:bg-raised flex items-center text-sm text-err"
                              >
                                <Trash2 className="w-4 h-4 mr-3" />
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <h3 className="text-primary font-bold text-lg mb-1">{report.name}</h3>
                    <p className="text-secondary text-sm">{report.description}</p>
                  </div>

                  <div className="p-6">
                    <div className="mb-4">
                      <p className="section-label mb-2">Includes</p>
                      <div className="flex flex-wrap gap-2">
                        {report.metrics.map((metric, i) => (
                          <span key={i} className="c-badge c-badge-mute">
                            {metric}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                      <div>
                        <p className="text-muted text-xs mb-1">Type</p>
                        <p className="font-semibold text-content capitalize">{report.type}</p>
                      </div>
                      <div>
                        <p className="text-muted text-xs mb-1">Frequency</p>
                        <p className="font-semibold text-content">{report.frequency}</p>
                      </div>
                      <div>
                        <p className="text-muted text-xs mb-1">Format</p>
                        <p className="font-semibold text-content">{report.format}</p>
                      </div>
                      <div>
                        <p className="text-muted text-xs mb-1">Recipients</p>
                        <p className="font-semibold text-content">{report.recipients}</p>
                      </div>
                    </div>

                    <div className="mb-4 p-3 surface-2 rounded-lg border border-line">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-secondary">Last Generated</span>
                        <span className="font-semibold text-content">{report.lastGenerated}</span>
                      </div>
                      {report.nextScheduled && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-secondary">Next Scheduled</span>
                          <span className="font-semibold text-accent">{report.nextScheduled}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex space-x-2">
                      <button 
                        onClick={() => handleGenerateReport(report.id)}
                        className={`flex-1 ${primaryBtn}`}
                      >
                        <RefreshCw className="w-4 h-4" />
                        Generate
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePreviewReport(report.id)}
                        className={iconBtn}
                        title="Preview download"
                      >
                        <Eye />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleGenerateReport(report.id)}
                        className={iconBtn}
                        title="Download report"
                      >
                        <Download />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
            }
          </div>
        </div>
      </div>

      {/* Create Report Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="app-card rounded-lg shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 surface-1">
              <h3 className="text-2xl font-bold">Create Custom Report</h3>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              {/* Report Name */}
              <div className="mb-6">
                <label className="block text-sm font-semibold mb-2">Report Name</label>
                <input 
                  type="text" 
                  value={reportName}
                  onChange={(e) => setReportName(e.target.value)}
                  placeholder="e.g., Q1 2025 Learning Summary"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent"
                />
              </div>

              {/* Report Type */}
              <div className="mb-6">
                <label className="block text-sm font-semibold mb-2">Report Type</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'completion', label: 'Course Completion', icon: CheckCircle },
                    { value: 'progress', label: 'Learner Progress', icon: TrendingUp },
                    { value: 'performance', label: 'Performance Analysis', icon: Star },
                    { value: 'engagement', label: 'Engagement Metrics', icon: Activity },
                    { value: 'compliance', label: 'Compliance Status', icon: AlertCircle },
                    { value: 'summary', label: 'Learning Summary', icon: FileText }
                  ].map((type) => {
                    const Icon = type.icon;
                    return (
                      <button
                        key={type.value}
                        onClick={() => setReportType(type.value)}
                        className={`p-4 border-2 rounded-xl transition-all text-left ${
                          reportType === type.value
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-blue-300'
                        }`}
                      >
                        <Icon className={`w-5 h-5 mb-2 ${reportType === type.value ? 'text-blue-600' : 'text-gray-600'}`} />
                        <p className="font-semibold text-sm">{type.label}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date Range */}
              <div className="mb-6">
                <label className="block text-sm font-semibold mb-2">Date Range</label>
                <select 
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent"
                >
                  <option value="7days">Last 7 days</option>
                  <option value="30days">Last 30 days</option>
                  <option value="90days">Last 90 days</option>
                  <option value="quarter">This quarter</option>
                  <option value="year">This year</option>
                  <option value="custom">Custom range</option>
                </select>
              </div>

              {/* Options */}
              <div className="mb-6">
                <label className="block text-sm font-semibold mb-3">Report Options</label>
                <div className="space-y-3">
                  <label className="flex items-center">
                    <input 
                      type="checkbox" 
                      checked={includeCharts}
                      onChange={(e) => setIncludeCharts(e.target.checked)}
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-brand"
                    />
                    <span className="ml-3 text-sm font-medium">Include charts and visualizations</span>
                  </label>
                  <label className="flex items-center">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-brand"
                    />
                    <span className="ml-3 text-sm font-medium">Include individual learner data</span>
                  </label>
                  <label className="flex items-center">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-brand"
                    />
                    <span className="ml-3 text-sm font-medium">Include department breakdown</span>
                  </label>
                  <label className="flex items-center">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-brand"
                    />
                    <span className="ml-3 text-sm font-medium">Include executive summary</span>
                  </label>
                </div>
              </div>

              {/* Format Selection */}
              <div className="mb-6">
                <label className="block text-sm font-semibold mb-2">Export Format</label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setReportExportFormat('pdf')}
                    className={`p-3 border-2 rounded-lg font-semibold text-sm ${reportExportFormat === 'pdf' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}
                  >
                    PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportExportFormat('excel')}
                    className={`p-3 border-2 rounded-lg font-semibold text-sm ${reportExportFormat === 'excel' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}
                  >
                    Excel
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportExportFormat('csv')}
                    className={`p-3 border-2 rounded-lg font-semibold text-sm ${reportExportFormat === 'csv' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}
                  >
                    CSV
                  </button>
                </div>
              </div>

              {/* Preview */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                <div className="flex items-start">
                  <Eye className="w-5 h-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-900">
                    <p className="font-semibold mb-1">Report Preview</p>
                    <p>Your report will include {reportType} data from the {dateRange.replace('days', ' days')} period{includeCharts ? ' with visualizations' : ''}.</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex space-x-3">
                <button 
                  onClick={() => setShowCreateModal(false)}
                  className={`flex-1 ${headerSecondaryBtn}`}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleCreateReport}
                  className={`flex-1 ${headerPrimaryBtn}`}
                >
                  <Save className="w-5 h-5 mr-2" />
                  Generate Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Report Modal */}
      {showScheduleModal && reportToSchedule && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="app-card rounded-lg shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 surface-1">
              <h3 className="text-2xl font-bold">Schedule Report</h3>
              <button 
                onClick={() => {
                  setShowScheduleModal(false);
                  setReportToSchedule(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              {/* Report Info */}
              <div className="surface-2 rounded-xl p-4 mb-6 border border-line">
                <div className="flex items-center">
                  <div className={`w-12 h-12 bg-${reportToSchedule.color}-100 rounded-lg flex items-center justify-center mr-4`}>
                    <FileText className={`w-6 h-6 text-${reportToSchedule.color}-600`} />
                  </div>
                  <div>
                    <p className="font-bold">{reportToSchedule.name}</p>
                    <p className="text-sm text-gray-600">{reportToSchedule.description}</p>
                  </div>
                </div>
              </div>

              {/* Schedule Frequency */}
              <div className="mb-6">
                <label className="block text-sm font-semibold mb-2">Frequency</label>
                <div className="grid grid-cols-4 gap-3">
                  {['daily', 'weekly', 'monthly', 'quarterly'].map((freq) => (
                    <button
                      key={freq}
                      onClick={() => setScheduleFrequency(freq)}
                      className={`p-3 border-2 rounded-lg transition-all font-semibold text-sm capitalize ${
                        scheduleFrequency === freq
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      {freq}
                    </button>
                  ))}
                </div>
              </div>

              {/* Day Selection (if weekly) */}
              {scheduleFrequency === 'weekly' && (
                <div className="mb-6">
                  <label className="block text-sm font-semibold mb-2">Day of Week</label>
                  <select 
                    value={scheduleDay}
                    onChange={(e) => setScheduleDay(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent"
                  >
                    <option value="monday">Monday</option>
                    <option value="tuesday">Tuesday</option>
                    <option value="wednesday">Wednesday</option>
                    <option value="thursday">Thursday</option>
                    <option value="friday">Friday</option>
                    <option value="saturday">Saturday</option>
                    <option value="sunday">Sunday</option>
                  </select>
                </div>
              )}

              {/* Time */}
              <div className="mb-6">
                <label className="block text-sm font-semibold mb-2">Time</label>
                <div className="grid grid-cols-2 gap-3">
                  <input 
                    type="time" 
                    defaultValue="09:00"
                    className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent"
                  />
                  <select className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent">
                    <option>America/New_York (EST)</option>
                    <option>America/Los_Angeles (PST)</option>
                    <option>Europe/London (GMT)</option>
                  </select>
                </div>
              </div>

              {/* Recipients */}
              <div className="mb-6">
                <label className="block text-sm font-semibold mb-2">Email Recipients</label>
                <textarea 
                  value={recipientEmails}
                  onChange={(e) => setRecipientEmails(e.target.value)}
                  placeholder="Enter email addresses separated by commas&#10;e.g., john@company.com, jane@company.com"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent h-24 resize-none"
                />
                <p className="text-xs text-gray-600 mt-2">Separate multiple emails with commas</p>
              </div>

              {/* Notification Options */}
              <div className="mb-6">
                <label className="block text-sm font-semibold mb-3">Notification Options</label>
                <div className="space-y-3">
                  <label className="flex items-center">
                    <input 
                      type="checkbox" 
                      defaultChecked
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-brand"
                    />
                    <span className="ml-3 text-sm font-medium">Send email when report is generated</span>
                  </label>
                  <label className="flex items-center">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-brand"
                    />
                    <span className="ml-3 text-sm font-medium">Send reminder 1 day before generation</span>
                  </label>
                  <label className="flex items-center">
                    <input 
                      type="checkbox" 
                      defaultChecked
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-brand"
                    />
                    <span className="ml-3 text-sm font-medium">Notify if report generation fails</span>
                  </label>
                </div>
              </div>

              {/* Summary */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
                <div className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-600 mr-3 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-green-900">
                    <p className="font-semibold mb-1">Schedule Summary</p>
                    <p>Report will be generated <span className="font-semibold">{scheduleFrequency}</span>
                    {scheduleFrequency === 'weekly' && <span> on {scheduleDay}s</span>} at <span className="font-semibold">9:00 AM EST</span> and sent to <span className="font-semibold">{recipientEmails.split(',').filter(e => e.trim()).length || 0} recipient(s)</span>.</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex space-x-3">
                <button 
                  onClick={() => {
                    setShowScheduleModal(false);
                    setReportToSchedule(null);
                  }}
                  className={`flex-1 ${headerSecondaryBtn}`}
                >
                  Cancel
                </button>
                <button 
                  onClick={saveSchedule}
                  className={`flex-1 ${headerPrimaryBtn}`}
                >
                  <Calendar className="w-5 h-5 mr-2" />
                  Save Schedule
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
  return root;
};

export default Reports;
