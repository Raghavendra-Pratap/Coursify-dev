'use client'

import React, { useState, useEffect } from 'react';
import {
  ThemeStatCard,
  ThemeAvatar,
  legacyStatColor,
  themeDelta,
} from '@/components/ui/ThemeStatCard';
import { 
  Play, Users, BarChart3, Settings, Plus, Clock, Video, 
  ChevronRight, Menu, Search, Bell, Award, TrendingUp, Trophy,
  Home, FileText, X, Calendar, Filter, Download, 
  ArrowUp, ArrowDown, Minus, CheckCircle, AlertCircle, XCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchJsonCached, readClientCache, SHELL_CACHE_MS } from '@/lib/client-fetch-cache';

interface DashboardProps {
  setCurrentView: (view: string) => void;
}

type DashboardPayload = {
  stats?: {
    learners: { current: number; previous: number; change: number };
    courses: { current: number; previous: number; change: number };
    completion: { current: number; previous: number; change: number };
    avgTime: { current: number; previous: number; change: number };
  };
  topCourses?: { id: number | string; name: string; completion: number; learners: number; trend: string; trendValue: number; avgTime: string; lastUpdated: string; status: string; dropOffPoint: string }[];
  topLearners?: { id: string; name: string; avatar: string; progress: number; enrolledCourses: number; completedCourses: number; averageScore: number; totalTimeSpent: string; trend: string; trendValue: number; rank: number }[];
  weeklyData?: { week: string; completions: number; enrollments: number; avgTime: number }[];
  recentActivity?: { id: number; user: string; action: string; course: string; time: string; avatar: string; score?: number; type: string }[];
};

const EMPTY_STATS = {
  learners: { current: 0, previous: 0, change: 0 },
  courses: { current: 0, previous: 0, change: 0 },
  completion: { current: 0, previous: 0, change: 0 },
  avgTime: { current: 0, previous: 0, change: 0 },
};

function readDashboardCache(period: string): DashboardPayload | null {
  return readClientCache<DashboardPayload>(`instructor:dashboard:${period}`, SHELL_CACHE_MS);
}

const ACTIVITY_PREVIEW_COUNT = 5;

const Dashboard: React.FC<DashboardProps> = ({ setCurrentView }) => {
  const [selectedPeriod, setSelectedPeriod] = useState('7days');

  useEffect(() => {
    if (selectedPeriod === '90days') setSelectedPeriod('30days');
  }, [selectedPeriod]);
  const [selectedCourse, setSelectedCourse] = useState<number | string | null>(null);
  const [selectedLearner, setSelectedLearner] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);

  const initialCache = readDashboardCache('7days');
  const [stats, setStats] = useState(() => initialCache?.stats ?? EMPTY_STATS);
  const [configMissing, setConfigMissing] = useState(false);
  const [topCourses, setTopCourses] = useState(() => initialCache?.topCourses ?? []);
  const [topLearners, setTopLearners] = useState(() => initialCache?.topLearners ?? []);
  const [weeklyData, setWeeklyData] = useState(() => initialCache?.weeklyData ?? []);
  const [recentActivity, setRecentActivity] = useState(() => initialCache?.recentActivity ?? []);
  const [loading, setLoading] = useState(() => initialCache?.stats == null);

  useEffect(() => {
    const load = async () => {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
        setConfigMissing(true);
        setLoading(false);
        return;
      }
      setConfigMissing(false);
      const cacheKey = `instructor:dashboard:${selectedPeriod}`;
      const cached = readClientCache<DashboardPayload>(cacheKey, SHELL_CACHE_MS);
      if (cached?.stats) {
        setStats(cached.stats);
        if (cached.topCourses) setTopCourses(cached.topCourses);
        if (cached.topLearners) setTopLearners(cached.topLearners);
        if (cached.weeklyData) setWeeklyData(cached.weeklyData);
        if (cached.recentActivity) setRecentActivity(cached.recentActivity);
        setLoading(false);
      }
      try {
        const { data } = await fetchJsonCached<DashboardPayload>(
          cacheKey,
          `/api/instructor/dashboard?period=${selectedPeriod}`,
          { maxAgeMs: SHELL_CACHE_MS }
        );
        if (data.stats) setStats(data.stats);
        if (Array.isArray(data.topCourses)) setTopCourses(data.topCourses);
        if (Array.isArray(data.topLearners)) setTopLearners(data.topLearners);
        if (Array.isArray(data.weeklyData)) setWeeklyData(data.weeklyData);
        if (Array.isArray(data.recentActivity)) setRecentActivity(data.recentActivity);
      } catch {
        if (!cached?.stats) setConfigMissing(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedPeriod]);

  useEffect(() => {
    setShowAllActivity(false);
  }, [selectedPeriod, searchQuery]);

  const handleToggleAllActivity = async () => {
    if (showAllActivity) {
      setShowAllActivity(false);
      return;
    }
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;
    setActivityLoading(true);
    try {
      const res = await fetch(
        `/api/instructor/dashboard?period=${encodeURIComponent(selectedPeriod)}&activityLimit=100`,
        { credentials: 'include' },
      );
      const data = (await res.json()) as DashboardPayload;
      if (Array.isArray(data.recentActivity)) setRecentActivity(data.recentActivity);
      setShowAllActivity(true);
    } catch {
      // keep preview list
    } finally {
      setActivityLoading(false);
    }
  };

  const filteredTopCourses = searchQuery.trim()
    ? topCourses.filter((c) => c.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : topCourses;

  const filteredTopLearners = searchQuery.trim()
    ? topLearners.filter((l) => l.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : topLearners;

  const filteredRecentActivity = searchQuery.trim()
    ? recentActivity.filter(
        (a) =>
          a.user.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
          a.course.toLowerCase().includes(searchQuery.trim().toLowerCase())
      )
    : recentActivity;

  const visibleRecentActivity = showAllActivity
    ? filteredRecentActivity
    : filteredRecentActivity.slice(0, ACTIVITY_PREVIEW_COUNT);

  const exportDashboardCsv = () => {
    const headers = ['Course', 'Learners', 'Completion %', 'Avg Time', 'Drop-off Point']
    const rows = topCourses.map((c) => [c.name, c.learners, c.completion, c.avgTime, c.dropOffPoint])
    const csv = [headers.join(',')].concat(
      rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    ).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dashboard-${selectedPeriod}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  };

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return '0';
    return ((current - previous) / previous * 100).toFixed(1);
  };

  const getActivityIcon = (type: string) => {
    switch(type) {
      case 'completion': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'enrollment': return <Play className="w-5 h-5 text-info" />;
      case 'update': return <AlertCircle className="w-5 h-5 text-orange-600" />;
      case 'failure': return <XCircle className="w-5 h-5 text-red-600" />;
      default: return <AlertCircle className="w-5 h-5 text-content-muted" />;
    }
  };

  const renderStat = (
    icon: React.ElementType,
    title: string,
    current: number,
    previous: number,
    color: 'blue' | 'purple' | 'green' | 'orange',
    unit = '',
  ) => {
    const change = parseFloat(calculateChange(current, previous));
    return (
      <ThemeStatCard
        icon={icon}
        title={title}
        value={<>{current.toLocaleString()}{unit && <span className="text-base font-normal ml-0.5">{unit}</span>}</>}
        variant={legacyStatColor(color)}
        delta={themeDelta(change, 'vs last period')}
        footnote={`vs ${previous.toLocaleString()}${unit} last period`}
      />
    );
  };

  return (
    <div className="bg-canvas min-h-full">
      {configMissing && (
        <div className="bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800 px-8 py-2 text-sm text-amber-800 dark:text-amber-200">
          Configure Supabase to see real stats.
        </div>
      )}
      {/* Header */}
      <div className="bg-surface border-b border-line px-8 py-6 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-content">Dashboard</h1>
            <div className="flex items-center mt-2 text-sm text-content-secondary">
              <Calendar className="w-4 h-4 mr-2" />
              <span>{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
              <span className="mx-2">•</span>
              <span>Last updated: Just now</span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-content-muted" />
              <input 
                type="text" 
                placeholder="Search courses, learners..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg w-80 focus:ring-2 focus:ring-brand bg-raised text-content transition-all" 
              />
            </div>
          </div>
        </div>
      </div>

      <div className="p-8">
        {/* Stats Cards */}
        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 ${loading ? 'animate-pulse' : ''}`}>
          {renderStat(Users, 'Total Learners', stats.learners.current, stats.learners.previous, 'blue')}
          {renderStat(Video, 'Active Courses', stats.courses.current, stats.courses.previous, 'purple')}
          {renderStat(Award, 'Completion Rate', stats.completion.current, stats.completion.previous, 'green', '%')}
          {renderStat(Clock, 'Avg. Time Spent', stats.avgTime.current, stats.avgTime.previous, 'orange', 'h')}
        </div>

        {/* Dashboard grid: Learning Progress, Top Courses, Top Learners, Recent Activity */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Learning Progress */}
          <div className="app-card rounded-lg p-6 flex flex-col min-h-[28rem]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-content">Learning Progress</h3>
              <select 
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="px-4 py-2 border border-line rounded-lg text-sm focus:ring-2 focus:ring-brand bg-raised text-content"
              >
                <option value="7days">Last 7 days</option>
                <option value="30days">Last 30 days</option>
              </select>
            </div>

            {/* Chart */}
            <div className="h-64 flex items-end justify-around space-x-2 mb-4">
              {weeklyData.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-content-muted text-sm">No activity data yet.</div>
              ) : weeklyData.map((data, i) => (
                <div key={i} className="flex flex-col items-center flex-1 group">
                  <div className="relative w-full">
                    <div 
                      className="w-full bg-brand rounded-t-lg transition-all duration-300 hover:opacity-90 cursor-pointer" 
                      style={{height: `${Math.max(4, data.completions * 2.5)}px`}}
                    >
                      <div className="opacity-0 group-hover:opacity-100 absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap transition-opacity pointer-events-none">
                        <p className="font-semibold">{data.week}</p>
                        <p>{data.completions} completions</p>
                        <p>{data.enrollments} enrollments</p>
                        <p>{data.avgTime}h avg time</p>
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-content-secondary mt-2 font-medium">{data.week}</span>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center space-x-6 pt-4 border-t border-line">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-brand rounded-full mr-2"></div>
                <span className="text-sm text-content-secondary">Completion Rate</span>
              </div>
              <button type="button" onClick={exportDashboardCsv} className="text-sm text-accent hover:opacity-80 font-semibold flex items-center">
                <Download className="w-4 h-4 mr-1" />
                Export Data
              </button>
            </div>
          </div>

          {/* Top Performing Courses */}
          <div className="app-card rounded-lg p-6 flex flex-col min-h-[28rem]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-content">Top Performing Courses</h3>
              <button 
                onClick={() => setCurrentView('courses')}
                className="text-accent text-sm hover:opacity-80 font-semibold transition-all"
              >
                View All →
              </button>
            </div>
            <div className="space-y-4 flex-1 overflow-y-auto pr-1">
              {filteredTopCourses.length === 0 ? (
                <div className="py-6 text-center text-content-muted text-sm">No courses yet.</div>
              ) : filteredTopCourses.map((course) => (
                <div 
                  key={course.id}
                  onClick={() => setSelectedCourse(course.id === selectedCourse ? null : course.id)}
                  className={`p-4 rounded-xl hover:bg-overlay transition-all cursor-pointer border border-line ${selectedCourse === course.id ? 'surface-2 border-brand' : 'surface-1 border-transparent'}`}
                >
                  <div className="flex items-center gap-2 mb-2 min-w-0">
                    <p
                      className="font-semibold text-sm text-content shrink-0 max-w-[38%] truncate"
                      title={course.name}
                    >
                      {course.name}
                    </p>
                    <div className="flex-1 min-w-0 c-progress h-2">
                      <div
                        className="c-progress-fill h-2"
                        style={{ width: `${course.completion}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-content-secondary shrink-0 tabular-nums">
                      {course.completion}%
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2 text-xs text-content-secondary">
                      <span className="flex items-center">
                        <Users className="w-3 h-3 mr-1" />
                        {course.learners} learners
                      </span>
                      <span>•</span>
                      <span className="flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        {course.avgTime}
                      </span>
                    </div>
                    <div className={`c-badge ${course.trend === 'up' ? 'c-badge-ok' : 'c-badge-err'}`}>
                      {course.trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                      <span>{course.trendValue}%</span>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {selectedCourse === course.id && (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-content-secondary">Status:</span>
                        <span className={`c-badge ${course.status === 'published' ? 'c-badge-published' : 'c-badge-draft'}`}>{course.status}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-content-secondary">Last Updated:</span>
                        <span className="font-semibold text-content">{course.lastUpdated}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-content-secondary">Drop-off Point:</span>
                        <span className="font-semibold text-orange-600 dark:text-orange-400">{course.dropOffPoint}</span>
                      </div>
                      <button 
                        onClick={() => setCurrentView('courses')}
                        className="w-full mt-2 px-3 py-2 btn-brand rounded-lg text-xs font-semibold transition-all"
                      >
                        View Details
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Top Performers */}
          <div className="app-card rounded-lg p-6 flex flex-col min-h-[28rem]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-content">Top Performers</h3>
              <div className="flex items-center gap-3">
                <Trophy className="w-5 h-5 text-yellow-500" />
                <button
                  onClick={() => setCurrentView('learners')}
                  className="text-accent text-sm hover:opacity-80 font-semibold transition-all"
                >
                  View All →
                </button>
              </div>
            </div>
            <div className="space-y-4 flex-1 overflow-y-auto pr-1">
              {filteredTopLearners.length === 0 ? (
                <div className="py-6 text-center text-content-muted text-sm">No learners yet.</div>
              ) : filteredTopLearners.map((learner) => (
                <div
                  key={learner.id}
                  onClick={() => setSelectedLearner(learner.id === selectedLearner ? null : learner.id)}
                  className={`p-4 rounded-xl hover:bg-overlay transition-all cursor-pointer ${selectedLearner === learner.id ? 'bg-brand-subtle border-2 border-brand' : 'bg-raised/50 border-2 border-transparent'}`}
                >
                  <div className="flex items-center gap-2 mb-2 min-w-0">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                      learner.rank === 1 ? 'bg-yellow-400 text-white' :
                      learner.rank === 2 ? 'bg-raised text-content-secondary' :
                      learner.rank === 3 ? 'bg-orange-400 text-white' :
                      'bg-info-subtle text-info'
                    }`}>
                      {learner.rank}
                    </div>
                    <ThemeAvatar initials={learner.avatar} className="w-7 h-7 text-[10px] shrink-0" />
                    <p
                      className="font-semibold text-sm text-content shrink-0 max-w-[28%] truncate"
                      title={learner.name}
                    >
                      {learner.name}
                    </p>
                    <div className="flex-1 min-w-0 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                      <div
                        className="bg-emerald-500 dark:bg-emerald-400 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${learner.progress}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-content-secondary shrink-0 tabular-nums">
                      {learner.progress}%
                    </span>
                  </div>

                  <div className="flex justify-between items-center pl-[4.25rem]">
                    <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-xs text-content-secondary">
                      <span>{learner.enrolledCourses} enrolled</span>
                      <span>•</span>
                      <span>{learner.completedCourses} completed</span>
                      {learner.averageScore > 0 && (
                        <>
                          <span>•</span>
                          <span>{learner.averageScore}% avg score</span>
                        </>
                      )}
                      <span>•</span>
                      <span className="flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        {learner.totalTimeSpent}
                      </span>
                    </div>
                    <div className={`c-badge ${learner.trend === 'up' ? 'c-badge-ok' : 'c-badge-err'}`}>
                      {learner.trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                      <span>{learner.trendValue}%</span>
                    </div>
                  </div>

                  {selectedLearner === learner.id && (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 space-y-2 pl-[4.25rem]">
                      <div className="flex justify-between text-xs">
                        <span className="text-content-secondary">Courses completed:</span>
                        <span className="font-semibold text-content">{learner.completedCourses} / {learner.enrolledCourses}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-content-secondary">Average score:</span>
                        <span className="font-semibold text-content">{learner.averageScore > 0 ? `${learner.averageScore}%` : '—'}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-content-secondary">Time spent:</span>
                        <span className="font-semibold text-content">{learner.totalTimeSpent}</span>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setCurrentView('learners'); }}
                        className="w-full mt-2 px-3 py-2 btn-brand rounded-lg text-xs font-semibold transition-all"
                      >
                        View Learner
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="app-card rounded-lg p-6 flex flex-col min-h-[28rem]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-content">Recent Activity</h3>
                <p className="text-sm text-content-secondary mt-1">Latest learner updates</p>
              </div>
              {(filteredRecentActivity.length > ACTIVITY_PREVIEW_COUNT || showAllActivity) && (
                <button
                  type="button"
                  onClick={handleToggleAllActivity}
                  disabled={activityLoading}
                  className="text-accent text-sm hover:opacity-80 font-semibold transition-all disabled:opacity-60 shrink-0"
                >
                  {activityLoading ? 'Loading…' : showAllActivity ? 'Show less' : 'View All →'}
                </button>
              )}
            </div>
            <div className={`space-y-1 flex-1 overflow-y-auto pr-1 ${showAllActivity ? '' : ''}`}>
              {filteredRecentActivity.length === 0 ? (
                <div className="py-8 text-center text-content-muted text-sm">No recent activity yet.</div>
              ) : visibleRecentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between py-3 px-3 hover:bg-overlay rounded-xl transition-all cursor-pointer group"
                >
                  <div className="flex items-center flex-1 min-w-0">
                    <ThemeAvatar initials={activity.avatar} className="w-10 h-10 text-xs shrink-0" />
                    <div className="ml-3 flex-1 min-w-0">
                      <p className="text-sm text-content truncate">
                        <span className="font-semibold">{activity.user}</span>
                        <span className="text-content-secondary"> {activity.action} </span>
                        <span className="font-semibold">{activity.course}</span>
                      </p>
                      <div className="flex items-center space-x-3 mt-0.5">
                        <p className="text-xs text-content-muted truncate">{activity.time}</p>
                        {activity.score && (
                          <span className={`c-badge ${
                            activity.score >= 80 ? 'c-badge-ok' :
                            activity.score >= 50 ? 'c-badge-warn' :
                            'c-badge-err'
                          }`}>
                            Score: {activity.score}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 shrink-0 ml-2">
                    {getActivityIcon(activity.type)}
                    <ChevronRight className="w-4 h-4 text-content-muted group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
