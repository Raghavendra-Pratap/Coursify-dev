import React, { useState } from 'react';
import { 
  Play, Users, BarChart3, Settings, Plus, Clock, Video, 
  ChevronRight, Menu, Search, Bell, Award, Home, FileText,
  Edit, X, Eye, Filter, Mail, Download, Upload, MoreVertical,
  CheckCircle, AlertCircle, TrendingUp, TrendingDown, Target,
  Calendar, BookOpen, Star, Send, UserPlus, UserMinus, UserCheck,
  Activity, Percent, Trophy, MessageSquare, FileDown, ChevronDown,
  ChevronUp, ArrowUpRight, ArrowDownRight, Zap, RefreshCw
} from 'lucide-react';

type LearnerDetail = {
  id: number;
  name: string;
  email: string;
  avatar: string;
  avatarColor: string;
  status: string;
  enrolledCourses: number;
  completedCourses: number;
  inProgressCourses: number;
  totalProgress: number;
  averageScore: number;
  totalTimeSpent: string;
  joinedDate: string;
  certificates: number;
  department: string;
  role: string;
  manager: string;
  courses: Array<{ id: number; name: string; status?: string; completedDate?: string; lastAccessed?: string; score?: number; progress?: number }>;
  activityLog: Array<{ type: string; course?: string; time: string; score?: number }>;
};

const CoursifyLearners = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedTab, setSelectedTab] = useState('all'); // 'all', 'active', 'inactive', 'at-risk'
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('recent'); // 'recent', 'name', 'progress', 'courses'
  const [selectedLearners, setSelectedLearners] = useState<number[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showLearnerDetail, setShowLearnerDetail] = useState<LearnerDetail | null>(null);
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
  const [filterCourse, setFilterCourse] = useState('all');
  const [inviteEmails, setInviteEmails] = useState('');
  const [bulkUploadFile, setBulkUploadFile] = useState<File | null>(null);

  // Learners data
  const [learners, setLearners] = useState([
    {
      id: 1,
      name: 'Sarah Johnson',
      email: 'sarah.johnson@company.com',
      avatar: 'SJ',
      avatarColor: 'from-pink-400 to-pink-500',
      status: 'active',
      enrolledCourses: 8,
      completedCourses: 6,
      inProgressCourses: 2,
      totalProgress: 92,
      averageScore: 95,
      totalTimeSpent: '42h 30m',
      lastActive: '2 hours ago',
      joinedDate: 'Nov 15, 2024',
      streak: 12,
      badges: 5,
      certificates: 4,
      department: 'Sales',
      role: 'Senior Sales Rep',
      manager: 'John Smith',
      courses: [
        { id: 1, name: 'Product Onboarding 2024', progress: 100, score: 95, status: 'completed', completedDate: 'Jan 2, 2025' },
        { id: 2, name: 'Security & Compliance', progress: 100, score: 92, status: 'completed', completedDate: 'Dec 28, 2024' },
        { id: 3, name: 'Sales Methodology', progress: 85, score: 88, status: 'in-progress', lastAccessed: '1 hour ago' }
      ],
      activityLog: [
        { type: 'completed', course: 'Product Onboarding', time: '2 hours ago' },
        { type: 'started', course: 'Advanced Topics', time: '1 day ago' }
      ]
    },
    {
      id: 2,
      name: 'Mike Chen',
      email: 'mike.chen@company.com',
      avatar: 'MC',
      avatarColor: 'from-blue-400 to-blue-500',
      status: 'active',
      enrolledCourses: 6,
      completedCourses: 4,
      inProgressCourses: 2,
      totalProgress: 78,
      averageScore: 88,
      totalTimeSpent: '35h 15m',
      lastActive: '4 hours ago',
      joinedDate: 'Oct 20, 2024',
      streak: 8,
      badges: 3,
      certificates: 3,
      department: 'Engineering',
      role: 'Software Engineer',
      manager: 'Jane Doe',
      courses: [
        { id: 1, name: 'Product Onboarding 2024', progress: 100, score: 90, status: 'completed', completedDate: 'Dec 15, 2024' },
        { id: 2, name: 'Security & Compliance', progress: 65, score: 85, status: 'in-progress', lastAccessed: '4 hours ago' }
      ],
      activityLog: [
        { type: 'quiz-passed', course: 'Security Training', score: 85, time: '4 hours ago' }
      ]
    },
    {
      id: 3,
      name: 'Emma Davis',
      email: 'emma.davis@company.com',
      avatar: 'ED',
      avatarColor: 'from-green-400 to-green-500',
      status: 'at-risk',
      enrolledCourses: 10,
      completedCourses: 3,
      inProgressCourses: 7,
      totalProgress: 45,
      averageScore: 72,
      totalTimeSpent: '28h 45m',
      lastActive: '3 days ago',
      joinedDate: 'Sep 10, 2024',
      streak: 0,
      badges: 2,
      certificates: 1,
      department: 'Marketing',
      role: 'Marketing Manager',
      manager: 'Tom Wilson',
      courses: [
        { id: 1, name: 'Product Onboarding 2024', progress: 60, score: 70, status: 'in-progress', lastAccessed: '3 days ago' },
        { id: 3, name: 'Sales Methodology', progress: 30, score: 65, status: 'in-progress', lastAccessed: '1 week ago' }
      ],
      activityLog: [
        { type: 'missed-deadline', course: 'Security Training', time: '2 days ago' }
      ]
    },
    {
      id: 4,
      name: 'Alex Turner',
      email: 'alex.turner@company.com',
      avatar: 'AT',
      avatarColor: 'from-purple-400 to-purple-500',
      status: 'active',
      enrolledCourses: 7,
      completedCourses: 5,
      inProgressCourses: 2,
      totalProgress: 85,
      averageScore: 91,
      totalTimeSpent: '38h 20m',
      lastActive: '1 day ago',
      joinedDate: 'Aug 5, 2024',
      streak: 15,
      badges: 6,
      certificates: 5,
      department: 'Customer Success',
      role: 'CS Manager',
      manager: 'Lisa Brown',
      courses: [
        { id: 4, name: 'Customer Success', progress: 100, score: 94, status: 'completed', completedDate: 'Dec 30, 2024' },
        { id: 1, name: 'Product Onboarding', progress: 70, score: 88, status: 'in-progress', lastAccessed: '1 day ago' }
      ],
      activityLog: [
        { type: 'completed', course: 'Customer Success', time: '1 day ago' }
      ]
    },
    {
      id: 5,
      name: 'Lisa Wong',
      email: 'lisa.wong@company.com',
      avatar: 'LW',
      avatarColor: 'from-orange-400 to-orange-500',
      status: 'inactive',
      enrolledCourses: 5,
      completedCourses: 1,
      inProgressCourses: 4,
      totalProgress: 25,
      averageScore: 68,
      totalTimeSpent: '12h 10m',
      lastActive: '2 weeks ago',
      joinedDate: 'Dec 1, 2024',
      streak: 0,
      badges: 1,
      certificates: 0,
      department: 'Operations',
      role: 'Operations Analyst',
      manager: 'David Lee',
      courses: [
        { id: 2, name: 'Security & Compliance', progress: 40, score: 65, status: 'in-progress', lastAccessed: '2 weeks ago' }
      ],
      activityLog: [
        { type: 'inactive', time: '2 weeks ago' }
      ]
    }
  ]);

  // Stats
  const stats = {
    total: learners.length,
    active: learners.filter(l => l.status === 'active').length,
    atRisk: learners.filter(l => l.status === 'at-risk').length,
    inactive: learners.filter(l => l.status === 'inactive').length,
    avgCompletion: Math.round(learners.reduce((acc, l) => acc + l.totalProgress, 0) / learners.length),
    avgScore: Math.round(learners.reduce((acc, l) => acc + l.averageScore, 0) / learners.length),
    totalCertificates: learners.reduce((acc, l) => acc + l.certificates, 0),
    totalTimeSpent: '156h 20m'
  };

  // Filter learners
  const getFilteredLearners = () => {
    let filtered = learners;

    if (selectedTab !== 'all') {
      filtered = filtered.filter(l => l.status === selectedTab);
    }

    if (searchQuery) {
      filtered = filtered.filter(l => 
        l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.department.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    switch(sortBy) {
      case 'name':
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'progress':
        filtered.sort((a, b) => b.totalProgress - a.totalProgress);
        break;
      case 'courses':
        filtered.sort((a, b) => b.enrolledCourses - a.enrolledCourses);
        break;
      default:
        break;
    }

    return filtered;
  };

  const filteredLearners = getFilteredLearners();

  const handleInviteLearners = () => {
    // Process invite
    setShowInviteModal(false);
    setInviteEmails('');
    setBulkUploadFile(null);
  };

  const handleRemoveLearner = (learnerId: number) => {
    setLearners(learners.filter(l => l.id !== learnerId));
  };

  const handleSendReminder = (learnerId: number) => {
    console.log('Sending reminder to learner:', learnerId);
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'at-risk': return 'bg-orange-100 text-orange-700';
      case 'inactive': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'active': return <CheckCircle className="w-4 h-4" />;
      case 'at-risk': return <AlertCircle className="w-4 h-4" />;
      case 'inactive': return <X className="w-4 h-4" />;
      default: return null;
    }
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
          <div className="w-full flex items-center p-3 rounded-lg bg-white text-blue-600 shadow-lg">
            <Users className="w-5 h-5" />
            {sidebarOpen && <span className="ml-3 font-semibold">Learners</span>}
          </div>
          <button className="w-full flex items-center p-3 rounded-lg hover:bg-blue-500 transition-all">
            <BarChart3 className="w-5 h-5" />
            {sidebarOpen && <span className="ml-3 font-semibold">Analytics</span>}
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
              <h1 className="text-3xl font-bold text-gray-900">Learners</h1>
              <p className="text-gray-600 mt-1">Manage and track your students' progress</p>
            </div>
            <div className="flex space-x-3">
              <button className="px-6 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 font-semibold flex items-center transition-all">
                <Download className="w-5 h-5 mr-2" />
                Export Data
              </button>
              <button 
                onClick={() => setShowInviteModal(true)}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold flex items-center shadow-lg transition-all"
              >
                <UserPlus className="w-5 h-5 mr-2" />
                Invite Learners
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-blue-600 font-semibold">Total Learners</p>
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <p className="text-3xl font-bold text-blue-700">{stats.total}</p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl border border-green-200">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-green-600 font-semibold">Active</p>
                <Activity className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-3xl font-bold text-green-700">{stats.active}</p>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-xl border border-orange-200">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-orange-600 font-semibold">At Risk</p>
                <AlertCircle className="w-5 h-5 text-orange-600" />
              </div>
              <p className="text-3xl font-bold text-orange-700">{stats.atRisk}</p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-purple-600 font-semibold">Avg. Completion</p>
                <Target className="w-5 h-5 text-purple-600" />
              </div>
              <p className="text-3xl font-bold text-purple-700">{stats.avgCompletion}%</p>
            </div>
          </div>

          {/* Tabs and Filters */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <button 
                onClick={() => setSelectedTab('all')}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  selectedTab === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All ({stats.total})
              </button>
              <button 
                onClick={() => setSelectedTab('active')}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  selectedTab === 'active' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Active ({stats.active})
              </button>
              <button 
                onClick={() => setSelectedTab('at-risk')}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  selectedTab === 'at-risk' ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                At Risk ({stats.atRisk})
              </button>
              <button 
                onClick={() => setSelectedTab('inactive')}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  selectedTab === 'inactive' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Inactive ({stats.inactive})
              </button>
            </div>

            <div className="flex items-center space-x-3">
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Search learners..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-64 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <select 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-semibold"
              >
                <option value="recent">Recently Active</option>
                <option value="name">Name (A-Z)</option>
                <option value="progress">Highest Progress</option>
                <option value="courses">Most Courses</option>
              </select>
            </div>
          </div>
        </div>

        {/* Learners List */}
        <div className="p-8">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            {filteredLearners.map((learner) => (
              <div 
                key={learner.id}
                className="p-6 border-b border-gray-200 last:border-b-0 hover:bg-gray-50 transition-all"
              >
                <div className="flex items-center justify-between">
                  {/* Learner Info */}
                  <div className="flex items-center flex-1">
                    <div className={`w-16 h-16 bg-gradient-to-br ${learner.avatarColor} rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg`}>
                      {learner.avatar}
                    </div>
                    
                    <div className="ml-4 flex-1">
                      <div className="flex items-center space-x-3 mb-1">
                        <h3 className="font-bold text-lg">{learner.name}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center space-x-1 ${getStatusColor(learner.status)}`}>
                          {getStatusIcon(learner.status)}
                          <span className="capitalize">{learner.status.replace('-', ' ')}</span>
                        </span>
                        {learner.streak > 0 && (
                          <div className="flex items-center bg-orange-100 px-2 py-1 rounded-full">
                            <Zap className="w-4 h-4 text-orange-600 mr-1" />
                            <span className="text-xs font-semibold text-orange-700">{learner.streak} day streak</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <span className="flex items-center">
                          <Mail className="w-4 h-4 mr-1" />
                          {learner.email}
                        </span>
                        <span>•</span>
                        <span>{learner.department}</span>
                        <span>•</span>
                        <span>{learner.role}</span>
                        <span>•</span>
                        <span className="flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          Last active {learner.lastActive}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center space-x-8 mr-6">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-900">{learner.enrolledCourses}</p>
                      <p className="text-xs text-gray-600">Enrolled</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">{learner.completedCourses}</p>
                      <p className="text-xs text-gray-600">Completed</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <p className="text-2xl font-bold text-blue-600">{learner.totalProgress}%</p>
                        {learner.totalProgress >= 80 ? (
                          <ArrowUpRight className="w-5 h-5 text-green-600" />
                        ) : learner.totalProgress >= 50 ? (
                          <TrendingUp className="w-5 h-5 text-yellow-600" />
                        ) : (
                          <ArrowDownRight className="w-5 h-5 text-red-600" />
                        )}
                      </div>
                      <p className="text-xs text-gray-600">Avg. Progress</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-purple-600">{learner.averageScore}%</p>
                      <p className="text-xs text-gray-600">Avg. Score</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2">
                    <button 
                      onClick={() => setShowLearnerDetail(learner)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold flex items-center transition-all"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View Details
                    </button>
                    
                    <div className="relative">
                      <button 
                        onClick={() => setActiveDropdown(activeDropdown === learner.id ? null : learner.id)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-all"
                      >
                        <MoreVertical className="w-5 h-5 text-gray-600" />
                      </button>

                      {activeDropdown === learner.id && (
                        <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-2xl border border-gray-200 py-2 z-30">
                          <button className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center text-sm">
                            <Mail className="w-4 h-4 mr-3" />
                            Send Message
                          </button>
                          <button 
                            onClick={() => {
                              handleSendReminder(learner.id);
                              setActiveDropdown(null);
                            }}
                            className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center text-sm"
                          >
                            <Bell className="w-4 h-4 mr-3" />
                            Send Reminder
                          </button>
                          <button className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center text-sm">
                            <BookOpen className="w-4 h-4 mr-3" />
                            Enroll in Course
                          </button>
                          <button className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center text-sm">
                            <FileDown className="w-4 h-4 mr-3" />
                            Export Progress
                          </button>
                          <hr className="my-2" />
                          <button 
                            onClick={() => {
                              handleRemoveLearner(learner.id);
                              setActiveDropdown(null);
                            }}
                            className="w-full px-4 py-2 text-left hover:bg-red-50 flex items-center text-sm text-red-600"
                          >
                            <UserMinus className="w-4 h-4 mr-3" />
                            Remove Learner
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-semibold">Overall Progress</span>
                    <span className="text-gray-600">{learner.completedCourses} of {learner.enrolledCourses} courses completed</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className={`h-3 rounded-full transition-all ${
                        learner.totalProgress >= 80 ? 'bg-green-500' :
                        learner.totalProgress >= 50 ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`}
                      style={{width: `${learner.totalProgress}%`}}
                    ></div>
                  </div>
                </div>

                {/* Badges and Certificates */}
                <div className="mt-4 flex items-center space-x-6 text-sm">
                  <div className="flex items-center">
                    <Trophy className="w-4 h-4 text-yellow-600 mr-2" />
                    <span className="font-semibold">{learner.badges}</span>
                    <span className="text-gray-600 ml-1">badges</span>
                  </div>
                  <div className="flex items-center">
                    <Award className="w-4 h-4 text-purple-600 mr-2" />
                    <span className="font-semibold">{learner.certificates}</span>
                    <span className="text-gray-600 ml-1">certificates</span>
                  </div>
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 text-blue-600 mr-2" />
                    <span className="font-semibold">{learner.totalTimeSpent}</span>
                    <span className="text-gray-600 ml-1">learning time</span>
                  </div>
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 text-gray-600 mr-2" />
                    <span className="text-gray-600">Joined {learner.joinedDate}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Invite Learners Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-2xl font-bold">Invite Learners</h3>
              <button 
                onClick={() => {
                  setShowInviteModal(false);
                  setInviteEmails('');
                  setBulkUploadFile(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              {/* Email Input */}
              <div className="mb-6">
                <label className="block text-sm font-semibold mb-2">Email Addresses</label>
                <textarea 
                  value={inviteEmails}
                  onChange={(e) => setInviteEmails(e.target.value)}
                  placeholder="Enter email addresses separated by commas or new lines&#10;e.g., john@company.com, jane@company.com"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent h-32 resize-none"
                />
                <p className="text-xs text-gray-600 mt-2">Separate multiple emails with commas or line breaks</p>
              </div>

              {/* Divider */}
              <div className="flex items-center my-6">
                <div className="flex-1 border-t border-gray-300"></div>
                <span className="px-4 text-sm text-gray-600 font-semibold">OR</span>
                <div className="flex-1 border-t border-gray-300"></div>
              </div>

              {/* Bulk Upload */}
              <div className="mb-6">
                <label className="block text-sm font-semibold mb-2">Bulk Upload CSV</label>
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-500 transition-all cursor-pointer">
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="font-semibold mb-1">Drop CSV file here or click to browse</p>
                  <p className="text-sm text-gray-600 mb-3">Upload a CSV with columns: name, email, department</p>
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-sm">
                    Choose File
                  </button>
                </div>
                {bulkUploadFile && (
                  <div className="mt-3 flex items-center justify-between bg-blue-50 p-3 rounded-lg">
                    <div className="flex items-center">
                      <FileText className="w-5 h-5 text-blue-600 mr-2" />
                      <span className="text-sm font-semibold">{bulkUploadFile.name}</span>
                    </div>
                    <button onClick={() => setBulkUploadFile(null)} className="text-red-600 hover:text-red-700">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Course Assignment */}
              <div className="mb-6">
                <label className="block text-sm font-semibold mb-2">Auto-Enroll in Courses (Optional)</label>
                <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                  <option value="">Select courses to auto-enroll</option>
                  <option value="1">Product Onboarding 2024</option>
                  <option value="2">Security & Compliance Training</option>
                  <option value="3">Sales Methodology Basics</option>
                </select>
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                <div className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-900">
                    <p className="font-semibold mb-1">What happens next?</p>
                    <ul className="space-y-1 text-blue-800">
                      <li>• Learners will receive an email invitation</li>
                      <li>• They can create an account and access assigned courses</li>
                      <li>• You'll be able to track their progress immediately</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex space-x-3">
                <button 
                  onClick={() => {
                    setShowInviteModal(false);
                    setInviteEmails('');
                    setBulkUploadFile(null);
                  }}
                  className="flex-1 px-6 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 font-semibold transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleInviteLearners}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold transition-all shadow-lg flex items-center justify-center"
                >
                  <Send className="w-5 h-5 mr-2" />
                  Send Invitations
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Learner Detail Modal */}
      {showLearnerDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full my-8">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center">
                <div className={`w-16 h-16 bg-gradient-to-br ${showLearnerDetail.avatarColor} rounded-full flex items-center justify-center text-white font-bold text-2xl shadow-lg`}>
                  {showLearnerDetail.avatar}
                </div>
                <div className="ml-4">
                  <h3 className="text-2xl font-bold">{showLearnerDetail.name}</h3>
                  <p className="text-gray-600">{showLearnerDetail.email}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowLearnerDetail(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200">
                  <p className="text-sm text-blue-600 font-semibold mb-1">Total Progress</p>
                  <p className="text-3xl font-bold text-blue-700">{showLearnerDetail.totalProgress}%</p>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl border border-green-200">
                  <p className="text-sm text-green-600 font-semibold mb-1">Avg. Score</p>
                  <p className="text-3xl font-bold text-green-700">{showLearnerDetail.averageScore}%</p>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200">
                  <p className="text-sm text-purple-600 font-semibold mb-1">Certificates</p>
                  <p className="text-3xl font-bold text-purple-700">{showLearnerDetail.certificates}</p>
                </div>
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-xl border border-orange-200">
                  <p className="text-sm text-orange-600 font-semibold mb-1">Time Spent</p>
                  <p className="text-2xl font-bold text-orange-700">{showLearnerDetail.totalTimeSpent}</p>
                </div>
              </div>

              {/* Profile Info */}
              <div className="mb-6 bg-gray-50 rounded-xl p-4">
                <h4 className="font-bold mb-3">Profile Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600 mb-1">Department</p>
                    <p className="font-semibold">{showLearnerDetail.department}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 mb-1">Role</p>
                    <p className="font-semibold">{showLearnerDetail.role}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 mb-1">Manager</p>
                    <p className="font-semibold">{showLearnerDetail.manager}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 mb-1">Joined Date</p>
                    <p className="font-semibold">{showLearnerDetail.joinedDate}</p>
                  </div>
                </div>
              </div>

              {/* Enrolled Courses */}
              <div className="mb-6">
                <h4 className="font-bold mb-3">Enrolled Courses ({showLearnerDetail.enrolledCourses})</h4>
                <div className="space-y-3">
                  {showLearnerDetail.courses.map((course) => (
                    <div key={course.id} className="bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex-1">
                          <h5 className="font-semibold">{course.name}</h5>
                          <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              course.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {course.status === 'completed' ? 'Completed' : 'In Progress'}
                            </span>
                            {course.status === 'completed' ? (
                              <span>Completed: {course.completedDate}</span>
                            ) : (
                              <span>Last accessed: {course.lastAccessed}</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-blue-600">{course.score}%</p>
                          <p className="text-xs text-gray-600">Score</p>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 mr-3">
                          <div 
                            className={`h-2 rounded-full ${
                              course.progress === 100 ? 'bg-green-500' : 'bg-blue-500'
                            }`}
                            style={{width: `${course.progress}%`}}
                          ></div>
                        </div>
                        <span className="text-sm font-semibold">{course.progress}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Activity */}
              <div className="mb-6">
                <h4 className="font-bold mb-3">Recent Activity</h4>
                <div className="space-y-3">
                  {showLearnerDetail.activityLog.map((activity, idx) => (
                    <div key={idx} className="flex items-center bg-gray-50 rounded-lg p-3">
                      {activity.type === 'completed' && <CheckCircle className="w-5 h-5 text-green-600 mr-3" />}
                      {activity.type === 'started' && <Play className="w-5 h-5 text-blue-600 mr-3" />}
                      {activity.type === 'quiz-passed' && <Trophy className="w-5 h-5 text-yellow-600 mr-3" />}
                      {activity.type === 'missed-deadline' && <AlertCircle className="w-5 h-5 text-red-600 mr-3" />}
                      {activity.type === 'inactive' && <Clock className="w-5 h-5 text-gray-600 mr-3" />}
                      <div className="flex-1">
                        <p className="text-sm font-semibold">
                          {activity.type === 'completed' && `Completed ${activity.course}`}
                          {activity.type === 'started' && `Started ${activity.course}`}
                          {activity.type === 'quiz-passed' && `Passed quiz in ${activity.course} with ${activity.score}%`}
                          {activity.type === 'missed-deadline' && `Missed deadline for ${activity.course}`}
                          {activity.type === 'inactive' && 'No activity'}
                        </p>
                        <p className="text-xs text-gray-600">{activity.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex space-x-3">
                <button className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold flex items-center justify-center transition-all">
                  <Mail className="w-5 h-5 mr-2" />
                  Send Message
                </button>
                <button className="flex-1 px-4 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 font-semibold flex items-center justify-center transition-all">
                  <BookOpen className="w-5 h-5 mr-2" />
                  Enroll in Course
                </button>
                <button className="flex-1 px-4 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 font-semibold flex items-center justify-center transition-all">
                  <Download className="w-5 h-5 mr-2" />
                  Export Data
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoursifyLearners;