'use client'

import React, { useState, useEffect } from 'react';
import { 
  Play, Users, BarChart3, Settings, Plus, Clock, Video, 
  ChevronRight, Menu, Search, Bell, Award, TrendingUp, 
  Home, FileText, X, Calendar, Filter, Download, 
  ArrowUp, ArrowDown, Minus, CheckCircle, AlertCircle, XCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface DashboardProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  setCurrentView: (view: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ sidebarOpen, setSidebarOpen, setCurrentView }) => {
  const [selectedPeriod, setSelectedPeriod] = useState('7days');
  const [selectedCourse, setSelectedCourse] = useState<number | string | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<{ id: number; type: string; title: string; message: string; time: string; read: boolean }[]>([]);

  const [stats, setStats] = useState({
    learners: { current: 0, previous: 0, change: 0 },
    courses: { current: 0, previous: 0, change: 0 },
    completion: { current: 0, previous: 0, change: 0 },
    avgTime: { current: 0, previous: 0, change: 0 }
  });
  const [configMissing, setConfigMissing] = useState(false);
  const [topCourses, setTopCourses] = useState<{ id: number | string; name: string; completion: number; learners: number; trend: string; trendValue: number; avgTime: string; lastUpdated: string; status: string; dropOffPoint: string }[]>([]);
  const [weeklyData, setWeeklyData] = useState<{ week: string; completions: number; enrollments: number; avgTime: number }[]>([]);
  const [recentActivity, setRecentActivity] = useState<{ id: number; user: string; action: string; course: string; time: string; avatar: string; score?: number; type: string }[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
        setConfigMissing(true);
        return;
      }
      setConfigMissing(false);
      try {
        const res = await fetch('/api/instructor/dashboard', { credentials: 'include', cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setConfigMissing(true);
          return;
        }
        if (data.stats) setStats(data.stats);
        if (Array.isArray(data.topCourses)) setTopCourses(data.topCourses);
        if (Array.isArray(data.weeklyData)) setWeeklyData(data.weeklyData);
        if (Array.isArray(data.recentActivity)) setRecentActivity(data.recentActivity);
      } catch {
        setConfigMissing(true);
      }
    };
    load();
  }, []);

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return '0';
    return ((current - previous) / previous * 100).toFixed(1);
  };

  const getActivityIcon = (type: string) => {
    switch(type) {
      case 'completion': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'enrollment': return <Play className="w-5 h-5 text-blue-600" />;
      case 'update': return <AlertCircle className="w-5 h-5 text-orange-600" />;
      case 'failure': return <XCircle className="w-5 h-5 text-red-600" />;
      default: return <AlertCircle className="w-5 h-5 text-gray-600" />;
    }
  };

  const markNotificationRead = (id: number) => {
    setNotifications(notifications.map(n => 
      n.id === id ? { ...n, read: true } : n
    ));
  };

  const clearAllNotifications = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  const StatCard = ({ icon: Icon, title, current, previous, unit = '', color }: {
    icon: React.ElementType;
    title: string;
    current: number;
    previous: number;
    unit?: string;
    color: 'blue' | 'purple' | 'green' | 'orange';
  }) => {
    const change = parseFloat(calculateChange(current, previous));
    const isPositive = change > 0;
    const colorClasses = {
      blue: 'from-blue-500 to-blue-600',
      purple: 'from-purple-500 to-purple-600',
      green: 'from-green-500 to-green-600',
      orange: 'from-orange-500 to-orange-600'
    };
    const darkBorderClasses = {
      blue: 'dark:border-l-blue-500',
      purple: 'dark:border-l-purple-500',
      green: 'dark:border-l-emerald-500',
      orange: 'dark:border-l-amber-500'
    };
    const darkIconClasses = {
      blue: 'dark:text-blue-400',
      purple: 'dark:text-purple-400',
      green: 'dark:text-emerald-400',
      orange: 'dark:text-amber-400'
    };
    return (
      <div className={`bg-gradient-to-br ${colorClasses[color]} text-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all cursor-pointer dark:bg-gray-800 dark:border-l-4 ${darkBorderClasses[color]} dark:border-gray-700 dark:shadow-none`}>
        <div className="flex items-center justify-between mb-4">
          <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center backdrop-blur-sm dark:bg-gray-700/50">
            <Icon className={`w-6 h-6 ${darkIconClasses[color]}`} />
          </div>
          <div className="flex items-center space-x-1 text-sm font-semibold bg-white bg-opacity-20 px-3 py-1 rounded-full dark:bg-gray-700/50 dark:text-gray-300">
            {isPositive ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
            <span>{Math.abs(change).toFixed(1)}%</span>
          </div>
        </div>
        <p className="text-sm opacity-90 mb-1 dark:text-gray-300">{title}</p>
        <div className="flex items-baseline">
          <p className="text-4xl font-bold dark:text-white">{current.toLocaleString()}</p>
          {unit && <span className="text-xl ml-1 opacity-90 dark:text-gray-300">{unit}</span>}
        </div>
        <p className="text-xs opacity-75 mt-2 dark:text-gray-300">vs {previous.toLocaleString()}{unit} last period</p>
      </div>
    );
  };

  return (
    <div className="dark:bg-gray-900 min-h-full">
      {configMissing && (
        <div className="bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800 px-8 py-2 text-sm text-amber-800 dark:text-amber-200">
          Configure Supabase to see real stats.
        </div>
      )}
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 dark:border-gray-800 border-b border-gray-200 dark:border-gray-800 px-8 py-6 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
            <div className="flex items-center mt-2 text-sm text-gray-600 dark:text-gray-400">
              <Calendar className="w-4 h-4 mr-2" />
              <span>{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
              <span className="mx-2">•</span>
              <span>Last updated: Just now</span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" />
              <input 
                type="text" 
                placeholder="Search courses, learners..." 
                className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg w-80 focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white transition-all" 
              />
            </div>
            <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all dark:text-gray-300">
              <Filter className="w-6 h-6 text-gray-600 dark:text-gray-400" />
            </button>
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg relative transition-all dark:text-gray-300"
              >
                <Bell className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                {notifications.filter(n => !n.read).length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50">
                  <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">Notifications</h3>
                    <button 
                      onClick={clearAllNotifications}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold"
                    >
                      Mark all read
                    </button>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-gray-500 dark:text-gray-400 text-sm">No notifications yet.</div>
                    ) : notifications.map(notif => (
                      <div 
                        key={notif.id}
                        onClick={() => markNotificationRead(notif.id)}
                        className={`p-4 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-all ${!notif.read ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              {notif.type === 'success' && <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />}
                              {notif.type === 'warning' && <AlertCircle className="w-4 h-4 text-orange-600 dark:text-orange-400" />}
                              {notif.type === 'info' && <Bell className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                              <p className="font-semibold text-sm text-gray-900 dark:text-white">{notif.title}</p>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{notif.message}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{notif.time}</p>
                          </div>
                          {!notif.read && (
                            <div className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full"></div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="p-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard 
            icon={Users} 
            title="Total Learners" 
            current={stats.learners.current} 
            previous={stats.learners.previous}
            color="blue" 
          />
          <StatCard 
            icon={Video} 
            title="Active Courses" 
            current={stats.courses.current} 
            previous={stats.courses.previous}
            color="purple" 
          />
          <StatCard 
            icon={Award} 
            title="Completion Rate" 
            current={stats.completion.current} 
            previous={stats.completion.previous}
            unit="%"
            color="green" 
          />
          <StatCard 
            icon={Clock} 
            title="Avg. Time Spent" 
            current={stats.avgTime.current} 
            previous={stats.avgTime.previous}
            unit="h"
            color="orange" 
          />
        </div>

        {/* Charts Section */}
        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          {/* Weekly Progress Chart */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Learning Progress</h3>
              <select 
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="7days">Last 7 days</option>
                <option value="30days">Last 30 days</option>
                <option value="90days">Last 90 days</option>
              </select>
            </div>

            {/* Chart */}
            <div className="h-64 flex items-end justify-around space-x-2 mb-4">
              {weeklyData.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm">No activity data yet.</div>
              ) : weeklyData.map((data, i) => (
                <div key={i} className="flex flex-col items-center flex-1 group">
                  <div className="relative w-full">
                    <div 
                      className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-lg transition-all duration-300 hover:from-blue-600 hover:to-blue-500 cursor-pointer" 
                      style={{height: `${Math.max(4, data.completions * 2.5)}px`}}
                    >
                      <div className="opacity-0 group-hover:opacity-100 absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap transition-opacity pointer-events-none">
                        <p className="font-semibold">{data.week}</p>
                        <p>{data.completions}% completion</p>
                        <p>{data.enrollments} enrollments</p>
                        <p>{data.avgTime}h avg time</p>
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-gray-600 dark:text-gray-400 mt-2 font-medium">{data.week}</span>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center space-x-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Completion Rate</span>
              </div>
              <button className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold flex items-center">
                <Download className="w-4 h-4 mr-1" />
                Export Data
              </button>
            </div>
          </div>

          {/* Top Performing Courses */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Top Performing Courses</h3>
              <button 
                onClick={() => setCurrentView('courses')}
                className="text-blue-600 dark:text-blue-400 text-sm hover:text-blue-700 dark:hover:text-blue-300 font-semibold transition-all"
              >
                View All →
              </button>
            </div>
            <div className="space-y-4">
              {topCourses.length === 0 ? (
                <div className="py-6 text-center text-gray-500 dark:text-gray-400 text-sm">No courses yet.</div>
              ) : topCourses.map((course) => (
                <div 
                  key={course.id}
                  onClick={() => setSelectedCourse(course.id === selectedCourse ? null : course.id)}
                  className={`p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all cursor-pointer ${selectedCourse === course.id ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500 dark:border-blue-400' : 'bg-gray-50 dark:bg-gray-700/50 border-2 border-transparent'}`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <p className="font-semibold text-sm mb-1 text-gray-900 dark:text-white">{course.name}</p>
                      <div className="flex items-center space-x-2 text-xs text-gray-600 dark:text-gray-400">
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
                    </div>
                    <div className={`flex items-center space-x-1 text-xs font-semibold px-2 py-1 rounded-full ${
                      course.trend === 'up' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                    }`}>
                      {course.trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                      <span>{course.trendValue}%</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center mb-2">
                    <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-2 mr-3">
                      <div 
                        className="bg-blue-500 dark:bg-blue-400 h-2 rounded-full transition-all duration-500" 
                        style={{width: `${course.completion}%`}}
                      ></div>
                    </div>
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{course.completion}%</span>
                  </div>

                  {/* Expanded Details */}
                  {selectedCourse === course.id && (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-600 dark:text-gray-400">Status:</span>
                        <span className="font-semibold text-green-600 dark:text-green-400 capitalize">{course.status}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-600 dark:text-gray-400">Last Updated:</span>
                        <span className="font-semibold text-gray-900 dark:text-white">{course.lastUpdated}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-600 dark:text-gray-400">Drop-off Point:</span>
                        <span className="font-semibold text-orange-600 dark:text-orange-400">{course.dropOffPoint}</span>
                      </div>
                      <button 
                        onClick={() => setCurrentView('courses')}
                        className="w-full mt-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-semibold transition-all"
                      >
                        View Details
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Recent Activity</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Real-time updates from your platform</p>
            </div>
            <button className="text-blue-600 dark:text-blue-400 text-sm hover:text-blue-700 dark:hover:text-blue-300 font-semibold transition-all">
              View All Activity →
            </button>
          </div>
          <div className="space-y-1">
            {recentActivity.length === 0 ? (
              <div className="py-8 text-center text-gray-500 dark:text-gray-400 text-sm">No recent activity yet.</div>
            ) : recentActivity.map((activity) => (
              <div 
                key={activity.id}
                className="flex items-center justify-between py-4 px-4 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-all cursor-pointer group"
              >
                <div className="flex items-center flex-1">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md">
                    {activity.avatar}
                  </div>
                  <div className="ml-4 flex-1">
                    <p className="text-sm text-gray-900 dark:text-gray-100">
                      <span className="font-semibold">{activity.user}</span>
                      <span className="text-gray-600 dark:text-gray-400"> {activity.action} </span>
                      <span className="font-semibold">{activity.course}</span>
                    </p>
                    <div className="flex items-center space-x-3 mt-1">
                      <p className="text-xs text-gray-500 dark:text-gray-500">{activity.time}</p>
                      {activity.score && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          activity.score >= 80 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                          activity.score >= 50 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' :
                          'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                        }`}>
                          Score: {activity.score}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  {getActivityIcon(activity.type)}
                  <ChevronRight className="w-5 h-5 text-gray-400 dark:text-gray-500 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
