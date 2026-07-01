'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  ThemeFilterTab,
  ThemeStatCard,
  legacyStatColor,
  themeDelta,
} from '@/components/ui/ThemeStatCard';
import { headerPrimaryBtn, primaryBtn, toolbarToggleBtn, pageHeaderActions } from '@/components/ui/theme-classes';
import { 
  Users, BarChart3, Clock, Calendar, Download, Filter, Target, Activity, Percent, Trophy, BookOpen,
  ArrowUp, ArrowDown, RefreshCw, CheckCircle, Star, Zap, TrendingUp, TrendingDown, AlertCircle,
  Monitor, Smartphone, Award
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCachedFetch } from '@/lib/use-cached-fetch';
import {
  type AnalyticsLearner,
  collectDepartmentOptions,
  filterLearnersByDepartment,
} from '@/lib/analytics-filters';

const renderAnalyticsStat = ({
  title,
  current,
  previous,
  change,
  trend,
  icon: Icon,
  color,
  suffix = '',
  comparisonMode = false,
}: {
  title: string;
  current: number | string;
  previous: number | string;
  change: number;
  trend: 'up' | 'down';
  icon: React.ElementType;
  color: 'blue' | 'green' | 'purple' | 'orange';
  suffix?: string;
  comparisonMode?: boolean;
}) => (
  <ThemeStatCard
    icon={Icon}
    title={title}
    value={<>{current}{suffix}</>}
    variant={legacyStatColor(color)}
    delta={themeDelta(trend === 'up' ? change : -change, comparisonMode ? 'vs last period' : '')}
    footnote={comparisonMode ? `vs ${previous}${suffix} last period` : undefined}
  />
);

const StatCard = (props: Parameters<typeof renderAnalyticsStat>[0]) => renderAnalyticsStat(props);

const Analytics: React.FC<{ setCurrentView?: (view: string) => void }> = ({ setCurrentView }) => {
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

type StatBlock = { current: number; previous: number; change: number; trend: 'up' | 'down' };

  const [engagementStats, setEngagementStats] = useState<{
    dailyActiveUsers: StatBlock;
    avgSessionMinutes: StatBlock;
    newEnrollments: StatBlock;
    returnRate: StatBlock;
  }>({
    dailyActiveUsers: { current: 0, previous: 0, change: 0, trend: 'up' },
    avgSessionMinutes: { current: 0, previous: 0, change: 0, trend: 'up' },
    newEnrollments: { current: 0, previous: 0, change: 0, trend: 'up' },
    returnRate: { current: 0, previous: 0, change: 0, trend: 'up' },
  });
  const [completionStats, setCompletionStats] = useState<{
    totalCompletions: StatBlock;
    completionRate: StatBlock;
    certificatesIssued: StatBlock;
    avgDaysToComplete: StatBlock;
  }>({
    totalCompletions: { current: 0, previous: 0, change: 0, trend: 'up' },
    completionRate: { current: 0, previous: 0, change: 0, trend: 'up' },
    certificatesIssued: { current: 0, previous: 0, change: 0, trend: 'up' },
    avgDaysToComplete: { current: 0, previous: 0, change: 0, trend: 'up' },
  });
  const [performanceStats, setPerformanceStats] = useState<{
    avgQuizScore: StatBlock;
    passRate: StatBlock;
    avgCompletion: StatBlock;
    satisfaction: StatBlock;
  }>({
    avgQuizScore: { current: 0, previous: 0, change: 0, trend: 'up' },
    passRate: { current: 0, previous: 0, change: 0, trend: 'up' },
    avgCompletion: { current: 0, previous: 0, change: 0, trend: 'up' },
    satisfaction: { current: 0, previous: 0, change: 0, trend: 'up' },
  });
  const [peakHours, setPeakHours] = useState<Array<{ hour: string; users: number }>>([]);
  const [completionByCourse, setCompletionByCourse] = useState<Array<{ category: string; rate: number; courses: number; color: string }>>([]);
  const [courseOptions, setCourseOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [allLearners, setAllLearners] = useState<AnalyticsLearner[]>([]);
  const [enrollments, setEnrollments] = useState<Array<{ course_id: string; user_id: string; progress_percentage?: number; completed_at: string | null }>>([]);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const analyticsRange = dateRange === 'year' ? '90days' : dateRange === 'custom' ? '30days' : dateRange;
  const analyticsUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? `/api/instructor/analytics?range=${analyticsRange}`
    : null;
  const { data: analyticsData, loading } = useCachedFetch<Record<string, unknown>>(
    `instructor:analytics:${analyticsRange}`,
    analyticsUrl,
    [analyticsRange]
  );

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      setConfigMissing(true);
      return;
    }
    if (!analyticsData) return;
    setConfigMissing(false);
    const overview = (analyticsData.overview ?? {}) as Record<string, unknown>;
    setOverviewStats({
      totalLearners: (overview.totalLearners as typeof overviewStats.totalLearners) ?? { current: 0, previous: 0, change: 0, trend: 'up' },
      activeLearners: (overview.activeLearners as typeof overviewStats.activeLearners) ?? { current: 0, previous: 0, change: 0, trend: 'up' },
      coursesCompleted: (overview.coursesCompleted as typeof overviewStats.coursesCompleted) ?? { current: 0, previous: 0, change: 0, trend: 'up' },
      avgCompletionRate: (overview.avgCompletionRate as typeof overviewStats.avgCompletionRate) ?? { current: 0, previous: 0, change: 0, trend: 'up' },
    });
    const coursePerformanceList = Array.isArray(analyticsData.coursePerformance) ? analyticsData.coursePerformance as CoursePerformanceItem[] : [];
    setCoursePerformance(coursePerformanceList);
    const engagement = analyticsData.engagement as { stats?: typeof engagementStats; peakHours?: typeof peakHours } | undefined;
    if (engagement?.stats) setEngagementStats(engagement.stats);
    if (Array.isArray(engagement?.peakHours)) setPeakHours(engagement.peakHours);
    const completion = analyticsData.completion as { stats?: typeof completionStats; byCourse?: typeof completionByCourse } | undefined;
    if (completion?.stats) setCompletionStats(completion.stats);
    if (Array.isArray(completion?.byCourse)) setCompletionByCourse(completion.byCourse);
    const performance = analyticsData.performance as { stats?: typeof performanceStats } | undefined;
    if (performance?.stats) setPerformanceStats(performance.stats);
    if (Array.isArray(analyticsData.courseOptions)) setCourseOptions(analyticsData.courseOptions as Array<{ id: string; name: string }>);
  }, [analyticsData]);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;
    Promise.all([
      fetch('/api/instructor/learners', { credentials: 'include' }).then((res) => res.json()),
      supabase
        .from('enrollments')
        .select('course_id, user_id, progress_percentage, completed_at'),
    ])
      .then(([data, enrollRes]) => {
        const rows = Array.isArray(data?.learners) ? data.learners : [];
        const mapped: AnalyticsLearner[] = rows.map(
          (p: {
            id: string;
            full_name?: string | null;
            email?: string | null;
            organization?: string | null;
            enrolledCourses?: number;
            totalProgress?: number;
            averageScore?: number;
            totalTimeSpent?: string;
            lastActive?: string;
          }) => ({
            id: p.id,
            name: p.full_name || 'Learner',
            email: p.email ?? undefined,
            organization: p.organization ?? null,
            courses: p.enrolledCourses ?? 0,
            completion: p.totalProgress ?? 0,
            averageScore: p.averageScore ?? 0,
            totalTimeSpent: p.totalTimeSpent ?? '0h',
            lastActive: p.lastActive ?? '—',
            status: (p.totalProgress ?? 0) < 25 ? 'critical' : 'at-risk',
          }),
        );
        setAllLearners(mapped);
        setEnrollments((enrollRes.data ?? []) as typeof enrollments);
      })
      .catch(() => {
        setAllLearners([]);
        setEnrollments([]);
      });
  }, [analyticsData]);

  const departmentOptions = useMemo(() => collectDepartmentOptions(allLearners), [allLearners]);

  const filteredLearners = useMemo(
    () => filterLearnersByDepartment(allLearners, selectedDepartment),
    [allLearners, selectedDepartment],
  );

  const filteredAtRiskLearners = useMemo(
    () => filteredLearners.filter((l) => l.completion < 50).slice(0, 20),
    [filteredLearners],
  );

  const topPerformers = useMemo(
    () =>
      [...filteredLearners]
        .sort((a, b) => b.completion - a.completion || b.averageScore - a.averageScore)
        .slice(0, 5)
        .map((l, i) => ({
          name: l.name,
          courses: l.courses,
          score: l.averageScore || l.completion,
          time: l.totalTimeSpent,
          rank: i + 1,
        })),
    [filteredLearners],
  );

  const departmentBreakdown = useMemo(() => {
    const palette = ['blue', 'green', 'purple', 'orange', 'pink', 'teal'];
    const groups: Record<string, { learners: number; progressSum: number; scoreSum: number; scoreCount: number }> = {};
    filteredLearners.forEach((l) => {
      const key = (l.organization ?? '').trim() || 'Unassigned';
      if (!groups[key]) groups[key] = { learners: 0, progressSum: 0, scoreSum: 0, scoreCount: 0 };
      groups[key].learners++;
      groups[key].progressSum += l.completion;
      if (l.averageScore > 0) {
        groups[key].scoreSum += l.averageScore;
        groups[key].scoreCount++;
      }
    });
    return Object.entries(groups)
      .map(([name, g], i) => ({
        name,
        learners: g.learners,
        completion: g.learners ? Math.round(g.progressSum / g.learners) : 0,
        avgScore: g.scoreCount ? Math.round(g.scoreSum / g.scoreCount) : 0,
        color: palette[i % palette.length],
      }))
      .sort((a, b) => b.learners - a.learners)
      .slice(0, 6);
  }, [filteredLearners]);

  const filteredCoursePerformance = useMemo(() => {
    const base =
      selectedCourse === 'all'
        ? coursePerformance
        : coursePerformance.filter((c) => String(c.id) === selectedCourse);

    if (selectedDepartment === 'all') return base;

    const deptUserIds = new Set(filteredLearners.map((l) => l.id));
    return base
      .map((course) => {
        const courseEnrollments = enrollments.filter(
          (e) => String(e.course_id) === String(course.id) && deptUserIds.has(e.user_id),
        );
        const enrolled = courseEnrollments.length;
        const completed = courseEnrollments.filter((e) => e.completed_at).length;
        const inProgress = Math.max(0, enrolled - completed);
        const completionRate = enrolled ? Math.round((completed / enrolled) * 100) : 0;
        return { ...course, enrolled, completed, inProgress, completionRate };
      })
      .filter((c) => c.enrolled > 0 || selectedCourse !== 'all');
  }, [coursePerformance, selectedCourse, selectedDepartment, filteredLearners, enrollments]);

  const exportAnalyticsCsv = () => {
    const headers = ['Course', 'Enrolled', 'Completed', 'In Progress', 'Completion %', 'Avg Time', 'Drop-off Rate %'];
    const rows = filteredCoursePerformance.map((c) => [c.name, c.enrolled, c.completed, c.inProgress, c.completionRate, c.avgTime, c.dropOffRate]);
    const csv = [headers.join(',')].concat(rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${dateRange}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const engagementData = { daily: [] as Array<{ date: string; active: number; newEnrollments: number; completions: number }>, peakHours };

  const completionFunnel: Array<{ stage: string; count: number; percentage: number; color: string }> = [];
  const deviceBreakdown: Array<{ device: string; users: number; percentage: number; icon: typeof Monitor }> = [];

  const handleSendRemindersToAtRisk = async () => {
    const targets = filteredAtRiskLearners.slice(0, 10);
    if (targets.length === 0) {
      setActionMessage('No at-risk learners to remind.');
      setTimeout(() => setActionMessage(null), 4000);
      return;
    }
    let sent = 0;
    for (const learner of targets) {
      try {
        const res = await fetch('/api/email/reminder', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: learner.id,
            toEmail: learner.email,
            learnerName: learner.name,
            note: 'We noticed you have not been active recently. Continue your learning on Coursify when you can.',
          }),
        });
        if (res.ok) sent++;
      } catch {
        // continue
      }
    }
    setActionMessage(sent > 0 ? `Reminders sent to ${sent} learner(s).` : 'Could not send reminders. Check RESEND_API_KEY.');
    setTimeout(() => setActionMessage(null), 5000);
  };

  const handleContactAtRiskLearner = (learner: AnalyticsLearner) => {
    if (learner.email) {
      window.location.href = `mailto:${encodeURIComponent(learner.email)}?subject=${encodeURIComponent('Checking in on your Coursify progress')}`;
      return;
    }
    setCurrentView?.('learners');
    sessionStorage.setItem('learners-tab', 'at-risk');
  };

  const content = (
    <div className="min-h-full bg-canvas">
      {configMissing ? (
        <div className="bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800 px-8 py-2 text-sm text-amber-800 dark:text-amber-200">
          Configure Supabase to see analytics.
        </div>
      ) : null}
      {actionMessage ? (
        <div className="bg-green-50 dark:bg-green-900/30 border-b border-green-200 dark:border-green-800 px-8 py-2 text-sm text-green-800 dark:text-green-200">
          {actionMessage}
        </div>
      ) : null}
      <div className="bg-surface border-b border-line px-8 py-6 sticky top-0 z-20">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-content">Analytics Dashboard</h1>
            <div className="flex items-center mt-2 text-sm text-content-secondary">
              <Calendar className="w-4 h-4 mr-2" />
              <span>Last updated: Just now</span>
              <span className="mx-2">•</span>
              <span>Showing data for {dateRange === '7days' ? 'last 7 days' : dateRange === '90days' ? 'last 90 days' : 'last 30 days'}</span>
            </div>
          </div>
          <div className={pageHeaderActions}>
            <button 
              type="button"
              onClick={() => setComparisonMode(!comparisonMode)}
              className={toolbarToggleBtn(comparisonMode)}
            >
              <RefreshCw className="w-4 h-4" />
              Compare
            </button>
            <button 
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={toolbarToggleBtn(showFilters)}
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>
            <button type="button" onClick={exportAnalyticsCsv} className={headerPrimaryBtn}>
              <Download className="w-4 h-4" />
              Export Report
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-raised rounded-xl p-4 mb-4 border border-line">
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Date Range</label>
                <select 
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand"
                >
                  <option value="all">All Courses</option>
                  {courseOptions.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Department</label>
                <select 
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand"
                >
                  <option value="all">All Departments</option>
                  <option value="sales">Sales</option>
                  <option value="engineering">Engineering</option>
                  <option value="marketing">Marketing</option>
                  <option value="unassigned">Unassigned</option>
                  {departmentOptions.map((org) => (
                    <option key={org} value={org}>{org}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => setShowFilters(false)}
                  className={`w-full ${primaryBtn}`}
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Metric Tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          <ThemeFilterTab active={selectedMetric === 'overview'} onClick={() => setSelectedMetric('overview')}>
            Overview
          </ThemeFilterTab>
          <ThemeFilterTab active={selectedMetric === 'engagement'} onClick={() => setSelectedMetric('engagement')}>
            Engagement
          </ThemeFilterTab>
          <ThemeFilterTab active={selectedMetric === 'completion'} onClick={() => setSelectedMetric('completion')}>
            Completion
          </ThemeFilterTab>
          <ThemeFilterTab active={selectedMetric === 'performance'} onClick={() => setSelectedMetric('performance')}>
            Performance
          </ThemeFilterTab>
        </div>
      </div>

      {/* Content Area */}
      <div className="p-8">
        {selectedMetric === 'overview' && (
          <div>
            {/* Overview Stats */}
            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 ${loading ? 'animate-pulse' : ''}`}>
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
              <div className="app-card rounded-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-bold">Engagement Trend</h3>
                    <p className="text-sm text-gray-600 mt-1">Daily active learners and completions</p>
                  </div>
                  <button
                    type="button"
                    onClick={exportAnalyticsCsv}
                    className="p-2 hover:bg-raised rounded-lg"
                    title="Download CSV"
                  >
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
              <div className="app-card rounded-lg p-6">
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
                      pink: 'bg-pink-500',
                      teal: 'bg-teal-500',
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
              <div className="app-card rounded-lg p-6">
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
              <div className="app-card rounded-lg p-6">
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
              <div className="app-card rounded-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold">Top Performers</h3>
                  <Trophy className="w-6 h-6 text-yellow-500" />
                </div>
                <div className="space-y-3">
                  {topPerformers.length === 0 ? (
                    <div className="py-6 text-center text-gray-500 text-sm">No data yet.</div>
                  ) : topPerformers.map((performer, i) => (
                    <div key={i} className="flex items-center p-3 bg-raised rounded-xl hover:bg-canvas transition-all">
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
            <div className="app-card rounded-lg overflow-hidden">
              <div className="p-6 border-b border-line">
                <h3 className="text-xl font-bold text-content">Course Performance</h3>
                <p className="text-sm text-content-secondary mt-1">Detailed metrics for all courses</p>
              </div>
              <div className="overflow-x-auto">
                <table className="c-table">
                  <thead>
                    <tr>
                      <th>Course Name</th>
                      <th>Enrolled</th>
                      <th>Completed</th>
                      <th>Completion Rate</th>
                      <th>Avg. Score</th>
                      <th>Avg. Time</th>
                      <th>Drop-off</th>
                      <th>Satisfaction</th>
                      <th>Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coursePerformance.length === 0 ? (
                      <tr><td colSpan={9} className="px-6 py-8 text-center text-content-muted text-sm">No courses yet.</td></tr>
                    ) : filteredCoursePerformance.map((course) => (
                      <tr key={course.id}>
                        <td>
                          <p className="font-semibold text-content">{course.name}</p>
                        </td>
                        <td>
                          <span className="font-semibold text-content">{course.enrolled}</span>
                        </td>
                        <td>
                          <span className="font-semibold text-ok">{course.completed}</span>
                          <span className="text-content-secondary text-sm ml-1">({course.inProgress} in progress)</span>
                        </td>
                        <td>
                          <div className="flex items-center space-x-2">
                            <div className="w-20 c-progress h-2">
                              <div 
                                className={`c-progress-fill h-2 ${
                                  course.completionRate >= 85 ? 'ok' :
                                  course.completionRate >= 70 ? 'warn' : ''
                                }`}
                                style={{width: `${course.completionRate}%`}}
                              />
                            </div>
                            <span className="text-sm font-semibold text-content">{course.completionRate}%</span>
                          </div>
                        </td>
                        <td>
                          <span className={`font-semibold ${
                            course.avgScore >= 90 ? 'text-ok' :
                            course.avgScore >= 75 ? 'text-warn' :
                            'text-err'
                          }`}>
                            {course.avgScore}%
                          </span>
                        </td>
                        <td>
                          <span className="text-content-secondary">{course.avgTime}</span>
                        </td>
                        <td>
                          <span className={`c-badge ${
                            course.dropOffRate < 15 ? 'c-badge-ok' :
                            course.dropOffRate < 25 ? 'c-badge-warn' :
                            'c-badge-err'
                          }`}>
                            {course.dropOffRate}%
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center">
                            <Star className="w-4 h-4 text-warn fill-current mr-1" />
                            <span className="font-semibold text-content">{course.satisfaction}</span>
                          </div>
                        </td>
                        <td>
                          <div className={`flex items-center space-x-1 ${
                            course.trend === 'up' ? 'text-ok' : 'text-err'
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
                current={engagementStats.dailyActiveUsers.current}
                previous={engagementStats.dailyActiveUsers.previous}
                change={engagementStats.dailyActiveUsers.change}
                trend={engagementStats.dailyActiveUsers.trend}
                icon={Activity}
                color="blue"
                comparisonMode={comparisonMode}
              />
              <StatCard 
                title="Avg. Session Time" 
                current={`${engagementStats.avgSessionMinutes.current}m`}
                previous={`${engagementStats.avgSessionMinutes.previous}m`}
                change={engagementStats.avgSessionMinutes.change}
                trend={engagementStats.avgSessionMinutes.trend}
                icon={Clock}
                color="green"
                comparisonMode={comparisonMode}
              />
              <StatCard 
                title="New Enrollments" 
                current={engagementStats.newEnrollments.current}
                previous={engagementStats.newEnrollments.previous}
                change={engagementStats.newEnrollments.change}
                trend={engagementStats.newEnrollments.trend}
                icon={Users}
                color="purple"
                comparisonMode={comparisonMode}
              />
              <StatCard 
                title="Return Rate" 
                current={engagementStats.returnRate.current}
                previous={engagementStats.returnRate.previous}
                change={engagementStats.returnRate.change}
                trend={engagementStats.returnRate.trend}
                icon={RefreshCw}
                color="orange"
                suffix="%"
                comparisonMode={comparisonMode}
              />
            </div>

            {/* Peak Hours Chart */}
            <div className="app-card rounded-lg p-6 mb-6">
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
            <div className="app-card rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold">At-Risk Learners</h3>
                  <p className="text-sm text-gray-600 mt-1">Learners who need attention</p>
                </div>
                <button
                  type="button"
                  onClick={handleSendRemindersToAtRisk}
                  className={`${primaryBtn} flex items-center`}
                >
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Send Reminders
                </button>
              </div>
              
              <div className="space-y-3">
                {filteredAtRiskLearners.length === 0 ? (
                  <div className="py-6 text-center text-gray-500 text-sm">No at-risk learners.</div>
                ) : filteredAtRiskLearners.map((learner) => (
                  <div key={learner.id} className="flex items-center justify-between p-4 bg-raised rounded-xl hover:bg-canvas transition-all">
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
                      <button
                        type="button"
                        onClick={() => handleContactAtRiskLearner(learner)}
                        className={primaryBtn}
                      >
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
                current={completionStats.totalCompletions.current}
                previous={completionStats.totalCompletions.previous}
                change={completionStats.totalCompletions.change}
                trend={completionStats.totalCompletions.trend}
                icon={CheckCircle}
                color="green"
                comparisonMode={comparisonMode}
              />
              <StatCard 
                title="Completion Rate" 
                current={completionStats.completionRate.current}
                previous={completionStats.completionRate.previous}
                change={completionStats.completionRate.change}
                trend={completionStats.completionRate.trend}
                icon={Percent}
                color="blue"
                suffix="%"
                comparisonMode={comparisonMode}
              />
              <StatCard 
                title="Certificates Issued" 
                current={completionStats.certificatesIssued.current}
                previous={completionStats.certificatesIssued.previous}
                change={completionStats.certificatesIssued.change}
                trend={completionStats.certificatesIssued.trend}
                icon={Award}
                color="purple"
                comparisonMode={comparisonMode}
              />
              <StatCard 
                title="Avg. Time to Complete" 
                current={`${completionStats.avgDaysToComplete.current}d`}
                previous={`${completionStats.avgDaysToComplete.previous}d`}
                change={completionStats.avgDaysToComplete.change}
                trend={completionStats.avgDaysToComplete.trend}
                icon={Clock}
                color="orange"
                comparisonMode={comparisonMode}
              />
            </div>

            {/* Completion by Course Type */}
            <div className="app-card rounded-lg p-6 mb-6">
              <h3 className="text-xl font-bold mb-6">Completion Rate by Course</h3>
              <div className="grid grid-cols-2 gap-6">
                {completionByCourse.length === 0 ? (
                  <p className="text-sm text-gray-500 col-span-2">No completion data yet.</p>
                ) : completionByCourse.map((cat, i) => {
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
            <div className="app-card rounded-lg p-6">
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
                current={performanceStats.avgQuizScore.current}
                previous={performanceStats.avgQuizScore.previous}
                change={performanceStats.avgQuizScore.change}
                trend={performanceStats.avgQuizScore.trend}
                icon={Star}
                color="blue"
                suffix="%"
                comparisonMode={comparisonMode}
              />
              <StatCard 
                title="Quiz Pass Rate" 
                current={performanceStats.passRate.current}
                previous={performanceStats.passRate.previous}
                change={performanceStats.passRate.change}
                trend={performanceStats.passRate.trend}
                icon={CheckCircle}
                color="green"
                suffix="%"
                comparisonMode={comparisonMode}
              />
              <StatCard 
                title="Avg Completion" 
                current={performanceStats.avgCompletion.current}
                previous={performanceStats.avgCompletion.previous}
                change={performanceStats.avgCompletion.change}
                trend={performanceStats.avgCompletion.trend}
                icon={Zap}
                color="purple"
                suffix="%"
                comparisonMode={comparisonMode}
              />
              <StatCard 
                title="Satisfaction" 
                current={performanceStats.satisfaction.current}
                previous={performanceStats.satisfaction.previous}
                change={performanceStats.satisfaction.change}
                trend={performanceStats.satisfaction.trend}
                icon={RefreshCw}
                color="orange"
                suffix="%"
                comparisonMode={comparisonMode}
              />
            </div>

            {/* Score Distribution */}
            <div className="grid lg:grid-cols-2 gap-6 mb-6">
              <div className="app-card rounded-lg p-6">
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

              <div className="app-card rounded-lg p-6">
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
              <div className="app-card rounded-lg p-6">
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

              <div className="app-card rounded-lg p-6">
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
