import React, { useState } from 'react';
import { Play, Upload, Edit, Users, BarChart3, Settings, Plus, Check, X, Clock, FileText, Video, Folder, ChevronRight, Menu, Search, Bell, Award, TrendingUp, Home, BookOpen, Zap, Eye, Share2, Download, Target, Mail } from 'lucide-react';

const CoursifyLMS = () => {
  const [currentView, setCurrentView] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Navigation Item Component
  const NavItem = ({ icon: Icon, label, view }: { icon: React.ComponentType<{ className?: string }>; label: string; view: string }) => (
    <button 
      onClick={() => setCurrentView(view)} 
      className={`w-full flex items-center p-3 rounded-lg transition-all ${
        currentView === view ? 'bg-white text-blue-600 shadow-lg' : 'hover:bg-blue-500'
      }`}
    >
      <Icon className="w-5 h-5" />
      {sidebarOpen && <span className="ml-3 font-semibold">{label}</span>}
    </button>
  );

  // Stat Card Component
  const StatCard = ({ icon: Icon, title, value, change, color }: { icon: React.ComponentType<{ className?: string }>; title: string; value: string | number; change: string; color: string }) => {
    const colors = {
      blue: 'from-blue-500 to-blue-600',
      purple: 'from-purple-500 to-purple-600',
      green: 'from-green-500 to-green-600',
      orange: 'from-orange-500 to-orange-600'
    };

    return (
      <div className={`bg-gradient-to-br ${(colors as Record<string, string>)[color] ?? colors.blue} text-white p-6 rounded-2xl shadow-lg`}>
        <div className="flex items-center justify-between mb-4">
          <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
            <Icon className="w-6 h-6" />
          </div>
          <span className="text-sm font-semibold bg-white bg-opacity-20 px-3 py-1 rounded-full">{change}</span>
        </div>
        <p className="text-sm opacity-90">{title}</p>
        <p className="text-4xl font-bold mt-1">{value}</p>
      </div>
    );
  };

  // Main App Layout
  const AppLayout = ({ children }: { children: React.ReactNode }) => (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className={`bg-gradient-to-b from-blue-600 to-blue-700 text-white transition-all ${sidebarOpen ? 'w-64' : 'w-20'}`}>
        <div className="p-4 border-b border-blue-500 flex items-center justify-between">
          {sidebarOpen && (
            <div className="flex items-center">
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                <Video className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-3">
                <span className="font-bold text-lg">Coursify</span>
                <p className="text-xs text-blue-200">LMS Platform</p>
              </div>
            </div>
          )}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-blue-500 rounded-lg">
            <Menu className="w-5 h-5" />
          </button>
        </div>
        
        <nav className="p-4 space-y-2">
          <NavItem icon={Home} label="Dashboard" view="dashboard" />
          <NavItem icon={Video} label="My Courses" view="courses" />
          <NavItem icon={Plus} label="Create Course" view="create" />
          <NavItem icon={Users} label="Learners" view="learners" />
          <NavItem icon={BarChart3} label="Analytics" view="analytics" />
          <NavItem icon={FileText} label="Reports" view="reports" />
          <NavItem icon={Settings} label="Settings" view="settings" />
        </nav>
        
        {sidebarOpen && (
          <div className="absolute bottom-0 w-64 p-4 border-t border-blue-500">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white font-bold text-sm">
                JD
              </div>
              <div className="ml-3">
                <p className="text-sm font-semibold">John Doe</p>
                <p className="text-xs text-blue-200">Admin</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );

  // Dashboard View
  const Dashboard = () => (
    <div>
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-1">Welcome back! Here's your overview</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Search..." className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-64 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <button className="p-2 hover:bg-gray-100 rounded-lg relative">
              <Bell className="w-6 h-6 text-gray-600" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
          </div>
        </div>
      </div>

      <div className="p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard icon={Users} title="Total Learners" value="1,247" change="+12%" color="blue" />
          <StatCard icon={Video} title="Active Courses" value="24" change="+8%" color="purple" />
          <StatCard icon={Award} title="Completion Rate" value="78%" change="+23%" color="green" />
          <StatCard icon={Clock} title="Avg. Time" value="4.2h" change="Month" color="orange" />
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold">Weekly Progress</h3>
              <select className="px-3 py-1 border border-gray-300 rounded-lg text-sm">
                <option>Last 7 days</option>
              </select>
            </div>
            <div className="h-64 flex items-end justify-around space-x-2">
              {[65, 72, 68, 80, 75, 78, 85].map((h, i) => (
                <div key={i} className="flex flex-col items-center flex-1">
                  <div className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-lg" style={{height: `${h}%`}}></div>
                  <span className="text-xs text-gray-600 mt-2 font-medium">W{i+1}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold">Top Courses</h3>
              <button className="text-blue-600 text-sm font-semibold">View All</button>
            </div>
            <div className="space-y-4">
              {[
                { name: 'Product Onboarding', completion: 92, learners: 156 },
                { name: 'Security Training', completion: 87, learners: 143 },
                { name: 'Sales Basics', completion: 84, learners: 128 }
              ].map((c, i) => (
                <div key={i} className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex justify-between mb-2">
                    <p className="font-semibold text-sm">{c.name}</p>
                    <span className="text-sm">{c.learners} learners</span>
                  </div>
                  <div className="flex items-center">
                    <div className="flex-1 bg-gray-200 rounded-full h-2 mr-3">
                      <div className="bg-blue-500 h-2 rounded-full" style={{width: `${c.completion}%`}}></div>
                    </div>
                    <span className="text-xs font-semibold">{c.completion}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Courses View
  const Courses = () => (
    <div>
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">My Courses</h1>
            <p className="text-gray-600 mt-1">Manage your content</p>
          </div>
          <button onClick={() => setCurrentView('create')} className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold flex items-center">
            <Plus className="w-5 h-5 mr-2" />
            Create Course
          </button>
        </div>
      </div>

      <div className="p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { title: 'Product Onboarding 2024', modules: 8, learners: 156, completion: 92, status: 'Published' },
            { title: 'Security Training', modules: 6, learners: 143, completion: 87, status: 'Published' },
            { title: 'Sales Basics', modules: 10, learners: 128, completion: 84, status: 'Draft' }
          ].map((course, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-all">
              <div className="bg-gradient-to-br from-blue-400 to-blue-500 h-40 flex items-center justify-center relative">
                <Video className="w-16 h-16 text-white opacity-80" />
                <span className={`absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-semibold ${
                  course.status === 'Published' ? 'bg-green-500' : 'bg-yellow-500'
                } text-white`}>
                  {course.status}
                </span>
              </div>
              <div className="p-6">
                <h3 className="font-bold text-lg mb-3">{course.title}</h3>
                <div className="flex justify-between text-sm text-gray-600 mb-4">
                  <span className="flex items-center"><BookOpen className="w-4 h-4 mr-1" />{course.modules}</span>
                  <span className="flex items-center"><Users className="w-4 h-4 mr-1" />{course.learners}</span>
                </div>
                {course.completion > 0 && (
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600">Completion</span>
                      <span className="font-semibold">{course.completion}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full" style={{width: `${course.completion}%`}}></div>
                    </div>
                  </div>
                )}
                <div className="flex space-x-2">
                  <button onClick={() => setCurrentView('create')} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold flex items-center justify-center">
                    <Edit className="w-4 h-4 mr-2" />Edit
                  </button>
                  <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Create Course (Micro-Video Editor)
  const CreateCourse = () => (
    <div className="h-full flex">
      <div className="w-80 bg-white border-r border-gray-200 overflow-auto">
        <div className="p-6 border-b">
          <button onClick={() => setCurrentView('courses')} className="flex items-center text-blue-600 mb-4">
            <ChevronRight className="w-5 h-5 rotate-180" />
            <span className="ml-2 font-semibold">Back</span>
          </button>
          <h3 className="text-lg font-bold">Structure</h3>
        </div>
        <div className="p-6 space-y-3">
          {[
            { title: '1. Introduction', lessons: 3, active: true },
            { title: '2. Core Concepts', lessons: 5, active: false }
          ].map((m, i) => (
            <div key={i} className={`p-4 rounded-xl border-2 ${m.active ? 'bg-blue-50 border-blue-500' : 'border-gray-200'}`}>
              <p className="font-semibold text-sm">{m.title}</p>
              <p className="text-xs text-gray-600 mt-1">{m.lessons} lessons</p>
            </div>
          ))}
          <button className="w-full p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-500 flex items-center justify-center">
            <Plus className="w-5 h-5 mr-2" />Add
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="bg-white border-b p-6">
          <div className="flex justify-between items-center">
            <input type="text" defaultValue="Product Onboarding" className="text-3xl font-bold border-none focus:outline-none" />
            <div className="flex space-x-3">
              <button className="px-6 py-3 border rounded-xl hover:bg-gray-50 font-semibold">Preview</button>
              <button className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold">Publish</button>
            </div>
          </div>
        </div>

        <div className="p-8">
          <div className="bg-white p-8 rounded-2xl border-2 border-blue-200 mb-6">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <h3 className="text-xl font-bold">Micro-Video Editor</h3>
                <p className="text-sm text-gray-600">Update segments without re-recording</p>
              </div>
            </div>

            <div className="bg-gray-900 rounded-2xl mb-6 aspect-video flex items-center justify-center relative">
              <button className="w-20 h-20 bg-white rounded-full flex items-center justify-center hover:scale-110 transition-all">
                <Play className="w-10 h-10 text-blue-600 ml-1" />
              </button>
            </div>

            <div className="mb-6">
              <div className="flex justify-between mb-4">
                <p className="font-bold text-lg">Video Segments</p>
                <button className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center">
                  <Plus className="w-5 h-5 mr-2" />Add
                </button>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 border-2 border-blue-500 p-5 rounded-xl">
                  <div className="flex justify-between mb-3">
                    <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold">1</div>
                    <div className="flex space-x-2">
                      <button className="p-2 bg-white rounded-lg"><Edit className="w-4 h-4" /></button>
                      <button className="p-2 bg-white rounded-lg"><X className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <p className="font-bold">Intro</p>
                  <p className="text-sm text-gray-600">0:00 - 2:30</p>
                </div>

                <div className="bg-gray-50 border-2 border-gray-200 p-5 rounded-xl hover:border-blue-400">
                  <div className="flex justify-between mb-3">
                    <div className="w-10 h-10 bg-gray-300 rounded-lg flex items-center justify-center text-white font-bold">2</div>
                    <div className="flex space-x-2">
                      <button className="p-2 bg-white rounded-lg"><Edit className="w-4 h-4" /></button>
                      <button className="p-2 bg-white rounded-lg"><X className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <p className="font-bold">Overview</p>
                  <p className="text-sm text-gray-600">2:30 - 8:15</p>
                </div>

                <div className="bg-gray-50 border-2 border-gray-200 p-5 rounded-xl hover:border-blue-400">
                  <div className="flex justify-between mb-3">
                    <div className="w-10 h-10 bg-gray-300 rounded-lg flex items-center justify-center text-white font-bold">3</div>
                    <div className="flex space-x-2">
                      <button className="p-2 bg-white rounded-lg"><Edit className="w-4 h-4" /></button>
                      <button className="p-2 bg-white rounded-lg"><X className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <p className="font-bold">Demo</p>
                  <p className="text-sm text-gray-600">8:15 - 15:00</p>
                </div>
              </div>
            </div>

            <div className="border-t pt-6">
              <p className="font-bold text-lg mb-4">Version History</p>
              <div className="space-y-3">
                <div className="flex justify-between p-4 bg-blue-50 border-2 border-blue-500 rounded-xl">
                  <div>
                    <p className="font-semibold">Version 3</p>
                    <p className="text-sm text-gray-600">2 hours ago</p>
                  </div>
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold">Current</button>
                </div>
                <div className="flex justify-between p-4 bg-gray-50 rounded-xl">
                  <div>
                    <p className="font-semibold">Version 2</p>
                    <p className="text-sm text-gray-600">1 day ago</p>
                  </div>
                  <button className="text-blue-600 font-semibold">Restore</button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-2xl border">
            <div className="flex justify-between mb-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center">
                  <Folder className="w-6 h-6 text-white" />
                </div>
                <div className="ml-4">
                  <h3 className="text-xl font-bold">Google Drive</h3>
                  <p className="text-sm text-gray-600">Store files externally</p>
                </div>
              </div>
              <button className="px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 flex items-center">
                <Folder className="w-5 h-5 mr-2" />Connect Drive
              </button>
            </div>
            <div className="grid grid-cols-4 gap-4">
              {['intro.mp4', 'demo.mp4', 'slides.pdf'].map((f, i) => (
                <div key={i} className="border-2 border-gray-200 rounded-xl p-4 hover:border-blue-500">
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mb-2">
                    <Video className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-semibold truncate">{f}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Learners View
  const Learners = () => (
    <div>
      <div className="bg-white border-b px-8 py-6">
        <div className="flex justify-between">
          <div>
            <h1 className="text-3xl font-bold">Learners</h1>
            <p className="text-gray-600 mt-1">Manage your students</p>
          </div>
          <button className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 flex items-center">
            <Plus className="w-5 h-5 mr-2" />Invite Learners
          </button>
        </div>
      </div>

      <div className="p-8">
        <div className="bg-white rounded-2xl border">
          <div className="p-6 border-b">
            <input type="text" placeholder="Search learners..." className="w-full px-4 py-2 border rounded-lg" />
          </div>
          <div className="divide-y">
            {[
              { name: 'Sarah Johnson', email: 'sarah@company.com', courses: 8, completion: 92, avatar: 'SJ' },
              { name: 'Mike Chen', email: 'mike@company.com', courses: 6, completion: 78, avatar: 'MC' },
              { name: 'Emma Davis', email: 'emma@company.com', courses: 10, completion: 85, avatar: 'ED' }
            ].map((l, i) => (
              <div key={i} className="p-6 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                      {l.avatar}
                    </div>
                    <div className="ml-4">
                      <p className="font-semibold">{l.name}</p>
                      <p className="text-sm text-gray-600">{l.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-8">
                    <div className="text-center">
                      <p className="text-2xl font-bold">{l.courses}</p>
                      <p className="text-xs text-gray-600">Courses</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold">{l.completion}%</p>
                      <p className="text-xs text-gray-600">Completion</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // Analytics View
  const Analytics = () => (
    <div>
      <div className="bg-white border-b px-8 py-6">
        <h1 className="text-3xl font-bold">Analytics</h1>
        <p className="text-gray-600 mt-1">Track performance and insights</p>
      </div>
      <div className="p-8">
        <div className="bg-white p-8 rounded-2xl border text-center">
          <BarChart3 className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-xl font-bold mb-2">Advanced Analytics</h3>
          <p className="text-gray-600">Detailed insights and reports coming soon</p>
        </div>
      </div>
    </div>
  );

  // Render current view
  return (
    <AppLayout>
      {currentView === 'dashboard' && <Dashboard />}
      {currentView === 'courses' && <Courses />}
      {currentView === 'create' && <CreateCourse />}
      {currentView === 'learners' && <Learners />}
      {currentView === 'analytics' && <Analytics />}
      {currentView === 'reports' && <Analytics />}
      {currentView === 'settings' && <Analytics />}
    </AppLayout>
  );
};

export default CoursifyLMS;