import React, { useState } from 'react';
import { 
  Play, Users, BarChart3, Settings, Plus, Clock, Video, 
  ChevronRight, Menu, Search, Bell, Award, Home, FileText,
  Edit, X, Eye, Mail, Phone, MapPin, Calendar, Briefcase,
  TrendingUp, CheckCircle, Star, Zap, Activity, Target,
  Upload, Camera, Save, Lock, Shield, Globe, Smartphone,
  CreditCard, Download, Share2, User, BookOpen, Trophy,
  ArrowRight, LogOut, Key, AlertCircle, Info, Check
} from 'lucide-react';

const CoursifyProfile = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);

  // User Data
  const [userData, setUserData] = useState({
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@company.com',
    phone: '+1 (555) 123-4567',
    jobTitle: 'Senior Product Manager',
    department: 'Product',
    location: 'San Francisco, CA',
    timezone: 'America/Los_Angeles',
    joinDate: 'November 15, 2024',
    bio: 'Passionate about creating innovative learning experiences and driving product excellence.',
    linkedIn: 'linkedin.com/in/johndoe',
    twitter: '@johndoe',
    website: 'johndoe.com'
  });

  // Learning Stats
  const learningStats = {
    coursesCompleted: 12,
    coursesInProgress: 3,
    totalCourses: 15,
    certificates: 8,
    badges: 15,
    totalPoints: 2450,
    rank: 5,
    streak: 12,
    hoursLearned: 48.5,
    avgScore: 94,
    completionRate: 89
  };

  // Recent Activity
  const recentActivity = [
    { type: 'completed', course: 'Product Onboarding 2024', date: '2 days ago', score: 95 },
    { type: 'started', course: 'Advanced Leadership Skills', date: '1 week ago' },
    { type: 'certificate', course: 'Security & Compliance Training', date: '2 weeks ago' },
    { type: 'badge', name: 'Fast Learner', date: '3 weeks ago' }
  ];

  // Completed Courses
  const completedCourses = [
    { id: 1, name: 'Product Onboarding 2024', completed: 'Jan 2, 2025', score: 95, duration: '2h 15m' },
    { id: 2, name: 'Security & Compliance', completed: 'Dec 28, 2024', score: 92, duration: '1h 45m' },
    { id: 3, name: 'Sales Methodology', completed: 'Dec 15, 2024', score: 88, duration: '3h 30m' },
    { id: 4, name: 'Customer Success', completed: 'Dec 1, 2024', score: 94, duration: '2h 45m' }
  ];

  // In Progress Courses
  const inProgressCourses = [
    { id: 1, name: 'Advanced Leadership Skills', progress: 65, lastAccessed: '1 day ago', nextLesson: 'Module 4: Team Building' },
    { id: 2, name: 'Data Analysis Fundamentals', progress: 42, lastAccessed: '3 days ago', nextLesson: 'Module 3: Visualization' },
    { id: 3, name: 'Project Management Basics', progress: 28, lastAccessed: '1 week ago', nextLesson: 'Module 2: Planning' }
  ];

  // Badges & Achievements
  const badges = [
    { id: 1, name: 'Fast Learner', description: 'Complete 3 courses in one week', earned: 'Dec 2024', icon: Zap, color: 'yellow' },
    { id: 2, name: 'Perfect Score', description: 'Achieve 100% on any assessment', earned: 'Jan 2025', icon: Star, color: 'purple' },
    { id: 3, name: '10 Day Streak', description: 'Learn for 10 consecutive days', earned: 'Jan 2025', icon: Activity, color: 'orange' },
    { id: 4, name: 'Top Performer', description: 'Rank in top 5 learners', earned: 'Dec 2024', icon: Trophy, color: 'blue' },
    { id: 5, name: 'Course Master', description: 'Complete 10 courses', earned: 'Dec 2024', icon: Target, color: 'green' },
    { id: 6, name: 'Early Adopter', description: 'Join in the first month', earned: 'Nov 2024', icon: CheckCircle, color: 'indigo' }
  ];

  // Certificates
  const certificates = [
    { id: 1, course: 'Product Onboarding 2024', issued: 'Jan 2, 2025', certificateId: 'CERT-2025-001' },
    { id: 2, course: 'Security & Compliance Training', issued: 'Dec 28, 2024', certificateId: 'CERT-2024-234' },
    { id: 3, course: 'Sales Methodology Basics', issued: 'Dec 15, 2024', certificateId: 'CERT-2024-198' },
    { id: 4, course: 'Customer Success Fundamentals', issued: 'Dec 1, 2024', certificateId: 'CERT-2024-156' }
  ];

  const handleSaveProfile = () => {
    setIsEditing(false);
    // Save logic here
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
          <button className="w-full flex items-center p-3 rounded-lg hover:bg-blue-500 transition-all">
            <FileText className="w-5 h-5" />
            {sidebarOpen && <span className="ml-3 font-semibold">Reports</span>}
          </button>
          <div className="w-full flex items-center p-3 rounded-lg bg-white text-blue-600 shadow-lg">
            <User className="w-5 h-5" />
            {sidebarOpen && <span className="ml-3 font-semibold">Profile</span>}
          </div>
        </nav>

        {sidebarOpen && (
          <div className="absolute bottom-0 w-64 p-4 border-t border-blue-500 bg-blue-700">
            <button className="w-full flex items-center p-3 rounded-lg hover:bg-blue-600 transition-all text-left">
              <LogOut className="w-5 h-5" />
              <span className="ml-3 font-semibold">Sign Out</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {/* Header with Cover */}
        <div className="relative">
          {/* Cover Photo */}
          <div className="h-48 bg-gradient-to-r from-blue-600 via-blue-500 to-purple-600 relative">
            <button className="absolute top-4 right-4 px-4 py-2 bg-white bg-opacity-20 backdrop-blur-sm text-white rounded-lg hover:bg-opacity-30 font-semibold flex items-center">
              <Camera className="w-4 h-4 mr-2" />
              Change Cover
            </button>
          </div>

          {/* Profile Header */}
          <div className="max-w-7xl mx-auto px-8">
            <div className="relative -mt-20 pb-6">
              <div className="flex items-end space-x-6">
                {/* Avatar */}
                <div className="relative">
                  <div className="w-40 h-40 bg-gradient-to-br from-purple-400 to-pink-400 rounded-2xl flex items-center justify-center text-white font-bold text-5xl shadow-2xl border-4 border-white">
                    JD
                  </div>
                  <button 
                    onClick={() => setShowAvatarModal(true)}
                    className="absolute bottom-2 right-2 w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white hover:bg-blue-700 shadow-lg"
                  >
                    <Camera className="w-5 h-5" />
                  </button>
                </div>

                {/* Info */}
                <div className="flex-1 pb-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h1 className="text-3xl font-bold text-gray-900">{userData.firstName} {userData.lastName}</h1>
                      <p className="text-gray-600 mt-1">{userData.jobTitle} • {userData.department}</p>
                      <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                        <span className="flex items-center">
                          <MapPin className="w-4 h-4 mr-1" />
                          {userData.location}
                        </span>
                        <span className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          Joined {userData.joinDate}
                        </span>
                      </div>
                    </div>
                    <button 
                      onClick={() => setIsEditing(!isEditing)}
                      className={`px-6 py-3 rounded-xl font-semibold flex items-center shadow-lg transition-all ${
                        isEditing 
                          ? 'bg-green-600 text-white hover:bg-green-700' 
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {isEditing ? (
                        <>
                          <Save className="w-5 h-5 mr-2" />
                          Save Changes
                        </>
                      ) : (
                        <>
                          <Edit className="w-5 h-5 mr-2" />
                          Edit Profile
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Stats Bar */}
              <div className="grid grid-cols-5 gap-4 mt-6">
                <div className="bg-white p-4 rounded-xl border border-gray-200 text-center">
                  <p className="text-3xl font-bold text-blue-600">{learningStats.coursesCompleted}</p>
                  <p className="text-sm text-gray-600 mt-1">Completed</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 text-center">
                  <p className="text-3xl font-bold text-purple-600">{learningStats.certificates}</p>
                  <p className="text-sm text-gray-600 mt-1">Certificates</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 text-center">
                  <p className="text-3xl font-bold text-green-600">{learningStats.badges}</p>
                  <p className="text-sm text-gray-600 mt-1">Badges</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 text-center">
                  <p className="text-3xl font-bold text-orange-600">{learningStats.streak}</p>
                  <p className="text-sm text-gray-600 mt-1">Day Streak</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 text-center">
                  <p className="text-3xl font-bold text-yellow-600">#{learningStats.rank}</p>
                  <p className="text-sm text-gray-600 mt-1">Rank</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-8">
            <div className="flex space-x-8">
              {[
                { id: 'overview', label: 'Overview', icon: Home },
                { id: 'courses', label: 'Courses', icon: BookOpen },
                { id: 'achievements', label: 'Achievements', icon: Trophy },
                { id: 'certificates', label: 'Certificates', icon: Award },
                { id: 'settings', label: 'Settings', icon: Settings }
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center py-4 border-b-2 transition-all ${
                      activeTab === tab.id
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="w-5 h-5 mr-2" />
                    <span className="font-semibold">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="max-w-7xl mx-auto px-8 py-8">
          {activeTab === 'overview' && (
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Left Column */}
              <div className="lg:col-span-2 space-y-6">
                {/* About */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-xl font-bold mb-4">About</h3>
                  {isEditing ? (
                    <textarea 
                      value={userData.bio}
                      onChange={(e) => setUserData({...userData, bio: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent h-24 resize-none"
                    />
                  ) : (
                    <p className="text-gray-700">{userData.bio}</p>
                  )}
                </div>

                {/* Contact Information */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-xl font-bold mb-4">Contact Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-2">Email</label>
                      {isEditing ? (
                        <input 
                          type="email"
                          value={userData.email}
                          onChange={(e) => setUserData({...userData, email: e.target.value})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      ) : (
                        <p className="text-gray-700 flex items-center">
                          <Mail className="w-4 h-4 mr-2 text-gray-400" />
                          {userData.email}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-2">Phone</label>
                      {isEditing ? (
                        <input 
                          type="tel"
                          value={userData.phone}
                          onChange={(e) => setUserData({...userData, phone: e.target.value})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      ) : (
                        <p className="text-gray-700 flex items-center">
                          <Phone className="w-4 h-4 mr-2 text-gray-400" />
                          {userData.phone}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-2">Location</label>
                      {isEditing ? (
                        <input 
                          type="text"
                          value={userData.location}
                          onChange={(e) => setUserData({...userData, location: e.target.value})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      ) : (
                        <p className="text-gray-700 flex items-center">
                          <MapPin className="w-4 h-4 mr-2 text-gray-400" />
                          {userData.location}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-2">Timezone</label>
                      {isEditing ? (
                        <select 
                          value={userData.timezone}
                          onChange={(e) => setUserData({...userData, timezone: e.target.value})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="America/Los_Angeles">Pacific Time</option>
                          <option value="America/Denver">Mountain Time</option>
                          <option value="America/Chicago">Central Time</option>
                          <option value="America/New_York">Eastern Time</option>
                        </select>
                      ) : (
                        <p className="text-gray-700 flex items-center">
                          <Globe className="w-4 h-4 mr-2 text-gray-400" />
                          Pacific Time
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-xl font-bold mb-4">Recent Activity</h3>
                  <div className="space-y-4">
                    {recentActivity.map((activity, i) => (
                      <div key={i} className="flex items-start p-4 bg-gray-50 rounded-xl">
                        {activity.type === 'completed' && (
                          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-4">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          </div>
                        )}
                        {activity.type === 'started' && (
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                            <Play className="w-5 h-5 text-blue-600" />
                          </div>
                        )}
                        {activity.type === 'certificate' && (
                          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mr-4">
                            <Award className="w-5 h-5 text-purple-600" />
                          </div>
                        )}
                        {activity.type === 'badge' && (
                          <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center mr-4">
                            <Star className="w-5 h-5 text-yellow-600" />
                          </div>
                        )}
                        <div className="flex-1">
                          <p className="font-semibold text-sm">
                            {activity.type === 'completed' && `Completed ${activity.course}`}
                            {activity.type === 'started' && `Started ${activity.course}`}
                            {activity.type === 'certificate' && `Earned certificate for ${activity.course}`}
                            {activity.type === 'badge' && `Earned "${activity.name}" badge`}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">{activity.date}</p>
                          {activity.score && (
                            <span className="inline-block mt-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                              Score: {activity.score}%
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                {/* Learning Progress */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-xl font-bold mb-4">Learning Progress</h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-semibold">Overall Completion</span>
                        <span className="text-blue-600 font-bold">{learningStats.completionRate}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div 
                          className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full"
                          style={{width: `${learningStats.completionRate}%`}}
                        ></div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-200">
                      <div>
                        <p className="text-2xl font-bold text-blue-600">{learningStats.hoursLearned}h</p>
                        <p className="text-xs text-gray-600">Time Spent</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-purple-600">{learningStats.avgScore}%</p>
                        <p className="text-xs text-gray-600">Avg. Score</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Current Streak */}
                <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl shadow-sm p-6 text-white">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold">Current Streak</h3>
                    <Zap className="w-8 h-8" />
                  </div>
                  <p className="text-5xl font-bold mb-2">{learningStats.streak}</p>
                  <p className="text-orange-100">days in a row</p>
                  <div className="mt-4 pt-4 border-t border-orange-400">
                    <p className="text-sm text-orange-100">Keep it up! Learn tomorrow to maintain your streak.</p>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-xl font-bold mb-4">Quick Actions</h3>
                  <div className="space-y-2">
                    <button 
                      onClick={() => setShowPasswordModal(true)}
                      className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg flex items-center justify-between transition-all"
                    >
                      <span className="flex items-center font-semibold text-sm">
                        <Lock className="w-4 h-4 mr-3 text-gray-600" />
                        Change Password
                      </span>
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                    </button>
                    <button className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg flex items-center justify-between transition-all">
                      <span className="flex items-center font-semibold text-sm">
                        <Download className="w-4 h-4 mr-3 text-gray-600" />
                        Download My Data
                      </span>
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                    </button>
                    <button className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg flex items-center justify-between transition-all">
                      <span className="flex items-center font-semibold text-sm">
                        <Share2 className="w-4 h-4 mr-3 text-gray-600" />
                        Share Profile
                      </span>
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'courses' && (
            <div className="space-y-6">
              {/* In Progress */}
              <div>
                <h2 className="text-2xl font-bold mb-4">In Progress ({inProgressCourses.length})</h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {inProgressCourses.map((course) => (
                    <div key={course.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                        <BookOpen className="w-6 h-6 text-blue-600" />
                      </div>
                      <h3 className="font-bold text-lg mb-2">{course.name}</h3>
                      <p className="text-sm text-gray-600 mb-4">Next: {course.nextLesson}</p>
                      <div className="mb-4">
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-600">Progress</span>
                          <span className="font-semibold">{course.progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-500 h-2 rounded-full"
                            style={{width: `${course.progress}%`}}
                          ></div>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mb-4">Last accessed {course.lastAccessed}</p>
                      <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold">
                        Continue Learning
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Completed */}
              <div>
                <h2 className="text-2xl font-bold mb-4">Completed ({completedCourses.length})</h2>
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Course Name</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Completed</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Duration</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Score</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {completedCourses.map((course) => (
                        <tr key={course.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <p className="font-semibold">{course.name}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-gray-600">{course.completed}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-gray-600">{course.duration}</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              course.score >= 90 ? 'bg-green-100 text-green-700' :
                              course.score >= 80 ? 'bg-blue-100 text-blue-700' :
                              'bg-orange-100 text-orange-700'
                            }`}>
                              {course.score}%
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <button className="text-blue-600 hover:text-blue-700 font-semibold text-sm">
                              View Certificate
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'achievements' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Badges & Achievements</h2>
                <div className="text-right">
                  <p className="text-3xl font-bold text-blue-600">{learningStats.badges}</p>
                  <p className="text-sm text-gray-600">Total Badges</p>
                </div>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {badges.map((badge) => {
                  const Icon = badge.icon;
                  return (
                    <div key={badge.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-all">
                      <div className={`w-20 h-20 bg-${badge.color}-100 rounded-2xl flex items-center justify-center mb-4 mx-auto`}>
                        <Icon className={`w-10 h-10 text-${badge.color}-600`} />
                      </div>
                      <h3 className="font-bold text-center mb-2">{badge.name}</h3>
                      <p className="text-sm text-gray-600 text-center mb-3">{badge.description}</p>
                      <div className="text-center">
                        <span className="inline-block px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold">
                          Earned {badge.earned}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'certificates' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">My Certificates</h2>
                <button className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold flex items-center">
                  <Download className="w-5 h-5 mr-2" />
                  Download All
                </button>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                {certificates.map((cert) => (
                  <div key={cert.id} className="bg-white rounded-2xl shadow-sm border-2 border-gray-200 overflow-hidden hover:shadow-lg transition-all">
                    <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
                      <div className="flex items-center justify-between mb-4">
                        <Award className="w-12 h-12" />
                        <span className="px-3 py-1 bg-white bg-opacity-20 rounded-full text-xs font-semibold">
                          Verified
                        </span>
                      </div>
                      <h3 className="text-xl font-bold mb-2">Certificate of Completion</h3>
                      <p className="text-blue-100 text-sm">ID: {cert.certificateId}</p>
                    </div>
                    <div className="p-6">
                      <h4 className="font-bold text-lg mb-2">{cert.course}</h4>
                      <p className="text-gray-600 text-sm mb-4">Issued on {cert.issued}</p>
                      <div className="flex space-x-2">
                        <button className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold flex items-center justify-center">
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </button>
                        <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                          <Share2 className="w-5 h-5 text-gray-600" />
                        </button>
                        <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                          <Eye className="w-5 h-5 text-gray-600" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-4xl">
              <h2 className="text-2xl font-bold mb-6">Account Settings</h2>
              
              <div className="space-y-6">
                {/* Account Security */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-xl font-bold mb-4 flex items-center">
                    <Shield className="w-6 h-6 mr-2 text-blue-600" />
                    Security
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                      <div>
                        <p className="font-semibold">Password</p>
                        <p className="text-sm text-gray-600">Last changed 3 months ago</p>
                      </div>
                      <button 
                        onClick={() => setShowPasswordModal(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
                      >
                        Change
                      </button>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                      <div>
                        <p className="font-semibold">Two-Factor Authentication</p>
                        <p className="text-sm text-gray-600">Add an extra layer of security</p>
                      </div>
                      <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 font-semibold">
                        Enable
                      </button>
                    </div>
                  </div>
                </div>

                {/* Notifications */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-xl font-bold mb-4 flex items-center">
                    <Bell className="w-6 h-6 mr-2 text-blue-600" />
                    Notifications
                  </h3>
                  <div className="space-y-4">
                    <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer">
                      <div>
                        <p className="font-semibold">Email Notifications</p>
                        <p className="text-sm text-gray-600">Receive updates via email</p>
                      </div>
                      <input type="checkbox" defaultChecked className="w-5 h-5 text-blue-600 rounded" />
                    </label>
                    <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer">
                      <div>
                        <p className="font-semibold">Course Reminders</p>
                        <p className="text-sm text-gray-600">Get reminded about incomplete courses</p>
                      </div>
                      <input type="checkbox" defaultChecked className="w-5 h-5 text-blue-600 rounded" />
                    </label>
                    <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer">
                      <div>
                        <p className="font-semibold">Achievement Notifications</p>
                        <p className="text-sm text-gray-600">Get notified about badges and certificates</p>
                      </div>
                      <input type="checkbox" defaultChecked className="w-5 h-5 text-blue-600 rounded" />
                    </label>
                    <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer">
                      <div>
                        <p className="font-semibold">Weekly Reports</p>
                        <p className="text-sm text-gray-600">Receive weekly learning progress reports</p>
                      </div>
                      <input type="checkbox" className="w-5 h-5 text-blue-600 rounded" />
                    </label>
                  </div>
                </div>

                {/* Privacy */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-xl font-bold mb-4 flex items-center">
                    <Lock className="w-6 h-6 mr-2 text-blue-600" />
                    Privacy
                  </h3>
                  <div className="space-y-4">
                    <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer">
                      <div>
                        <p className="font-semibold">Public Profile</p>
                        <p className="text-sm text-gray-600">Make your profile visible to others</p>
                      </div>
                      <input type="checkbox" defaultChecked className="w-5 h-5 text-blue-600 rounded" />
                    </label>
                    <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer">
                      <div>
                        <p className="font-semibold">Show Achievements</p>
                        <p className="text-sm text-gray-600">Display your badges and certificates</p>
                      </div>
                      <input type="checkbox" defaultChecked className="w-5 h-5 text-blue-600 rounded" />
                    </label>
                    <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer">
                      <div>
                        <p className="font-semibold">Show Learning Progress</p>
                        <p className="text-sm text-gray-600">Let others see your course progress</p>
                      </div>
                      <input type="checkbox" className="w-5 h-5 text-blue-600 rounded" />
                    </label>
                  </div>
                </div>

                {/* Danger Zone */}
                <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6">
                  <h3 className="text-xl font-bold mb-4 text-red-900 flex items-center">
                    <AlertCircle className="w-6 h-6 mr-2" />
                    Danger Zone
                  </h3>
                  <div className="space-y-3">
                    <button className="w-full px-4 py-3 bg-white border border-red-300 text-red-600 rounded-lg hover:bg-red-50 font-semibold text-left">
                      Deactivate Account
                    </button>
                    <button className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold text-left">
                      Delete Account Permanently
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-2xl font-bold">Change Password</h3>
              <button 
                onClick={() => setShowPasswordModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-semibold mb-2">Current Password</label>
                  <input 
                    type="password" 
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter current password"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">New Password</label>
                  <input 
                    type="password" 
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter new password"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Confirm New Password</label>
                  <input 
                    type="password" 
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Confirm new password"
                  />
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                <div className="flex items-start">
                  <Info className="w-5 h-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-900">
                    <p className="font-semibold mb-1">Password Requirements</p>
                    <ul className="list-disc list-inside text-blue-800 space-y-1">
                      <li>At least 8 characters long</li>
                      <li>Contains uppercase and lowercase letters</li>
                      <li>Contains at least one number</li>
                      <li>Contains at least one special character</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex space-x-3">
                <button 
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1 px-6 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 font-semibold transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold transition-all shadow-lg"
                >
                  Update Password
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Change Avatar Modal */}
      {showAvatarModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-2xl font-bold">Change Profile Picture</h3>
              <button 
                onClick={() => setShowAvatarModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center mb-6 hover:border-blue-500 transition-all cursor-pointer">
                <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h4 className="font-bold text-lg mb-2">Upload New Photo</h4>
                <p className="text-sm text-gray-600 mb-4">JPG, PNG or GIF • Max 5MB</p>
                <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold">
                  Choose File
                </button>
              </div>

              <div className="flex space-x-3">
                <button 
                  onClick={() => setShowAvatarModal(false)}
                  className="flex-1 px-6 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 font-semibold transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => setShowAvatarModal(false)}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold transition-all shadow-lg"
                >
                  Save Photo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoursifyProfile;