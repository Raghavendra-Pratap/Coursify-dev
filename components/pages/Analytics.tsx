'use client'

import React, { useState, useEffect } from 'react';
import { 
  Users, BarChart3, Clock, Calendar, Download, Filter, Target, Activity, Percent, Trophy, BookOpen,
  ArrowUp, ArrowDown, RefreshCw, CheckCircle, Star, Zap, TrendingUp, TrendingDown, AlertCircle,
  Monitor, Smartphone, Award
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

const StatCard = ({ title, current, previous, change, trend, icon: Icon, color, suffix = '', comparisonMode = false }: {
  title: string;
  current: number | string;
  previous: number | string;
  change: number;
  trend: 'up' | 'down';
  icon: React.ElementType;
  color: 'blue' | 'green' | 'purple' | 'orange';
  suffix?: string;
  comparisonMode?: boolean;
}) => {
  const isPositive = trend === 'up';
  const changeValue = Math.abs(change);
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    purple: 'from-purple-500 to-purple-600',
    orange: 'from-orange-500 to-orange-600'
  };
  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} text-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all cursor-pointer`}>
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
        <p className="text-xs opacity-90 mt-2">vs {previous}{suffix} last period</p>
      )}
    </div>
  );
};

const Analytics: React.FC = () => {
  const [dateRange, setDateRange] = useState('30days');
  const [selectedMetric, setSelectedMetric] = useState('overview');
  const [comparisonMode, setComparisonMode] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState('all');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [configMissing, setConfigMissing] = useState(false);

  const [overviewStats, setOverviewStats] = useState({
    totalLearners: { current: 0, previous: 0, change: 0, trend: 'up' as const },
    activeLearners: { current: 0, previous: 0, change: 0, trend: 'up' as const },
    coursesCompleted: { current: 0, previous: 0, change: 0, trend: 'up' as const },
    avgCompletionRate: { current: 0, previous: 0, change: 0, trend: 'up' as const }
  });

  type CoursePerformanceItem = { id: number | string; name: string; enrolled: number; completed: number; inProgress: number; completionRate: number; avgScore: number; avgTime: string; dropOffRate: number; satisfaction: number; trend: string; trendValue: number };
  const [coursePerformance, setCoursePerformance] = useState<CoursePerformanceItem[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
        setConfigMissing(true);
        return;
      }
      setConfigMissing(false);
      try {
        const res = await fetch('/api/instructor/analytics', { credentials: 'include', cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setConfigMissing(true);
          return;
        }
        const overview = data.overview ?? { totalLearners: 0, activeLearners: 0, coursesCompleted: 0, avgCompletionRate: 0 };
        const coursePerformanceList = Array.isArray(data.coursePerformance) ? data.coursePerformance : [];
        setOverviewStats({
          totalLearners: { current: overview.totalLearners ?? 0, previous: 0, change: 0, trend: 'up' },
          activeLearners: { current: overview.activeLearners ?? 0, previous: 0, change: 0, trend: 'up' },
          coursesCompleted: { current: overview.coursesCompleted ?? 0, previous: 0, change: 0, trend: 'up' },
          avgCompletionRate: { current: overview.avgCompletionRate ?? 0, previous: 0, change: 0, trend: 'up' }
        });
        setCoursePerformance(coursePerformanceList.map((c: { id: string | number; name: string; enrolled: number; completed: number; inProgress: number; completionRate: number }) => ({
          id: c.id,
          name: c.name,
          enrolled: c.enrolled,
          completed: c.completed,
          inProgress: c.inProgress,
          completionRate: c.completionRate ?? 0,
          avgScore: 0,
          avgTime: '—',
          dropOffRate: 0,
          satisfaction: 0,
          trend: 'up',
          trendValue: 0
        })));
      } catch {
        setConfigMissing(true);
      }
    };
    load();
  }, []);

  const engagementData = { daily: [] as Array<{ date: string; active: number; newEnrollments: number; completions: number }>, peakHours: [] as Array<{ hour: string; users: number }> };

  const departmentBreakdown: Array<{ name: string; learners: number; completion: number; avgScore: number; color: string }> = [];
  const completionFunnel: Array<{ stage: string; count: number; percentage: number; color: string }> = [];
  const deviceBreakdown: Array<{ device: string; users: number; percentage: number; icon: typeof Monitor }> = [];
  const topPerformers: Array<{ name: string; courses: number; score: number; time: string; rank: number }> = [];
  const atRiskLearners: Array<{ name: string; courses: number; completion: number; lastActive: string; status: string }> = [];

  const content = (
    <div className="min-h-full dark:bg-gray-900">
      {configMissing ? (
        <div className="bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800 px-8 py-2 text-sm text-amber-800 dark:text-amber-200">
          Configure Supabase to see analytics.
        </div>
      ) : null}
      <div className="bg-white dark:bg-gray-900 dark:border-gray-800 border-b border-gray-200 dark:border-gray-800 px-8 py-6 sticky top-0 z-20">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Analytics Dashboard</h1>
            <div className="flex items-center mt-2 text-sm text-gray-600 dark:text-gray-400">
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
                comparisonMode ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Compare
            </button>
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-semibold flex items-center transition-all"
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
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-4 border border-gray-200 dark:border-gray-700">
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
                comparisonMode={comparisonMode}
              />
              <StatCard 
                title="Active Learners" 
                current={overviewStats.activeLearners.current}
                previous={overviewStats.activeLearners.previous}
                change={overviewStats.activeLearners.change}
                trend={overviewStats.activeLearners.trend}
                icon={Activity}
                color="green"
                comparisonMode={comparisonMode}
              />
              <StatCard 
                title="Courses Completed" 
                current={overviewStats.coursesCompleted.current}
                previous={overviewStats.coursesCompleted.previous}
                change={overviewStats.coursesCompleted.change}
                trend={overviewStats.coursesCompleted.trend}
                icon={CheckCircle}
                color="purple"
                comparisonMode={comparisonMode}
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
                comparisonMode={comparisonMode}
              />
            </div>

            {/* Charts Row 1 */}
            <div className="grid lg:grid-cols-2 gap-6 mb-6">
              {/* Engagement Trend */}
              <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
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
                  {engagementData.daily.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">No engagement data yet.</div>
                  ) : engagementData.daily.map((day, i) => (
                    <div key={i} className="flex flex-col items-center flex-1 group relative">
                      <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-2 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap transition-opacity z-10">
                        <p className="font-semibold">{day.date}</p>
                        <p>Active: {day.active}</p>
                        <p>Enrolled: {day.newEnrollments}</p>
                        <p>Completed: {day.completions}</p>
                      </div>
                      
                      <div className="w-full flex flex-col items-center">
                        <div 
                          className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-lg transition-all hover:from-blue-600 hover:to-blue-500 cursor-pointer" 
                          style={{height: `${Math.max(4, (day.active / 400) * 200)}px`}}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-600 mt-2 font-medium">{day.date.split(' ')[1]}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Department Breakdown */}
              <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-bold">Department Performance</h3>
                    <p className="text-sm text-gray-600 mt-1">Completion rates by department</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  {departmentBreakdown.length === 0 ? (
                    <div className="py-6 text-center text-gray-500 text-sm">No department data yet.</div>
                  ) : departmentBreakdown.map((dept, i) => {
                    const colorClasses: Record<string, string> = {
                      blue: 'bg-blue-500',
                      purple: 'bg-purple-500',
                      green: 'bg-green-500',
                      orange: 'bg-orange-500',
                      pink: 'bg-pink-500'
                    };
                    return (
                      <div key={i} className="group">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center flex-1">
                            <div className={`w-3 h-3 rounded-full ${colorClasses[dept.color]} mr-3`}></div>
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
                            className={`${colorClasses[dept.color]} h-3 rounded-full transition-all`}
                            style={{width: `${dept.completion}%`}}
                          ></div>
                        </div>
                      </div>
                    );
                  })
                  }
                </div>
              </div>
            </div>

            {/* Charts Row 2 */}
            <div className="grid lg:grid-cols-3 gap-6 mb-6">
              {/* Completion Funnel */}
              <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
                <h3 className="text-xl font-bold mb-6">Completion Funnel</h3>
                <div className="space-y-3">
                  {completionFunnel.length === 0 ? (
                    <div className="py-6 text-center text-gray-500 text-sm">No funnel data yet.</div>
                  ) : completionFunnel.map((stage, i) => (
                    <div key={i} className="relative">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold">{stage.stage}</span>
                        <span className="text-sm font-semibold">{stage.count}</span>
                      </div>
                      <div 
                        className={`bg-gradient-to-r ${stage.color} rounded-lg p-3 text-white transition-all hover:shadow-lg cursor-pointer`}
                        style={{width: `${Math.max(5, stage.percentage)}%`}}
                      >
                        <span className="text-sm font-semibold">{stage.percentage}%</span>
                      </div>
                    </div>
                  )) }
                </div>
              </div>

              {/* Device Breakdown */}
              <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
                <h3 className="text-xl font-bold mb-6">Device Usage</h3>
                <div className="space-y-6">
                  {deviceBreakdown.length === 0 ? (
                    <div className="py-6 text-center text-gray-500 text-sm">No device data yet.</div>
                  ) : deviceBreakdown.map((device, i) => {
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
                  })
                  }
                </div>
              </div>

              {/* Top Performers */}
              <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold">Top Performers</h3>
                  <Trophy className="w-6 h-6 text-yellow-500" />
                </div>
                <div className="space-y-3">
                  {topPerformers.length === 0 ? (
                    <div className="py-6 text-center text-gray-500 text-sm">No data yet.</div>
                  ) : topPerformers.map((performer, i) => (
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
                  )) }
                </div>
              </div>
            </div>

            {/* Course Performance Table */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-xl font-bold dark:text-white">Course Performance</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Detailed metrics for all courses</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700/80 border-b-2 border-gray-200 dark:border-gray-600">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200">Course Name</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200">Enrolled</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200">Completed</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200">Completion Rate</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200">Avg. Score</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200">Avg. Time</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200">Drop-off</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200">Satisfaction</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200">Trend</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {coursePerformance.length === 0 ? (
                      <tr><td colSpan={9} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400 text-sm">No courses yet.</td></tr>
                    ) : coursePerformance.map((course) => (
                      <tr key={course.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all">
                        <td className="px-6 py-4">
                          <p className="font-semibold dark:text-white">{course.name}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-semibold dark:text-white">{course.enrolled}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-semibold text-green-600 dark:text-green-400">{course.completed}</span>
                          <span className="text-gray-600 dark:text-gray-400 text-sm ml-1">({course.inProgress} in progress)</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-2">
                            <div className="w-20 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full ${
                                  course.completionRate >= 85 ? 'bg-green-500' :
                                  course.completionRate >= 70 ? 'bg-yellow-500' :
                                  'bg-red-500'
                                }`}
                                style={{width: `${course.completionRate}%`}}
                              ></div>
                            </div>
                            <span className="text-sm font-semibold dark:text-white">{course.completionRate}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`font-semibold ${
                            course.avgScore >= 90 ? 'text-green-600 dark:text-green-400' :
                            course.avgScore >= 75 ? 'text-yellow-600 dark:text-yellow-400' :
                            'text-red-600 dark:text-red-400'
                          }`}>
                            {course.avgScore}%
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-gray-700 dark:text-gray-300">{course.avgTime}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            course.dropOffRate < 15 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                            course.dropOffRate < 25 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                            'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                          }`}>
                            {course.dropOffRate}%
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 mr-1" />
                            <span className="font-semibold dark:text-white">{course.satisfaction}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className={`flex items-center space-x-1 ${
                            course.trend === 'up' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                          }`}>
                            {course.trend === 'up' ? (
                              <TrendingUp className="w-4 h-4" />
                            ) : (
                              <TrendingDown className="w-4 h-4" />
                            )}
                            <span className="text-sm font-semibold dark:text-white">{course.trendValue}%</span>
                          </div>
                        </td>
                      </tr>
                    )) }
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
                comparisonMode={comparisonMode}
              />
              <StatCard 
                title="Avg. Session Time" 
                current="24m"
                previous="19m"
                change={26.3}
                trend="up"
                icon={Clock}
                color="green"
                comparisonMode={comparisonMode}
              />
              <StatCard 
                title="New Enrollments" 
                current={68}
                previous={52}
                change={30.8}
                trend="up"
                icon={Users}
                color="purple"
                comparisonMode={comparisonMode}
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
                comparisonMode={comparisonMode}
              />
            </div>

            {/* Peak Hours Chart */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold">Peak Usage Hours</h3>
                  <p className="text-sm text-gray-600 mt-1">When are learners most active?</p>
                </div>
              </div>
              
              <div className="h-80 flex items-end justify-around space-x-2">
                {engagementData.peakHours.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">No peak hours data yet.</div>
                ) : engagementData.peakHours.map((hour, i) => (
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
                )) }
              </div>
            </div>

            {/* At-Risk Learners */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold">At-Risk Learners</h3>
                  <p className="text-sm text-gray-600 mt-1">Learners who need attention</p>
                </div>
                <button className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-semibold flex items-center">
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Send Reminders
                </button>
              </div>
              
              <div className="space-y-3">
                {atRiskLearners.length === 0 ? (
                  <div className="py-6 text-center text-gray-500 text-sm">No at-risk learners.</div>
                ) : atRiskLearners.map((learner, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all">
                    <div className="flex items-center flex-1">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-white ${
                        learner.status === 'critical' ? 'bg-red-500' : 'bg-orange-500'
                      }`}>
                        {learner.name.split(' ').map((n: string) => n[0]).join('')}
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
                )) }
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
                comparisonMode={comparisonMode}
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
                comparisonMode={comparisonMode}
              />
              <StatCard 
                title="Certificates Issued" 
                current={456}
                previous={378}
                change={20.6}
                trend="up"
                icon={Award}
                color="purple"
                comparisonMode={comparisonMode}
              />
              <StatCard 
                title="Avg. Time to Complete" 
                current="18d"
                previous="24d"
                change={-25.0}
                trend="down"
                icon={Clock}
                color="orange"
                comparisonMode={comparisonMode}
              />
            </div>

            {/* Completion by Course Type */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
              <h3 className="text-xl font-bold mb-6">Completion Rate by Course Category</h3>
              <div className="grid grid-cols-2 gap-6">
                {[
                  { category: 'Onboarding', rate: 92, courses: 4, color: 'blue' },
                  { category: 'Compliance', rate: 87, courses: 3, color: 'purple' },
                  { category: 'Sales Training', rate: 84, courses: 5, color: 'green' },
                  { category: 'Product Knowledge', rate: 81, courses: 6, color: 'orange' },
                  { category: 'Soft Skills', rate: 76, courses: 4, color: 'pink' },
                  { category: 'Technical Skills', rate: 72, courses: 7, color: 'indigo' }
                ].map((cat, i) => {
                  const colorClasses: Record<string, string> = {
                    blue: 'bg-blue-500',
                    purple: 'bg-purple-500',
                    green: 'bg-green-500',
                    orange: 'bg-orange-500',
                    pink: 'bg-pink-500',
                    indigo: 'bg-indigo-500'
                  };
                  return (
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
                          className={`${colorClasses[cat.color]} h-3 rounded-full`}
                          style={{width: `${cat.rate}%`}}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Completion Timeline */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-bold mb-6">Completion Timeline Distribution</h3>
              <div className="space-y-4">
                {[
                  { timeframe: '0-7 days', count: 234, percentage: 35, color: 'green' },
                  { timeframe: '8-14 days', count: 189, percentage: 28, color: 'blue' },
                  { timeframe: '15-30 days', count: 156, percentage: 23, color: 'yellow' },
                  { timeframe: '31-60 days', count: 78, percentage: 12, color: 'orange' },
                  { timeframe: '60+ days', count: 21, percentage: 3, color: 'red' }
                ].map((item, i) => {
                  const colorClasses: Record<string, string> = {
                    green: 'bg-green-500',
                    blue: 'bg-blue-500',
                    yellow: 'bg-yellow-500',
                    orange: 'bg-orange-500',
                    red: 'bg-red-500'
                  };
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold">{item.timeframe}</span>
                        <span className="text-gray-600">{item.count} completions ({item.percentage}%)</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div 
                          className={`${colorClasses[item.color]} h-3 rounded-full transition-all`}
                          style={{width: `${item.percentage}%`}}
                        ></div>
                      </div>
                    </div>
                  );
                })}
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
                comparisonMode={comparisonMode}
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
                comparisonMode={comparisonMode}
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
                comparisonMode={comparisonMode}
              />
              <StatCard 
                title="Avg. Quiz Attempts" 
                current={1.4}
                previous={1.8}
                change={-22.2}
                trend="down"
                icon={RefreshCw}
                color="orange"
                comparisonMode={comparisonMode}
              />
            </div>

            {/* Score Distribution */}
            <div className="grid lg:grid-cols-2 gap-6 mb-6">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
                <h3 className="text-xl font-bold mb-6">Score Distribution</h3>
                <div className="h-64 flex items-end justify-around space-x-2">
                  {[
                    { range: '0-50', count: 23, color: 'red' },
                    { range: '51-60', count: 45, color: 'orange' },
                    { range: '61-70', count: 89, color: 'yellow' },
                    { range: '71-80', count: 156, color: 'blue' },
                    { range: '81-90', count: 234, color: 'green' },
                    { range: '91-100', count: 312, color: 'emerald' }
                  ].map((range, i) => {
                    const colorClasses: Record<string, string> = {
                      red: 'bg-red-500',
                      orange: 'bg-orange-500',
                      yellow: 'bg-yellow-500',
                      blue: 'bg-blue-500',
                      green: 'bg-green-500',
                      emerald: 'bg-emerald-500'
                    };
                    return (
                      <div key={i} className="flex flex-col items-center flex-1">
                        <div 
                          className={`w-full ${colorClasses[range.color]} rounded-t-lg hover:opacity-80 transition-all cursor-pointer`}
                          style={{height: `${(range.count / 350) * 200}px`}}
                        ></div>
                        <span className="text-xs text-gray-600 mt-2 font-medium">{range.range}</span>
                        <span className="text-xs text-gray-500">{range.count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
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
              <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
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

              <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
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
  );
  return content;
};

export default Analytics;
