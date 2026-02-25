import React, { useState } from 'react';
import { 
  Play, Users, BarChart3, Settings, Plus, Clock, Video, 
  ChevronRight, Menu, Search, Bell, Award, Home, FileText,
  TrendingUp, TrendingDown, Calendar, Download, Filter,
  Target, Zap, Eye, Activity, Percent, Trophy, BookOpen,
  ArrowUp, ArrowDown, Minus, RefreshCw, Share2, PieChart,
  LineChart, BarChart, ChevronDown, ChevronUp, AlertCircle,
  CheckCircle, XCircle, Star, Globe, MapPin, Smartphone, Monitor,
  UserPlus
} from 'lucide-react';

const CoursifyAnalytics = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dateRange, setDateRange] = useState('30days'); // '7days', '30days', '90days', 'year', 'custom'
  const [selectedMetric, setSelectedMetric] = useState('overview'); // 'overview', 'engagement', 'completion', 'performance'
  const [comparisonMode, setComparisonMode] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState('all');
  const [selectedDepartment, setSelectedDepartment] = useState('all');

  // Analytics Data
  const overviewStats = {
    totalLearners: { current: 1247, previous: 1112, change: 12.1, trend: 'up' },
    activeLearners: { current: 892, previous: 756, change: 18.0, trend: 'up' },
    coursesCompleted: { current: 1543, previous: 1289, change: 19.7, trend: 'up' },
    avgCompletionRate: { current: 78, previous: 63.5, change: 22.8, trend: 'up' },
    totalTimeSpent: { current: '5,234h', previous: '4,567h', change: 14.6, trend: 'up' },
    certificatesIssued: { current: 456, previous: 378, change: 20.6, trend: 'up' },
    avgScore: { current: 87, previous: 83, change: 4.8, trend: 'up' },
    dropOffRate: { current: 15, previous: 22, change: -31.8, trend: 'down' }
  };

  const engagementData = {
    daily: [
      { date: 'Jan 1', active: 234, newEnrollments: 45, completions: 67 },
      { date: 'Jan 2', active: 267, newEnrollments: 52, completions: 71 },
      { date: 'Jan 3', active: 289, newEnrollments: 48, completions: 69 },
      { date: 'Jan 4', active: 312, newEnrollments: 61, completions: 78 },
      { date: 'Jan 5', active: 298, newEnrollments: 55, completions: 73 },
      { date: 'Jan 6', active: 334, newEnrollments: 68, completions: 82 },
      { date: 'Jan 7', active: 356, newEnrollments: 72, completions: 89 }
    ],
    peakHours: [
      { hour: '8 AM', users: 145 },
      { hour: '9 AM', users: 234 },
      { hour: '10 AM', users: 312 },
      { hour: '11 AM', users: 289 },
      { hour: '12 PM', users: 198 },
      { hour: '1 PM', users: 167 },
      { hour: '2 PM', users: 278 },
      { hour: '3 PM', users: 301 },
      { hour: '4 PM', users: 267 },
      { hour: '5 PM', users: 189 }
    ]
  };

  const coursePerformance = [
    { 
      id: 1,
      name: 'Product Onboarding 2024',
      enrolled: 178,
      completed: 156,
      inProgress: 22,
      completionRate: 92,
      avgScore: 95,
      avgTime: '2h 15m',
      dropOffRate: 8,
      satisfaction: 4.8,
      trend: 'up',
      trendValue: 12
    },
    { 
      id: 2,
      name: 'Security & Compliance',
      enrolled: 156,
      completed: 143,
      inProgress: 13,
      completionRate: 87,
      avgScore: 88,
      avgTime: '1h 45m',
      dropOffRate: 12,
      satisfaction: 4.6,
      trend: 'up',
      trendValue: 8
    },
    { 
      id: 3,
      name: 'Sales Methodology',
      enrolled: 145,
      completed: 128,
      inProgress: 17,
      completionRate: 84,
      avgScore: 91,
      avgTime: '3h 30m',
      dropOffRate: 16,
      satisfaction: 4.7,
      trend: 'down',
      trendValue: 3
    },
    { 
      id: 4,
      name: 'Customer Success',
      enrolled: 132,
      completed: 112,
      inProgress: 20,
      completionRate: 81,
      avgScore: 89,
      avgTime: '2h 45m',
      dropOffRate: 19,
      satisfaction: 4.9,
      trend: 'up',
      trendValue: 15
    }
  ];

  const departmentBreakdown = [
    { name: 'Sales', learners: 345, completion: 89, avgScore: 92, color: 'blue' },
    { name: 'Engineering', learners: 298, completion: 85, avgScore: 88, color: 'purple' },
    { name: 'Marketing', learners: 234, completion: 76, avgScore: 84, color: 'green' },
    { name: 'Customer Success', learners: 189, completion: 91, avgScore: 93, color: 'orange' },
    { name: 'Operations', learners: 181, completion: 72, avgScore: 81, color: 'pink' }
  ];

  const completionFunnel = [
    { stage: 'Enrolled', count: 1247, percentage: 100, color: 'from-blue-500 to-blue-600' },
    { stage: 'Started', count: 1089, percentage: 87, color: 'from-purple-500 to-purple-600' },
    { stage: 'In Progress', count: 892, percentage: 72, color: 'from-green-500 to-green-600' },
    { stage: 'Completed', count: 678, percentage: 54, color: 'from-orange-500 to-orange-600' },
    { stage: 'Certified', count: 456, percentage: 37, color: 'from-pink-500 to-pink-600' }
  ];

  const deviceBreakdown = [
    { device: 'Desktop', users: 687, percentage: 55, icon: Monitor },
    { device: 'Mobile', users: 436, percentage: 35, icon: Smartphone },
    { device: 'Tablet', users: 124, percentage: 10, icon: Smartphone }
  ];

  const topPerformers = [
    { name: 'Sarah Johnson', courses: 12, score: 96, time: '48h', rank: 1 },
    { name: 'Alex Turner', courses: 11, score: 94, time: '45h', rank: 2 },
    { name: 'Mike Chen', courses: 10, score: 93, time: '42h', rank: 3 },
    { name: 'Emma Wilson', courses: 10, score: 91, time: '40h', rank: 4 },
    { name: 'John Smith', courses: 9, score: 90, time: '38h', rank: 5 }
  ];

  const atRiskLearners = [
    { name: 'Lisa Wong', courses: 5, completion: 25, lastActive: '2 weeks ago', status: 'critical' },
    { name: 'David Lee', courses: 7, completion: 38, lastActive: '1 week ago', status: 'warning' },
    { name: 'Emma Davis', courses: 10, completion: 45, lastActive: '3 days ago', status: 'warning' }
  ];

  const StatCard = ({ title, current, previous, change, trend, icon: Icon, color, suffix = '' }: {
    title: string;
    current: string | number;
    previous: string | number;
    change: number;
    trend: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    suffix?: string;
  }) => {
    const isPositive = trend === 'up';
    const changeValue = Math.abs(change);

    return (
      <div className={`bg-gradient-to-br from-${color}-500 to-${color}-600 text-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all cursor-pointer`}>
        <div className="flex items-center justify-between mb-4">
          <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center backdrop-blur-sm">
            <Icon className="w-6 h-6" />
          </div>
          <div className={`flex items-center space-x-1 text-sm font-semibold bg-white bg-opacity-20 px-3 py-1 rounded-full`}>
            {isPositive ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
            <span>{changeValue.toFixed(1)}%</span>
          </div>
        </div>
        <p className="text-sm opacity-90 mb-1">{title}</p>
        <div className="flex items-baseline">
          <p className="text-4xl font-bold">{current}</p>
          {suffix && <span className="text-xl ml-1 opacity-90">{suffix}</span>}
        </div>
        {comparisonMode && (
          <p className="text-xs opacity-75 mt-2">vs {previous}{suffix} last period</p>
        )}
      </div>
    );
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
          <div className="w-full flex items-center p-3 rounded-lg bg-white text-blue-600 shadow-lg">
            <BarChart3 className="w-5 h-5" />
            {sidebarOpen && <span className="ml-3 font-semibold">Analytics</span>}
          </div>
          <button className="w-full flex items-center p-3 rounded-lg hover:bg-blue-500 transition-all">
            <FileText className="w-5 h-5" />
            {sidebarOpen && <span className="ml-3 font-semibold">Reports</span>}
          </button>
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
              <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
              <div className="flex items-center mt-2 text-sm text-gray-600">
                <Calendar className="w-4 h-4 mr-2" />
                <span>Last updated: Just now</span>
                <span className="mx-2">•</span>
                <span>Showing data for last 30 days</span>
              </div>
            </div>
            <div className="flex space-x-3">
              <button 
                onClick={() => setComparisonMode(!comparisonMode)}
                className={`px-4 py-2 rounded-lg font-semibold transition-all flex items-center ${
                  comparisonMode ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Compare
              </button>
              <button 
                onClick={() => setShowFilters(!showFilters)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-semibold flex items-center transition-all"
              >
                <Filter className="w-4 h-4 mr-2" />
                Filters
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold flex items-center transition-all">
                <Download className="w-4 h-4 mr-2" />
                Export Report
              </button>
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-200">
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Date Range</label>
                  <select 
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="7days">Last 7 days</option>
                    <option value="30days">Last 30 days</option>
                    <option value="90days">Last 90 days</option>
                    <option value="year">This year</option>
                    <option value="custom">Custom range</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Course</label>
                  <select 
                    value={selectedCourse}
                    onChange={(e) => setSelectedCourse(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Courses</option>
                    <option value="1">Product Onboarding</option>
                    <option value="2">Security Training</option>
                    <option value="3">Sales Methodology</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Department</label>
                  <select 
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Departments</option>
                    <option value="sales">Sales</option>
                    <option value="engineering">Engineering</option>
                    <option value="marketing">Marketing</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold">
                    Apply Filters
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Metric Tabs */}
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => setSelectedMetric('overview')}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                selectedMetric === 'overview' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Overview
            </button>
            <button 
              onClick={() => setSelectedMetric('engagement')}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                selectedMetric === 'engagement' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Engagement
            </button>
            <button 
              onClick={() => setSelectedMetric('completion')}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                selectedMetric === 'completion' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Completion
            </button>
            <button 
              onClick={() => setSelectedMetric('performance')}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                selectedMetric === 'performance' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Performance
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-8">
          {selectedMetric === 'overview' && (
            <div>
              {/* Overview Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard 
                  title="Total Learners" 
                  current={overviewStats.totalLearners.current}
                  previous={overviewStats.totalLearners.previous}
                  change={overviewStats.totalLearners.change}
                  trend={overviewStats.totalLearners.trend}
                  icon={Users}
                  color="blue"
                />
                <StatCard 
                  title="Active Learners" 
                  current={overviewStats.activeLearners.current}
                  previous={overviewStats.activeLearners.previous}
                  change={overviewStats.activeLearners.change}
                  trend={overviewStats.activeLearners.trend}
                  icon={Activity}
                  color="green"
                />
                <StatCard 
                  title="Courses Completed" 
                  current={overviewStats.coursesCompleted.current}
                  previous={overviewStats.coursesCompleted.previous}
                  change={overviewStats.coursesCompleted.change}
                  trend={overviewStats.coursesCompleted.trend}
                  icon={CheckCircle}
                  color="purple"
                />
                <StatCard 
                  title="Avg. Completion" 
                  current={overviewStats.avgCompletionRate.current}
                  previous={overviewStats.avgCompletionRate.previous}
                  change={overviewStats.avgCompletionRate.change}
                  trend={overviewStats.avgCompletionRate.trend}
                  icon={Target}
                  color="orange"
                  suffix="%"
                />
              </div>

              {/* Charts Row 1 */}
              <div className="grid lg:grid-cols-2 gap-6 mb-6">
                {/* Engagement Trend */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-xl font-bold">Engagement Trend</h3>
                      <p className="text-sm text-gray-600 mt-1">Daily active learners and completions</p>
                    </div>
                    <button className="p-2 hover:bg-gray-100 rounded-lg">
                      <Download className="w-5 h-5 text-gray-600" />
                    </button>
                  </div>
                  
                  <div className="h-64 flex items-end justify-around space-x-1">
                    {engagementData.daily.map((day, i) => (
                      <div key={i} className="flex flex-col items-center flex-1 group relative">
                        {/* Tooltip */}
                        <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-2 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap transition-opacity z-10">
                          <p className="font-semibold">{day.date}</p>
                          <p>Active: {day.active}</p>
                          <p>Enrolled: {day.newEnrollments}</p>
                          <p>Completed: {day.completions}</p>
                        </div>
                        
                        <div className="w-full flex flex-col items-center">
                          <div 
                            className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-lg transition-all hover:from-blue-600 hover:to-blue-500 cursor-pointer" 
                            style={{height: `${(day.active / 400) * 200}px`}}
                          ></div>
                        </div>
                        <span className="text-xs text-gray-600 mt-2 font-medium">{day.date.split(' ')[1]}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Department Breakdown */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-xl font-bold">Department Performance</h3>
                      <p className="text-sm text-gray-600 mt-1">Completion rates by department</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    {departmentBreakdown.map((dept, i) => (
                      <div key={i} className="group">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center flex-1">
                            <div className={`w-3 h-3 rounded-full bg-${dept.color}-500 mr-3`}></div>
                            <span className="font-semibold text-sm">{dept.name}</span>
                            <span className="text-xs text-gray-600 ml-2">({dept.learners} learners)</span>
                          </div>
                          <div className="text-right">
                            <span className="font-semibold text-sm">{dept.completion}%</span>
                            <span className="text-xs text-gray-600 ml-2">Avg: {dept.avgScore}%</span>
                          </div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div 
                            className={`bg-gradient-to-r from-${dept.color}-400 to-${dept.color}-500 h-3 rounded-full transition-all group-hover:from-${dept.color}-500 group-hover:to-${dept.color}-600`}
                            style={{width: `${dept.completion}%`}}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Charts Row 2 */}
              <div className="grid lg:grid-cols-3 gap-6 mb-6">
                {/* Completion Funnel */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                  <h3 className="text-xl font-bold mb-6">Completion Funnel</h3>
                  <div className="space-y-3">
                    {completionFunnel.map((stage, i) => (
                      <div key={i} className="relative">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold">{stage.stage}</span>
                          <span className="text-sm font-semibold">{stage.count}</span>
                        </div>
                        <div 
                          className={`bg-gradient-to-r ${stage.color} rounded-lg p-3 text-white transition-all hover:shadow-lg cursor-pointer`}
                          style={{width: `${stage.percentage}%`}}
                        >
                          <span className="text-sm font-semibold">{stage.percentage}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Device Breakdown */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                  <h3 className="text-xl font-bold mb-6">Device Usage</h3>
                  <div className="space-y-6">
                    {deviceBreakdown.map((device, i) => {
                      const Icon = device.icon;
                      return (
                        <div key={i} className="flex items-center">
                          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mr-4">
                            <Icon className="w-6 h-6 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-semibold">{device.device}</span>
                              <span className="text-sm font-semibold">{device.users}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-blue-500 h-2 rounded-full"
                                style={{width: `${device.percentage}%`}}
                              ></div>
                            </div>
                            <span className="text-xs text-gray-600 mt-1">{device.percentage}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Top Performers */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold">Top Performers</h3>
                    <Trophy className="w-6 h-6 text-yellow-500" />
                  </div>
                  <div className="space-y-3">
                    {topPerformers.map((performer, i) => (
                      <div key={i} className="flex items-center p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                          i === 0 ? 'bg-yellow-400 text-white' :
                          i === 1 ? 'bg-gray-300 text-gray-700' :
                          i === 2 ? 'bg-orange-400 text-white' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {performer.rank}
                        </div>
                        <div className="ml-3 flex-1">
                          <p className="font-semibold text-sm">{performer.name}</p>
                          <p className="text-xs text-gray-600">{performer.courses} courses • {performer.score}% avg</p>
                        </div>
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Course Performance Table */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-xl font-bold">Course Performance</h3>
                  <p className="text-sm text-gray-600 mt-1">Detailed metrics for all courses</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Course Name</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Enrolled</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Completed</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Completion Rate</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Avg. Score</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Avg. Time</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Drop-off</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Satisfaction</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Trend</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {coursePerformance.map((course) => (
                        <tr key={course.id} className="hover:bg-gray-50 transition-all">
                          <td className="px-6 py-4">
                            <p className="font-semibold">{course.name}</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-semibold">{course.enrolled}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-semibold text-green-600">{course.completed}</span>
                            <span className="text-gray-600 text-sm ml-1">({course.inProgress} in progress)</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-2">
                              <div className="w-20 bg-gray-200 rounded-full h-2">
                                <div 
                                  className={`h-2 rounded-full ${
                                    course.completionRate >= 85 ? 'bg-green-500' :
                                    course.completionRate >= 70 ? 'bg-yellow-500' :
                                    'bg-red-500'
                                  }`}
                                  style={{width: `${course.completionRate}%`}}
                                ></div>
                              </div>
                              <span className="text-sm font-semibold">{course.completionRate}%</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`font-semibold ${
                              course.avgScore >= 90 ? 'text-green-600' :
                              course.avgScore >= 75 ? 'text-yellow-600' :
                              'text-red-600'
                            }`}>
                              {course.avgScore}%
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-gray-700">{course.avgTime}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              course.dropOffRate < 15 ? 'bg-green-100 text-green-700' :
                              course.dropOffRate < 25 ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {course.dropOffRate}%
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center">
                              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 mr-1" />
                              <span className="font-semibold">{course.satisfaction}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className={`flex items-center space-x-1 ${
                              course.trend === 'up' ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {course.trend === 'up' ? (
                                <TrendingUp className="w-4 h-4" />
                              ) : (
                                <TrendingDown className="w-4 h-4" />
                              )}
                              <span className="text-sm font-semibold">{course.trendValue}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {selectedMetric === 'engagement' && (
            <div>
              {/* Engagement Stats */}
              <div className="grid grid-cols-4 gap-6 mb-8">
                <StatCard 
                  title="Daily Active Users" 
                  current={334}
                  previous={289}
                  change={15.6}
                  trend="up"
                  icon={Activity}
                  color="blue"
                />
                <StatCard 
                  title="Avg. Session Time" 
                  current="24m"
                  previous="19m"
                  change={26.3}
                  trend="up"
                  icon={Clock}
                  color="green"
                />
                <StatCard 
                  title="New Enrollments" 
                  current={68}
                  previous={52}
                  change={30.8}
                  trend="up"
                  icon={UserPlus}
                  color="purple"
                />
                <StatCard 
                  title="Return Rate" 
                  current={82}
                  previous={76}
                  change={7.9}
                  trend="up"
                  icon={RefreshCw}
                  color="orange"
                  suffix="%"
                />
              </div>

              {/* Peak Hours Chart */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mb-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-bold">Peak Usage Hours</h3>
                    <p className="text-sm text-gray-600 mt-1">When are learners most active?</p>
                  </div>
                </div>
                
                <div className="h-80 flex items-end justify-around space-x-2">
                  {engagementData.peakHours.map((hour, i) => (
                    <div key={i} className="flex flex-col items-center flex-1 group relative">
                      <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-2 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap transition-opacity z-10">
                        <p className="font-semibold">{hour.hour}</p>
                        <p>{hour.users} active users</p>
                      </div>
                      
                      <div 
                        className="w-full bg-gradient-to-t from-purple-500 to-purple-400 rounded-t-lg transition-all hover:from-purple-600 hover:to-purple-500 cursor-pointer" 
                        style={{height: `${(hour.users / 350) * 280}px`}}
                      ></div>
                      <span className="text-xs text-gray-600 mt-2 font-medium transform -rotate-45 origin-top-left">{hour.hour}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* At-Risk Learners */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-bold">At-Risk Learners</h3>
                    <p className="text-sm text-gray-600 mt-1">Learners who need attention</p>
                  </div>
                  <button className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-semibold flex items-center">
                    <Bell className="w-4 h-4 mr-2" />
                    Send Reminders
                  </button>
                </div>
                
                <div className="space-y-3">
                  {atRiskLearners.map((learner, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all">
                      <div className="flex items-center flex-1">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-white ${
                          learner.status === 'critical' ? 'bg-red-500' : 'bg-orange-500'
                        }`}>
                          {learner.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div className="ml-4">
                          <p className="font-semibold">{learner.name}</p>
                          <p className="text-sm text-gray-600">{learner.courses} courses enrolled • Last active {learner.lastActive}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <p className="text-2xl font-bold text-red-600">{learner.completion}%</p>
                          <p className="text-xs text-gray-600">Completion</p>
                        </div>
                        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold">
                          Contact
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {selectedMetric === 'completion' && (
            <div>
              {/* Completion Stats */}
              <div className="grid grid-cols-4 gap-6 mb-8">
                <StatCard 
                  title="Total Completions" 
                  current={1543}
                  previous={1289}
                  change={19.7}
                  trend="up"
                  icon={CheckCircle}
                  color="green"
                />
                <StatCard 
                  title="Completion Rate" 
                  current={78}
                  previous={63}
                  change={23.8}
                  trend="up"
                  icon={Percent}
                  color="blue"
                  suffix="%"
                />
                <StatCard 
                  title="Certificates Issued" 
                  current={456}
                  previous={378}
                  change={20.6}
                  trend="up"
                  icon={Award}
                  color="purple"
                />
                <StatCard 
                  title="Avg. Time to Complete" 
                  current="18d"
                  previous="24d"
                  change={-25.0}
                  trend="down"
                  icon={Clock}
                  color="orange"
                />
              </div>

              {/* Completion by Course Type */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mb-6">
                <h3 className="text-xl font-bold mb-6">Completion Rate by Course Category</h3>
                <div className="grid grid-cols-2 gap-6">
                  {[
                    { category: 'Onboarding', rate: 92, courses: 4, color: 'blue' },
                    { category: 'Compliance', rate: 87, courses: 3, color: 'purple' },
                    { category: 'Sales Training', rate: 84, courses: 5, color: 'green' },
                    { category: 'Product Knowledge', rate: 81, courses: 6, color: 'orange' },
                    { category: 'Soft Skills', rate: 76, courses: 4, color: 'pink' },
                    { category: 'Technical Skills', rate: 72, courses: 7, color: 'indigo' }
                  ].map((cat, i) => (
                    <div key={i} className="p-4 bg-gray-50 rounded-xl">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-bold">{cat.category}</p>
                          <p className="text-xs text-gray-600">{cat.courses} courses</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-blue-600">{cat.rate}%</p>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div 
                          className={`bg-${cat.color}-500 h-3 rounded-full`}
                          style={{width: `${cat.rate}%`}}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Completion Timeline */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <h3 className="text-xl font-bold mb-6">Completion Timeline Distribution</h3>
                <div className="space-y-4">
                  {[
                    { timeframe: '0-7 days', count: 234, percentage: 35, color: 'green' },
                    { timeframe: '8-14 days', count: 189, percentage: 28, color: 'blue' },
                    { timeframe: '15-30 days', count: 156, percentage: 23, color: 'yellow' },
                    { timeframe: '31-60 days', count: 78, percentage: 12, color: 'orange' },
                    { timeframe: '60+ days', count: 21, percentage: 3, color: 'red' }
                  ].map((item, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold">{item.timeframe}</span>
                        <span className="text-gray-600">{item.count} completions ({item.percentage}%)</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div 
                          className={`bg-${item.color}-500 h-3 rounded-full transition-all`}
                          style={{width: `${item.percentage}%`}}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {selectedMetric === 'performance' && (
            <div>
              {/* Performance Stats */}
              <div className="grid grid-cols-4 gap-6 mb-8">
                <StatCard 
                  title="Average Score" 
                  current={87}
                  previous={83}
                  change={4.8}
                  trend="up"
                  icon={Star}
                  color="blue"
                  suffix="%"
                />
                <StatCard 
                  title="Quiz Pass Rate" 
                  current={91}
                  previous={85}
                  change={7.1}
                  trend="up"
                  icon={CheckCircle}
                  color="green"
                  suffix="%"
                />
                <StatCard 
                  title="First Attempt Success" 
                  current={76}
                  previous={68}
                  change={11.8}
                  trend="up"
                  icon={Zap}
                  color="purple"
                  suffix="%"
                />
                <StatCard 
                  title="Avg. Quiz Attempts" 
                  current={1.4}
                  previous={1.8}
                  change={-22.2}
                  trend="down"
                  icon={RefreshCw}
                  color="orange"
                />
              </div>

              {/* Score Distribution */}
              <div className="grid lg:grid-cols-2 gap-6 mb-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                  <h3 className="text-xl font-bold mb-6">Score Distribution</h3>
                  <div className="h-64 flex items-end justify-around space-x-2">
                    {[
                      { range: '0-50', count: 23, color: 'red' },
                      { range: '51-60', count: 45, color: 'orange' },
                      { range: '61-70', count: 89, color: 'yellow' },
                      { range: '71-80', count: 156, color: 'blue' },
                      { range: '81-90', count: 234, color: 'green' },
                      { range: '91-100', count: 312, color: 'emerald' }
                    ].map((range, i) => (
                      <div key={i} className="flex flex-col items-center flex-1">
                        <div 
                          className={`w-full bg-${range.color}-500 rounded-t-lg hover:bg-${range.color}-600 transition-all cursor-pointer`}
                          style={{height: `${(range.count / 350) * 200}px`}}
                        ></div>
                        <span className="text-xs text-gray-600 mt-2 font-medium">{range.range}</span>
                        <span className="text-xs text-gray-500">{range.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                  <h3 className="text-xl font-bold mb-6">Performance Insights</h3>
                  <div className="space-y-4">
                    <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                      <div className="flex items-start">
                        <CheckCircle className="w-5 h-5 text-green-600 mr-3 mt-0.5" />
                        <div>
                          <p className="font-semibold text-green-900">High Performance</p>
                          <p className="text-sm text-green-800 mt-1">67% of learners score above 80%, indicating strong content understanding</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                      <div className="flex items-start">
                        <TrendingUp className="w-5 h-5 text-blue-600 mr-3 mt-0.5" />
                        <div>
                          <p className="font-semibold text-blue-900">Improving Trend</p>
                          <p className="text-sm text-blue-800 mt-1">Average scores have increased by 4.8% over the last 30 days</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl">
                      <div className="flex items-start">
                        <AlertCircle className="w-5 h-5 text-orange-600 mr-3 mt-0.5" />
                        <div>
                          <p className="font-semibold text-orange-900">Attention Needed</p>
                          <p className="text-sm text-orange-800 mt-1">8% of learners consistently score below 60% - may need additional support</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Top and Bottom Performing Content */}
              <div className="grid lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                  <h3 className="text-xl font-bold mb-6 flex items-center">
                    <Trophy className="w-6 h-6 text-yellow-500 mr-2" />
                    Best Performing Content
                  </h3>
                  <div className="space-y-3">
                    {[
                      { title: 'Module 3: Advanced Features', score: 94, completion: 96 },
                      { title: 'Module 1: Introduction', score: 92, completion: 98 },
                      { title: 'Module 5: Best Practices', score: 91, completion: 89 },
                      { title: 'Module 2: Core Concepts', score: 89, completion: 92 }
                    ].map((content, i) => (
                      <div key={i} className="p-4 bg-green-50 rounded-xl border border-green-200">
                        <p className="font-semibold mb-2">{content.title}</p>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Avg Score: <span className="font-semibold text-green-700">{content.score}%</span></span>
                          <span className="text-gray-600">Completion: <span className="font-semibold text-green-700">{content.completion}%</span></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                  <h3 className="text-xl font-bold mb-6 flex items-center">
                    <AlertCircle className="w-6 h-6 text-orange-500 mr-2" />
                    Content Needing Improvement
                  </h3>
                  <div className="space-y-3">
                    {[
                      { title: 'Module 7: Technical Deep Dive', score: 68, completion: 62, issue: 'High drop-off rate' },
                      { title: 'Module 9: Complex Scenarios', score: 71, completion: 65, issue: 'Low quiz scores' },
                      { title: 'Module 6: Integration Guide', score: 73, completion: 69, issue: 'Many retakes needed' },
                      { title: 'Module 8: Troubleshooting', score: 75, completion: 71, issue: 'Time-consuming' }
                    ].map((content, i) => (
                      <div key={i} className="p-4 bg-orange-50 rounded-xl border border-orange-200">
                        <p className="font-semibold mb-1">{content.title}</p>
                        <p className="text-xs text-orange-600 mb-2">{content.issue}</p>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Avg Score: <span className="font-semibold text-orange-700">{content.score}%</span></span>
                          <span className="text-gray-600">Completion: <span className="font-semibold text-orange-700">{content.completion}%</span></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CoursifyAnalytics;