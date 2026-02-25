import React, { useState } from 'react';
import { 
  Play, Users, BarChart3, Settings, Plus, Clock, Video, 
  ChevronRight, Menu, Search, Bell, Award, Home, FileText,
  Download, Filter, Calendar, Send, Eye, Edit, Trash2,
  TrendingUp, CheckCircle, AlertCircle, Target, BookOpen,
  Mail, Share2, Copy, RefreshCw, ChevronDown, ChevronUp,
  Printer, FileDown, Save, Star, Zap, Activity, Percent,
  MoreVertical, X, Upload, PieChart, LineChart
} from 'lucide-react';

const CoursifyReports = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [reportToSchedule, setReportToSchedule] = useState<{ id: number; color?: string; name?: string; description?: string } | null>(null);
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
  const [selectedReports, setSelectedReports] = useState([]);
  const [reportName, setReportName] = useState('');
  const [reportType, setReportType] = useState('completion');
  const [dateRange, setDateRange] = useState('30days');
  const [includeCharts, setIncludeCharts] = useState(true);
  const [scheduleFrequency, setScheduleFrequency] = useState('weekly');
  const [scheduleDay, setScheduleDay] = useState('monday');
  const [recipientEmails, setRecipientEmails] = useState('');

  // Report templates
  const reportTemplates = [
    {
      id: 1,
      name: 'Monthly Learning Summary',
      description: 'Comprehensive overview of learning activities, completions, and engagement',
      category: 'summary',
      type: 'scheduled',
      frequency: 'Monthly',
      lastGenerated: '2 days ago',
      nextScheduled: 'Jan 30, 2026',
      recipients: 5,
      format: 'PDF',
      size: '2.4 MB',
      icon: FileText,
      color: 'blue',
      metrics: ['Completions', 'Engagement', 'Scores', 'Time Spent'],
      isActive: true
    },
    {
      id: 2,
      name: 'Course Completion Report',
      description: 'Detailed breakdown of course completion rates by department and course',
      category: 'completion',
      type: 'on-demand',
      frequency: 'On-demand',
      lastGenerated: '5 hours ago',
      recipients: 3,
      format: 'Excel',
      size: '856 KB',
      icon: CheckCircle,
      color: 'green',
      metrics: ['Completion Rates', 'Time to Complete', 'Drop-off Points'],
      isActive: true
    },
    {
      id: 3,
      name: 'Learner Progress Tracker',
      description: 'Individual learner progress across all enrolled courses',
      category: 'progress',
      type: 'scheduled',
      frequency: 'Weekly',
      lastGenerated: '1 day ago',
      nextScheduled: 'Jan 14, 2026',
      recipients: 12,
      format: 'PDF',
      size: '1.8 MB',
      icon: TrendingUp,
      color: 'purple',
      metrics: ['Individual Progress', 'Courses Enrolled', 'Certificates'],
      isActive: true
    },
    {
      id: 4,
      name: 'Compliance Training Status',
      description: 'Track mandatory compliance training completion and deadlines',
      category: 'compliance',
      type: 'scheduled',
      frequency: 'Daily',
      lastGenerated: '3 hours ago',
      nextScheduled: 'Jan 8, 2026',
      recipients: 8,
      format: 'PDF',
      size: '945 KB',
      icon: AlertCircle,
      color: 'orange',
      metrics: ['Compliance Status', 'Overdue Trainings', 'Upcoming Deadlines'],
      isActive: true
    },
    {
      id: 5,
      name: 'Assessment Scores Report',
      description: 'Analysis of quiz and assessment performance across all courses',
      category: 'performance',
      type: 'on-demand',
      frequency: 'On-demand',
      lastGenerated: '1 week ago',
      recipients: 4,
      format: 'Excel',
      size: '1.2 MB',
      icon: Star,
      color: 'yellow',
      metrics: ['Average Scores', 'Pass Rates', 'Question Analysis'],
      isActive: true
    },
    {
      id: 6,
      name: 'Department Analytics',
      description: 'Learning metrics and trends broken down by department',
      category: 'department',
      type: 'scheduled',
      frequency: 'Monthly',
      lastGenerated: '1 week ago',
      nextScheduled: 'Feb 1, 2026',
      recipients: 15,
      format: 'PDF',
      size: '3.1 MB',
      icon: Users,
      color: 'indigo',
      metrics: ['Department Comparison', 'Engagement', 'ROI'],
      isActive: true
    },
    {
      id: 7,
      name: 'Time Spent Analysis',
      description: 'Detailed breakdown of learning time across courses and learners',
      category: 'engagement',
      type: 'on-demand',
      frequency: 'On-demand',
      lastGenerated: '3 days ago',
      recipients: 2,
      format: 'Excel',
      size: '678 KB',
      icon: Clock,
      color: 'pink',
      metrics: ['Time per Course', 'Peak Hours', 'Session Duration'],
      isActive: false
    },
    {
      id: 8,
      name: 'Certificate Issuance Log',
      description: 'Track all certificates issued with learner details and dates',
      category: 'certificates',
      type: 'scheduled',
      frequency: 'Weekly',
      lastGenerated: '2 days ago',
      nextScheduled: 'Jan 14, 2026',
      recipients: 6,
      format: 'PDF',
      size: '521 KB',
      icon: Award,
      color: 'teal',
      metrics: ['Certificates Issued', 'Course Distribution', 'Validity'],
      isActive: true
    }
  ];

  const [reports, setReports] = useState(reportTemplates);

  // Recent generated reports
  const recentReports = [
    { name: 'Monthly_Learning_Summary_Dec_2024.pdf', date: '2 days ago', size: '2.4 MB', status: 'ready' },
    { name: 'Learner_Progress_Tracker_Week_1.pdf', date: '1 day ago', size: '1.8 MB', status: 'ready' },
    { name: 'Compliance_Status_Jan_7.pdf', date: '3 hours ago', size: '945 KB', status: 'ready' },
    { name: 'Course_Completion_Q4_2024.xlsx', date: '5 hours ago', size: '856 KB', status: 'ready' }
  ];

  // Stats
  const stats = {
    totalReports: reports.length,
    scheduledReports: reports.filter(r => r.type === 'scheduled').length,
    activeSchedules: reports.filter(r => r.isActive).length,
    recentlyGenerated: 12
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

  const handleCreateReport = () => {
    const newReport = {
      id: reports.length + 1,
      name: reportName || 'New Custom Report',
      description: 'Custom generated report',
      category: reportType,
      type: 'on-demand',
      frequency: 'On-demand',
      lastGenerated: 'Just now',
      recipients: 0,
      format: 'PDF',
      size: '0 KB',
      icon: FileText,
      color: 'blue',
      metrics: [],
      isActive: false
    };
    
    setReports([newReport, ...reports]);
    setShowCreateModal(false);
    setReportName('');
  };

  const handleGenerateReport = (reportId: number) => {
    console.log('Generating report:', reportId);
    setActiveDropdown(null);
  };

  const handleScheduleReport = (report: { id: number; color?: string; name?: string; description?: string }) => {
    setReportToSchedule(report);
    setShowScheduleModal(true);
  };

  const handleDeleteReport = (reportId: number) => {
    setReports(reports.filter(r => r.id !== reportId));
    setActiveDropdown(null);
  };

  const handleToggleActive = (reportId: number) => {
    setReports(reports.map(r => 
      r.id === reportId ? { ...r, isActive: !r.isActive } : r
    ));
  };

  const saveSchedule = () => {
    console.log('Saving schedule for:', reportToSchedule);
    setShowScheduleModal(false);
    setReportToSchedule(null);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className={`bg-gradient-to-b from-blue-600 to-blue-700 text-white transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-20'}`}>
        <div className="p-4 border-b border-blue-500 flex items-center justify-between">
          {sidebarOpen && (
            <div className="flex items-center">
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-lg">
                <Video className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-3">
                <span className="font-bold text-lg">Coursify</span>
                <p className="text-xs text-blue-200">LMS Platform</p>
              </div>
            </div>
          )}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-blue-500 rounded-lg transition-all">
            <Menu className="w-5 h-5" />
          </button>
        </div>
        
        <nav className="p-4 space-y-2">
          <button className="w-full flex items-center p-3 rounded-lg hover:bg-blue-500 transition-all">
            <Home className="w-5 h-5" />
            {sidebarOpen && <span className="ml-3 font-semibold">Dashboard</span>}
          </button>
          <button className="w-full flex items-center p-3 rounded-lg hover:bg-blue-500 transition-all">
            <Video className="w-5 h-5" />
            {sidebarOpen && <span className="ml-3 font-semibold">My Courses</span>}
          </button>
          <button className="w-full flex items-center p-3 rounded-lg hover:bg-blue-500 transition-all">
            <Plus className="w-5 h-5" />
            {sidebarOpen && <span className="ml-3 font-semibold">Create Course</span>}
          </button>
          <button className="w-full flex items-center p-3 rounded-lg hover:bg-blue-500 transition-all">
            <Users className="w-5 h-5" />
            {sidebarOpen && <span className="ml-3 font-semibold">Learners</span>}
          </button>
          <button className="w-full flex items-center p-3 rounded-lg hover:bg-blue-500 transition-all">
            <BarChart3 className="w-5 h-5" />
            {sidebarOpen && <span className="ml-3 font-semibold">Analytics</span>}
          </button>
          <div className="w-full flex items-center p-3 rounded-lg bg-white text-blue-600 shadow-lg">
            <FileText className="w-5 h-5" />
            {sidebarOpen && <span className="ml-3 font-semibold">Reports</span>}
          </div>
        </nav>

        {sidebarOpen && (
          <div className="absolute bottom-0 w-64 p-4 border-t border-blue-500 bg-blue-700">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg">
                JD
              </div>
              <div className="ml-3">
                <p className="text-sm font-semibold">John Doe</p>
                <p className="text-xs text-blue-200">Admin Account</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-8 py-6 sticky top-0 z-20">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
              <p className="text-gray-600 mt-1">Generate and schedule automated learning reports</p>
            </div>
            <div className="flex space-x-3">
              <button className="px-6 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 font-semibold flex items-center transition-all">
                <Upload className="w-5 h-5 mr-2" />
                Import Template
              </button>
              <button 
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold flex items-center shadow-lg transition-all"
              >
                <Plus className="w-5 h-5 mr-2" />
                Create Report
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-blue-600 font-semibold">Total Reports</p>
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <p className="text-3xl font-bold text-blue-700">{stats.totalReports}</p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl border border-green-200">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-green-600 font-semibold">Scheduled</p>
                <Calendar className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-3xl font-bold text-green-700">{stats.scheduledReports}</p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-purple-600 font-semibold">Active</p>
                <Activity className="w-5 h-5 text-purple-600" />
              </div>
              <p className="text-3xl font-bold text-purple-700">{stats.activeSchedules}</p>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-xl border border-orange-200">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-orange-600 font-semibold">Generated</p>
                <CheckCircle className="w-5 h-5 text-orange-600" />
              </div>
              <p className="text-3xl font-bold text-orange-700">{stats.recentlyGenerated}</p>
            </div>
          </div>

          {/* Categories and Search */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <button 
                onClick={() => setSelectedCategory('all')}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  selectedCategory === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All Reports
              </button>
              <button 
                onClick={() => setSelectedCategory('summary')}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  selectedCategory === 'summary' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Summary
              </button>
              <button 
                onClick={() => setSelectedCategory('completion')}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  selectedCategory === 'completion' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Completion
              </button>
              <button 
                onClick={() => setSelectedCategory('compliance')}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  selectedCategory === 'compliance' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Compliance
              </button>
              <button 
                onClick={() => setSelectedCategory('performance')}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  selectedCategory === 'performance' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Performance
              </button>
            </div>

            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search reports..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-64 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              <button className="text-blue-600 hover:text-blue-700 text-sm font-semibold">
                View All →
              </button>
            </div>
            <div className="grid grid-cols-4 gap-4">
              {recentReports.map((report, i) => (
                <div key={i} className="bg-white p-4 rounded-xl border border-gray-200 hover:shadow-lg transition-all cursor-pointer">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                      Ready
                    </span>
                  </div>
                  <p className="font-semibold text-sm mb-2 line-clamp-2">{report.name}</p>
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span>{report.date}</span>
                    <span>{report.size}</span>
                  </div>
                  <button className="w-full mt-3 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-sm flex items-center justify-center">
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
              {filteredReports.map((report) => {
                const Icon = report.icon;
                return (
                  <div key={report.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-all">
                    {/* Header */}
                    <div className={`bg-gradient-to-r from-${report.color}-400 to-${report.color}-500 p-6 relative`}>
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg">
                          <Icon className={`w-6 h-6 text-${report.color}-600`} />
                        </div>
                        <div className="flex space-x-2">
                          {report.isActive && (
                            <span className="px-3 py-1 bg-white bg-opacity-90 rounded-full text-xs font-semibold text-green-700 flex items-center">
                              <Activity className="w-3 h-3 mr-1" />
                              Active
                            </span>
                          )}
                          <div className="relative">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveDropdown(activeDropdown === report.id ? null : report.id);
                              }}
                              className="p-2 bg-white bg-opacity-90 rounded-lg hover:bg-opacity-100 transition-all"
                            >
                              <MoreVertical className="w-4 h-4 text-gray-700" />
                            </button>

                            {activeDropdown === report.id && (
                              <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-2xl border border-gray-200 py-2 z-30">
                                <button 
                                  onClick={() => {
                                    handleGenerateReport(report.id);
                                  }}
                                  className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center text-sm"
                                >
                                  <RefreshCw className="w-4 h-4 mr-3" />
                                  Generate Now
                                </button>
                                <button 
                                  onClick={() => {
                                    handleScheduleReport(report);
                                    setActiveDropdown(null);
                                  }}
                                  className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center text-sm"
                                >
                                  <Calendar className="w-4 h-4 mr-3" />
                                  Schedule
                                </button>
                                <button className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center text-sm">
                                  <Edit className="w-4 h-4 mr-3" />
                                  Edit Template
                                </button>
                                <button className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center text-sm">
                                  <Copy className="w-4 h-4 mr-3" />
                                  Duplicate
                                </button>
                                <button 
                                  onClick={() => {
                                    handleToggleActive(report.id);
                                    setActiveDropdown(null);
                                  }}
                                  className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center text-sm"
                                >
                                  <Activity className="w-4 h-4 mr-3" />
                                  {report.isActive ? 'Deactivate' : 'Activate'}
                                </button>
                                <hr className="my-2" />
                                <button 
                                  onClick={() => handleDeleteReport(report.id)}
                                  className="w-full px-4 py-2 text-left hover:bg-red-50 flex items-center text-sm text-red-600"
                                >
                                  <Trash2 className="w-4 h-4 mr-3" />
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <h3 className="text-white font-bold text-lg mb-1">{report.name}</h3>
                      <p className="text-white text-opacity-90 text-sm">{report.description}</p>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                      {/* Metrics */}
                      <div className="mb-4">
                        <p className="text-xs font-semibold text-gray-600 mb-2">INCLUDES</p>
                        <div className="flex flex-wrap gap-2">
                          {report.metrics.map((metric, i) => (
                            <span key={i} className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">
                              {metric}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Details Grid */}
                      <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                        <div>
                          <p className="text-gray-600 text-xs mb-1">Type</p>
                          <p className="font-semibold capitalize">{report.type}</p>
                        </div>
                        <div>
                          <p className="text-gray-600 text-xs mb-1">Frequency</p>
                          <p className="font-semibold">{report.frequency}</p>
                        </div>
                        <div>
                          <p className="text-gray-600 text-xs mb-1">Format</p>
                          <p className="font-semibold">{report.format}</p>
                        </div>
                        <div>
                          <p className="text-gray-600 text-xs mb-1">Recipients</p>
                          <p className="font-semibold">{report.recipients}</p>
                        </div>
                      </div>

                      {/* Last Generated */}
                      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-gray-600">Last Generated</span>
                          <span className="font-semibold">{report.lastGenerated}</span>
                        </div>
                        {report.nextScheduled && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Next Scheduled</span>
                            <span className="font-semibold text-blue-600">{report.nextScheduled}</span>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => handleGenerateReport(report.id)}
                          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold flex items-center justify-center transition-all"
                        >
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Generate
                        </button>
                        <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all">
                          <Eye className="w-5 h-5 text-gray-600" />
                        </button>
                        <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all">
                          <Download className="w-5 h-5 text-gray-600" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Create Report Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="ml-3 text-sm font-medium">Include charts and visualizations</span>
                  </label>
                  <label className="flex items-center">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="ml-3 text-sm font-medium">Include individual learner data</span>
                  </label>
                  <label className="flex items-center">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="ml-3 text-sm font-medium">Include department breakdown</span>
                  </label>
                  <label className="flex items-center">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="ml-3 text-sm font-medium">Include executive summary</span>
                  </label>
                </div>
              </div>

              {/* Format Selection */}
              <div className="mb-6">
                <label className="block text-sm font-semibold mb-2">Export Format</label>
                <div className="grid grid-cols-3 gap-3">
                  <button className="p-3 border-2 border-blue-500 bg-blue-50 rounded-lg font-semibold text-sm">
                    PDF
                  </button>
                  <button className="p-3 border-2 border-gray-200 rounded-lg hover:border-blue-300 font-semibold text-sm">
                    Excel
                  </button>
                  <button className="p-3 border-2 border-gray-200 rounded-lg hover:border-blue-300 font-semibold text-sm">
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
                  className="flex-1 px-6 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 font-semibold transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleCreateReport}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold transition-all shadow-lg flex items-center justify-center"
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
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
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
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                    className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <select className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent h-24 resize-none"
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
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="ml-3 text-sm font-medium">Send email when report is generated</span>
                  </label>
                  <label className="flex items-center">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="ml-3 text-sm font-medium">Send reminder 1 day before generation</span>
                  </label>
                  <label className="flex items-center">
                    <input 
                      type="checkbox" 
                      defaultChecked
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
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
                  className="flex-1 px-6 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 font-semibold transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={saveSchedule}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold transition-all shadow-lg flex items-center justify-center"
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
};

export default CoursifyReports;