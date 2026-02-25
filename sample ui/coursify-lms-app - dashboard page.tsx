import React, { useState } from 'react';
import { 
  Play, Users, BarChart3, Settings, Plus, Clock, Video, 
  ChevronRight, Menu, Search, Bell, Award, TrendingUp, 
  Home, FileText, X, Calendar, Filter, Download, 
  ArrowUp, ArrowDown, Minus, CheckCircle, AlertCircle, XCircle
} from 'lucide-react';

const CoursifyDashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('7days');
  const [selectedCourse, setSelectedCourse] = useState<number | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: 1, type: 'success', title: 'Course Published', message: 'Product Onboarding 2024 is now live', time: '5 min ago', read: false },
    { id: 2, type: 'warning', title: 'Low Completion Rate', message: 'Security Training dropped to 65%', time: '1 hour ago', read: false },
    { id: 3, type: 'info', title: 'New Learner Enrolled', message: '5 new learners joined today', time: '2 hours ago', read: true }
  ]);

  // Mock data
  const stats = {
    learners: { current: 1247, previous: 1112, change: 12.1 },
    courses: { current: 24, previous: 22, change: 9.1 },
    completion: { current: 78, previous: 63.5, change: 22.8 },
    avgTime: { current: 4.2, previous: 3.8, change: 10.5 }
  };

  const weeklyData = [
    { week: 'W1', completions: 65, enrollments: 45, avgTime: 3.2 },
    { week: 'W2', completions: 72, enrollments: 52, avgTime: 3.5 },
    { week: 'W3', completions: 68, enrollments: 48, avgTime: 3.8 },
    { week: 'W4', completions: 80, enrollments: 65, avgTime: 4.1 },
    { week: 'W5', completions: 75, enrollments: 58, avgTime: 4.0 },
    { week: 'W6', completions: 78, enrollments: 62, avgTime: 4.2 },
    { week: 'W7', completions: 85, enrollments: 70, avgTime: 4.5 }
  ];

  const topCourses = [
    { 
      id: 1,
      name: 'Product Onboarding 2024', 
      completion: 92, 
      learners: 156,
      trend: 'up',
      trendValue: 8,
      avgTime: '25 min',
      lastUpdated: '2 days ago',
      status: 'active',
      dropOffPoint: 'Module 3'
    },
    { 
      id: 2,
      name: 'Security & Compliance Training', 
      completion: 87, 
      learners: 143,
      trend: 'up',
      trendValue: 5,
      avgTime: '32 min',
      lastUpdated: '1 week ago',
      status: 'active',
      dropOffPoint: 'Module 2'
    },
    { 
      id: 3,
      name: 'Sales Methodology Basics', 
      completion: 84, 
      learners: 128,
      trend: 'down',
      trendValue: 3,
      avgTime: '28 min',
      lastUpdated: '3 days ago',
      status: 'active',
      dropOffPoint: 'Module 4'
    },
    { 
      id: 4,
      name: 'Customer Success Fundamentals', 
      completion: 81, 
      learners: 112,
      trend: 'up',
      trendValue: 12,
      avgTime: '30 min',
      lastUpdated: '5 days ago',
      status: 'active',
      dropOffPoint: 'Module 1'
    }
  ];

  const recentActivity = [
    { 
      id: 1,
      user: 'Sarah Johnson', 
      action: 'completed', 
      course: 'Product Onboarding 2024', 
      time: '2 hours ago', 
      avatar: 'SJ',
      score: 95,
      type: 'completion'
    },
    { 
      id: 2,
      user: 'Mike Chen', 
      action: 'started', 
      course: 'Security & Compliance Training', 
      time: '4 hours ago', 
      avatar: 'MC',
      type: 'enrollment'
    },
    { 
      id: 3,
      user: 'Emma Davis', 
      action: 'updated video segment in', 
      course: 'Sales Methodology Basics', 
      time: '5 hours ago', 
      avatar: 'ED',
      type: 'update'
    },
    { 
      id: 4,
      user: 'Alex Turner', 
      action: 'completed', 
      course: 'Customer Success Fundamentals', 
      time: '6 hours ago', 
      avatar: 'AT',
      score: 88,
      type: 'completion'
    },
    { 
      id: 5,
      user: 'Lisa Wong', 
      action: 'failed quiz in', 
      course: 'Security & Compliance Training', 
      time: '8 hours ago', 
      avatar: 'LW',
      score: 45,
      type: 'failure'
    },
    { 
      id: 6,
      user: 'James Miller', 
      action: 'completed', 
      course: 'Product Onboarding 2024', 
      time: '10 hours ago', 
      avatar: 'JM',
      score: 92,
      type: 'completion'
    }
  ];

  const calculateChange = (current: number, previous: number) => {
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
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    current: number;
    previous: number;
    unit?: string;
    color: string;
  }) => {
    const change = calculateChange(current, previous);
    const isPositive = parseFloat(change) > 0;
    
    return (
      <div className={`bg-gradient-to-br from-${color}-500 to-${color}-600 text-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all cursor-pointer`}>
        <div className="flex items-center justify-between mb-4">
          <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center backdrop-blur-sm">
            <Icon className="w-6 h-6" />
          </div>
          <div className={`flex items-center space-x-1 text-sm font-semibold bg-white bg-opacity-20 px-3 py-1 rounded-full`}>
            {isPositive ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
            <span>{change}%</span>
          </div>
        </div>
        <p className="text-sm opacity-90 mb-1">{title}</p>
        <div className="flex items-baseline">
          <p className="text-4xl font-bold">{current.toLocaleString()}</p>
          {unit && <span className="text-xl ml-1 opacity-90">{unit}</span>}
        </div>
        <p className="text-xs opacity-75 mt-2">vs {previous.toLocaleString()}{unit} last period</p>
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
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)} 
            className="p-2 hover:bg-blue-500 rounded-lg transition-all"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
        
        <nav className="p-4 space-y-2">
          <div className="w-full flex items-center p-3 rounded-lg bg-white text-blue-600 shadow-lg">
            <Home className="w-5 h-5" />
            {sidebarOpen && <span className="ml-3 font-semibold">Dashboard</span>}
          </div>
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
          <button className="w-full flex items-center p-3 rounded-lg hover:bg-blue-500 transition-all">
            <FileText className="w-5 h-5" />
            {sidebarOpen && <span className="ml-3 font-semibold">Reports</span>}
          </button>
          <button className="w-full flex items-center p-3 rounded-lg hover:bg-blue-500 transition-all">
            <Settings className="w-5 h-5" />
            {sidebarOpen && <span className="ml-3 font-semibold">Settings</span>}
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
        <div className="bg-white border-b border-gray-200 px-8 py-6 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              <div className="flex items-center mt-2 text-sm text-gray-600">
                <Calendar className="w-4 h-4 mr-2" />
                <span>Tuesday, January 6, 2026</span>
                <span className="mx-2">•</span>
                <span>Last updated: Just now</span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Search courses, learners..." 
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-80 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" 
                />
              </div>
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-all">
                <Filter className="w-6 h-6 text-gray-600" />
              </button>
              <div className="relative">
                <button 
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="p-2 hover:bg-gray-100 rounded-lg relative transition-all"
                >
                  <Bell className="w-6 h-6 text-gray-600" />
                  {notifications.filter(n => !n.read).length > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                  )}
                </button>

                {/* Notifications Dropdown */}
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50">
                    <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                      <h3 className="font-bold text-lg">Notifications</h3>
                      <button 
                        onClick={clearAllNotifications}
                        className="text-sm text-blue-600 hover:text-blue-700 font-semibold"
                      >
                        Mark all read
                      </button>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.map(notif => (
                        <div 
                          key={notif.id}
                          onClick={() => markNotificationRead(notif.id)}
                          className={`p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-all ${!notif.read ? 'bg-blue-50' : ''}`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-1">
                                {notif.type === 'success' && <CheckCircle className="w-4 h-4 text-green-600" />}
                                {notif.type === 'warning' && <AlertCircle className="w-4 h-4 text-orange-600" />}
                                {notif.type === 'info' && <Bell className="w-4 h-4 text-blue-600" />}
                                <p className="font-semibold text-sm">{notif.title}</p>
                              </div>
                              <p className="text-sm text-gray-600">{notif.message}</p>
                              <p className="text-xs text-gray-500 mt-1">{notif.time}</p>
                            </div>
                            {!notif.read && (
                              <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
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
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">Learning Progress</h3>
                <select 
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="7days">Last 7 days</option>
                  <option value="30days">Last 30 days</option>
                  <option value="90days">Last 90 days</option>
                </select>
              </div>

              {/* Chart */}
              <div className="h-64 flex items-end justify-around space-x-2 mb-4">
                {weeklyData.map((data, i) => (
                  <div key={i} className="flex flex-col items-center flex-1 group">
                    <div className="relative w-full">
                      <div 
                        className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-lg transition-all duration-300 hover:from-blue-600 hover:to-blue-500 cursor-pointer" 
                        style={{height: `${data.completions * 2.5}px`}}
                      >
                        {/* Tooltip on hover */}
                        <div className="opacity-0 group-hover:opacity-100 absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap transition-opacity pointer-events-none">
                          <p className="font-semibold">{data.week}</p>
                          <p>{data.completions}% completion</p>
                          <p>{data.enrollments} enrollments</p>
                          <p>{data.avgTime}h avg time</p>
                        </div>
                      </div>
                    </div>
                    <span className="text-xs text-gray-600 mt-2 font-medium">{data.week}</span>
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center space-x-6 pt-4 border-t border-gray-200">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                  <span className="text-sm text-gray-600">Completion Rate</span>
                </div>
                <button className="text-sm text-blue-600 hover:text-blue-700 font-semibold flex items-center">
                  <Download className="w-4 h-4 mr-1" />
                  Export Data
                </button>
              </div>
            </div>

            {/* Top Performing Courses */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">Top Performing Courses</h3>
                <button className="text-blue-600 text-sm hover:text-blue-700 font-semibold transition-all">
                  View All →
                </button>
              </div>
              <div className="space-y-4">
                {topCourses.map((course) => (
                  <div 
                    key={course.id}
                    onClick={() => setSelectedCourse(course.id === selectedCourse ? null : course.id)}
                    className={`p-4 rounded-xl hover:bg-gray-50 transition-all cursor-pointer ${selectedCourse === course.id ? 'bg-blue-50 border-2 border-blue-500' : 'bg-gray-50 border-2 border-transparent'}`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <p className="font-semibold text-sm mb-1">{course.name}</p>
                        <div className="flex items-center space-x-2 text-xs text-gray-600">
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
                        course.trend === 'up' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {course.trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                        <span>{course.trendValue}%</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center mb-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2 mr-3">
                        <div 
                          className="bg-blue-500 h-2 rounded-full transition-all duration-500" 
                          style={{width: `${course.completion}%`}}
                        ></div>
                      </div>
                      <span className="text-sm font-semibold text-gray-700">{course.completion}%</span>
                    </div>

                    {/* Expanded Details */}
                    {selectedCourse === course.id && (
                      <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-600">Status:</span>
                          <span className="font-semibold text-green-600 capitalize">{course.status}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-600">Last Updated:</span>
                          <span className="font-semibold">{course.lastUpdated}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-600">Drop-off Point:</span>
                          <span className="font-semibold text-orange-600">{course.dropOffPoint}</span>
                        </div>
                        <button className="w-full mt-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-semibold transition-all">
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
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold">Recent Activity</h3>
                <p className="text-sm text-gray-600 mt-1">Real-time updates from your platform</p>
              </div>
              <button className="text-blue-600 text-sm hover:text-blue-700 font-semibold transition-all">
                View All Activity →
              </button>
            </div>
            <div className="space-y-1">
              {recentActivity.map((activity) => (
                <div 
                  key={activity.id}
                  className="flex items-center justify-between py-4 px-4 hover:bg-gray-50 rounded-xl transition-all cursor-pointer group"
                >
                  <div className="flex items-center flex-1">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md">
                      {activity.avatar}
                    </div>
                    <div className="ml-4 flex-1">
                      <p className="text-sm">
                        <span className="font-semibold">{activity.user}</span>
                        <span className="text-gray-600"> {activity.action} </span>
                        <span className="font-semibold">{activity.course}</span>
                      </p>
                      <div className="flex items-center space-x-3 mt-1">
                        <p className="text-xs text-gray-500">{activity.time}</p>
                        {activity.score && (
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            activity.score >= 80 ? 'bg-green-100 text-green-700' :
                            activity.score >= 50 ? 'bg-orange-100 text-orange-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            Score: {activity.score}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    {getActivityIcon(activity.type)}
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:translate-x-1 transition-transform" />
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

export default CoursifyDashboard;