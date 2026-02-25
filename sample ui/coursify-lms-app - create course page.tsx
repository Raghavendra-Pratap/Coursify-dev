import React, { useState } from 'react';
import { 
  Play, Users, BarChart3, Settings, Plus, Clock, Video, 
  ChevronRight, Menu, Search, Bell, Award, Home, FileText,
  Edit, X, Save, Zap, Folder, Upload, Eye, RotateCcw,
  Scissors, Copy, Trash2, AlertCircle, CheckCircle, Info,
  ChevronDown, ChevronUp, Download, Share2, Link2, Globe
} from 'lucide-react';

const CoursifyMicroVideoEditor = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentModule, setCurrentModule] = useState(0);
  const [selectedSegment, setSelectedSegment] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [driveConnected, setDriveConnected] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [segmentToReplace, setSegmentToReplace] = useState<number | null>(null);
  const [previewMode, setPreviewMode] = useState(false);

  // Course structure data
  const [courseData, setCourseData] = useState({
    title: 'Product Onboarding 2024',
    description: 'Complete guide to our product features and best practices',
    lastEdited: '2 hours ago',
    status: 'draft',
    modules: [
      {
        id: 0,
        title: '1. Introduction',
        lessons: 3,
        duration: '15 min',
        segments: [
          { id: 0, name: 'Welcome & Overview', duration: '2:30', startTime: '0:00', endTime: '2:30', status: 'active', size: '24 MB', lastEdited: '2 hours ago' },
          { id: 1, name: 'Product Vision', duration: '3:45', startTime: '2:30', endTime: '6:15', status: 'active', size: '38 MB', lastEdited: '1 day ago' },
          { id: 2, name: 'Getting Started', duration: '5:00', startTime: '6:15', endTime: '11:15', status: 'active', size: '45 MB', lastEdited: '1 day ago' }
        ]
      },
      {
        id: 1,
        title: '2. Core Concepts',
        lessons: 5,
        duration: '28 min',
        segments: []
      },
      {
        id: 2,
        title: '3. Advanced Topics',
        lessons: 4,
        duration: '22 min',
        segments: []
      }
    ]
  });

  // Version history
  const [versions, setVersions] = useState([
    { id: 3, name: 'Version 3', changes: 'Updated intro segment', timestamp: '2 hours ago', isCurrent: true, author: 'John Doe' },
    { id: 2, name: 'Version 2', changes: 'Added product vision section', timestamp: '1 day ago', isCurrent: false, author: 'John Doe' },
    { id: 1, name: 'Version 1', changes: 'Initial upload', timestamp: '3 days ago', isCurrent: false, author: 'Sarah Johnson' }
  ]);

  // Drive files
  const [driveFiles, setDriveFiles] = useState([
    { id: 1, name: 'intro-v3.mp4', size: '24 MB', type: 'video', modified: '2 hours ago' },
    { id: 2, name: 'feature-demo.mp4', size: '18 MB', type: 'video', modified: '1 day ago' },
    { id: 3, name: 'slides.pdf', size: '2 MB', type: 'document', modified: '3 days ago' },
    { id: 4, name: 'resources.pdf', size: '1.5 MB', type: 'document', modified: '1 week ago' }
  ]);

  const currentModuleData = courseData.modules[currentModule];
  const currentSegment = currentModuleData.segments[selectedSegment];

  const handleAddModule = () => {
    const newModule = {
      id: courseData.modules.length,
      title: `${courseData.modules.length + 1}. New Module`,
      lessons: 0,
      duration: '0 min',
      segments: []
    };
    setCourseData({
      ...courseData,
      modules: [...courseData.modules, newModule]
    });
  };

  const handleAddSegment = () => {
    setShowUploadModal(true);
  };

  const handleSegmentUpload = () => {
    // Simulate upload
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      setUploadProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          const newSegment = {
            id: currentModuleData.segments.length,
            name: 'New Segment',
            duration: '2:00',
            startTime: '0:00',
            endTime: '2:00',
            status: 'active',
            size: '20 MB',
            lastEdited: 'Just now'
          };
          const updatedModules = [...courseData.modules];
          updatedModules[currentModule].segments.push(newSegment);
          setCourseData({ ...courseData, modules: updatedModules });
          setShowUploadModal(false);
          setUploadProgress(0);
        }, 500);
      }
    }, 200);
  };

  const handleReplaceSegment = (segmentId: number) => {
    setSegmentToReplace(segmentId);
    setShowUploadModal(true);
  };

  const handleDeleteSegment = (segmentId: number) => {
    const updatedModules = [...courseData.modules];
    updatedModules[currentModule].segments = updatedModules[currentModule].segments.filter(s => s.id !== segmentId);
    setCourseData({ ...courseData, modules: updatedModules });
    if (selectedSegment >= updatedModules[currentModule].segments.length) {
      setSelectedSegment(Math.max(0, updatedModules[currentModule].segments.length - 1));
    }
  };

  const handleRestoreVersion = (versionId: number) => {
    const updatedVersions = versions.map(v => ({
      ...v,
      isCurrent: v.id === versionId
    }));
    setVersions(updatedVersions);
  };

  const connectGoogleDrive = () => {
    // Simulate connection
    setTimeout(() => {
      setDriveConnected(true);
    }, 1000);
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
          <div className="w-full flex items-center p-3 rounded-lg bg-white text-blue-600 shadow-lg">
            <Plus className="w-5 h-5" />
            {sidebarOpen && <span className="ml-3 font-semibold">Create Course</span>}
          </div>
          <button className="w-full flex items-center p-3 rounded-lg hover:bg-blue-500 transition-all">
            <Users className="w-5 h-5" />
            {sidebarOpen && <span className="ml-3 font-semibold">Learners</span>}
          </button>
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
      <div className="flex-1 flex overflow-hidden">
        {/* Course Structure Sidebar */}
        <div className="w-80 bg-white border-r border-gray-200 overflow-auto">
          <div className="p-6 border-b border-gray-200">
            <button className="flex items-center text-blue-600 hover:text-blue-700 mb-4 transition-all">
              <ChevronRight className="w-5 h-5 rotate-180" />
              <span className="ml-2 font-semibold">Back to Courses</span>
            </button>
            <h3 className="text-lg font-bold mb-2">Course Structure</h3>
            <p className="text-sm text-gray-600">Organize your modules and lessons</p>
          </div>

          <div className="p-6">
            <div className="space-y-3">
              {courseData.modules.map((module, idx) => (
                <div 
                  key={module.id}
                  onClick={() => setCurrentModule(idx)}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                    currentModule === idx 
                      ? 'bg-blue-50 border-blue-500 shadow-md' 
                      : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <p className="font-semibold text-sm">{module.title}</p>
                    {currentModule === idx && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span>{module.lessons} lessons</span>
                    <span>{module.duration}</span>
                  </div>
                  {module.segments.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <p className="text-xs text-gray-500">{module.segments.length} video segments</p>
                    </div>
                  )}
                </div>
              ))}
              
              <button 
                onClick={handleAddModule}
                className="w-full p-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-600 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center font-semibold"
              >
                <Plus className="w-5 h-5 mr-2" />
                Add Module
              </button>
            </div>
          </div>
        </div>

        {/* Main Editor Area */}
        <div className="flex-1 overflow-auto">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 p-6 sticky top-0 z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex-1">
                <input 
                  type="text" 
                  value={courseData.title}
                  onChange={(e) => setCourseData({ ...courseData, title: e.target.value })}
                  className="text-3xl font-bold border-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 w-full"
                />
                <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                  <span>Last edited {courseData.lastEdited}</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    courseData.status === 'published' 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {courseData.status}
                  </span>
                </div>
              </div>
              <div className="flex space-x-3">
                <button 
                  onClick={() => setPreviewMode(!previewMode)}
                  className="px-6 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 font-semibold flex items-center transition-all"
                >
                  <Eye className="w-5 h-5 mr-2" />
                  Preview
                </button>
                <button className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold flex items-center transition-all shadow-lg">
                  <Save className="w-5 h-5 mr-2" />
                  Save Changes
                </button>
                <button className="px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 font-semibold flex items-center transition-all shadow-lg">
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Publish Course
                </button>
              </div>
            </div>
          </div>

          <div className="p-8">
            {/* Micro-Video Editor - KEY DIFFERENTIATOR */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border-2 border-blue-200 mb-6">
              <div className="flex items-center mb-6">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Zap className="w-8 h-8 text-white" />
                </div>
                <div className="ml-4 flex-1">
                  <h3 className="text-2xl font-bold">Micro-Video Editor</h3>
                  <p className="text-sm text-gray-600 mt-1">Update specific segments without re-recording the entire video</p>
                </div>
                <div className="flex items-center space-x-2 bg-blue-50 px-4 py-2 rounded-lg">
                  <Info className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-semibold text-blue-700">Beta Feature</span>
                </div>
              </div>

              {/* Video Preview */}
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl mb-6 aspect-video flex items-center justify-center relative overflow-hidden shadow-xl">
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                
                {/* Play Button */}
                <button 
                  onClick={() => setIsPlaying(!isPlaying)}
                  className={`w-20 h-20 bg-white rounded-full flex items-center justify-center hover:scale-110 transition-all shadow-2xl relative z-10 ${isPlaying ? 'bg-opacity-90' : 'bg-opacity-100'}`}
                >
                  {isPlaying ? (
                    <div className="w-8 h-8 flex space-x-1">
                      <div className="w-2 bg-blue-600 rounded"></div>
                      <div className="w-2 bg-blue-600 rounded"></div>
                    </div>
                  ) : (
                    <Play className="w-10 h-10 text-blue-600 ml-1" />
                  )}
                </button>

                {/* Video Controls */}
                <div className="absolute bottom-0 left-0 right-0 p-6 z-10">
                  <div className="flex items-center justify-between text-white mb-3">
                    <span className="text-sm font-semibold">
                      {currentSegment ? currentSegment.name : 'No segment selected'}
                    </span>
                    <span className="text-sm">{currentModuleData.duration}</span>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="w-full bg-white/30 rounded-full h-1.5 mb-3 cursor-pointer">
                    <div className="bg-white h-1.5 rounded-full transition-all" style={{width: '35%'}}></div>
                  </div>

                  {/* Segment Markers */}
                  <div className="flex space-x-1">
                    {currentModuleData.segments.map((segment, idx) => (
                      <div 
                        key={segment.id}
                        className={`flex-1 h-1 rounded ${
                          idx === selectedSegment ? 'bg-blue-400' : 'bg-white/50'
                        }`}
                      ></div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Video Segments Timeline */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="font-bold text-lg">Video Segments</p>
                    <p className="text-sm text-gray-600">Click a segment to edit or replace it individually</p>
                  </div>
                  <button 
                    onClick={handleAddSegment}
                    className="px-5 py-2.5 bg-green-500 text-white rounded-xl hover:bg-green-600 font-semibold flex items-center transition-all shadow-lg"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    Add Segment
                  </button>
                </div>

                {currentModuleData.segments.length > 0 ? (
                  <div className="grid grid-cols-3 gap-4">
                    {currentModuleData.segments.map((segment, idx) => (
                      <div 
                        key={segment.id}
                        onClick={() => setSelectedSegment(idx)}
                        className={`p-5 rounded-xl cursor-pointer transition-all ${
                          idx === selectedSegment 
                            ? 'bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-500 shadow-lg' 
                            : 'bg-gray-50 border-2 border-gray-200 hover:border-blue-300 hover:shadow-md'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold ${
                            idx === selectedSegment ? 'bg-blue-500' : 'bg-gray-400'
                          }`}>
                            {idx + 1}
                          </div>
                          <div className="flex space-x-1">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReplaceSegment(segment.id);
                              }}
                              className="p-2 bg-white rounded-lg hover:bg-blue-50 shadow transition-all"
                            >
                              <Edit className="w-4 h-4 text-blue-600" />
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteSegment(segment.id);
                              }}
                              className="p-2 bg-white rounded-lg hover:bg-red-50 shadow transition-all"
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </button>
                          </div>
                        </div>
                        
                        <p className="font-bold mb-1 text-sm">{segment.name}</p>
                        <div className="space-y-1 text-xs text-gray-600">
                          <p className="flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            {segment.startTime} - {segment.endTime}
                          </p>
                          <p className="flex items-center">
                            <Video className="w-3 h-3 mr-1" />
                            {segment.size}
                          </p>
                        </div>
                        
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                            segment.status === 'active' 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {segment.status}
                          </span>
                          <p className="text-xs text-gray-500 mt-2">Edited {segment.lastEdited}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                    <Video className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h4 className="font-bold text-lg mb-2">No segments yet</h4>
                    <p className="text-sm text-gray-600 mb-4">Start by adding your first video segment</p>
                    <button 
                      onClick={handleAddSegment}
                      className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold"
                    >
                      Add First Segment
                    </button>
                  </div>
                )}
              </div>

              {/* Version History */}
              <div className="border-t border-gray-200 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <RotateCcw className="w-5 h-5 text-gray-600 mr-2" />
                    <p className="font-bold text-lg">Version History</p>
                  </div>
                  <button 
                    onClick={() => setShowVersions(!showVersions)}
                    className="text-sm text-blue-600 hover:text-blue-700 font-semibold flex items-center"
                  >
                    {showVersions ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
                    {showVersions ? 'Hide' : 'Show'} All Versions
                  </button>
                </div>

                <div className="space-y-3">
                  {versions.slice(0, showVersions ? versions.length : 2).map((version) => (
                    <div 
                      key={version.id}
                      className={`flex items-center justify-between p-4 rounded-xl transition-all ${
                        version.isCurrent 
                          ? 'bg-blue-50 border-2 border-blue-500' 
                          : 'bg-gray-50 border-2 border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-1">
                          <p className="font-semibold">{version.name}</p>
                          {version.isCurrent && (
                            <span className="bg-blue-500 text-white px-2 py-0.5 rounded-full text-xs font-semibold">
                              Current
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-1">{version.changes}</p>
                        <div className="flex items-center space-x-3 text-xs text-gray-500">
                          <span>{version.timestamp}</span>
                          <span>•</span>
                          <span>by {version.author}</span>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        {!version.isCurrent && (
                          <button 
                            onClick={() => handleRestoreVersion(version.id)}
                            className="px-4 py-2 text-blue-600 hover:bg-blue-50 border border-blue-600 rounded-lg font-semibold transition-all"
                          >
                            Restore
                          </button>
                        )}
                        <button className="p-2 hover:bg-gray-100 rounded-lg transition-all">
                          <Download className="w-5 h-5 text-gray-600" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Google Drive Integration */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
                    <Folder className="w-8 h-8 text-white" />
                  </div>
                  <div className="ml-4">
                    <h3 className="text-2xl font-bold">Google Drive Integration</h3>
                    <p className="text-sm text-gray-600 mt-1">Store and manage your content externally</p>
                  </div>
                </div>
                {!driveConnected ? (
                  <button 
                    onClick={connectGoogleDrive}
                    className="px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 font-semibold flex items-center transition-all shadow-lg"
                  >
                    <Folder className="w-5 h-5 mr-2" />
                    Connect Drive
                  </button>
                ) : (
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center bg-green-50 px-4 py-2 rounded-lg">
                      <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                      <span className="text-sm font-semibold text-green-700">Connected</span>
                    </div>
                    <button className="p-2 hover:bg-gray-100 rounded-lg transition-all">
                      <Settings className="w-5 h-5 text-gray-600" />
                    </button>
                  </div>
                )}
              </div>

              {driveConnected ? (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <p className="font-semibold">Your Files</p>
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold flex items-center text-sm">
                      <Upload className="w-4 h-4 mr-2" />
                      Upload New
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-4">
                    {driveFiles.map((file) => (
                      <div 
                        key={file.id}
                        className="border-2 border-gray-200 rounded-xl p-4 hover:border-blue-500 hover:shadow-md transition-all cursor-pointer"
                      >
                        <div className="w-full aspect-square bg-gray-100 rounded-lg flex items-center justify-center mb-3">
                          {file.type === 'video' ? (
                            <Video className="w-8 h-8 text-gray-600" />
                          ) : (
                            <FileText className="w-8 h-8 text-gray-600" />
                          )}
                        </div>
                        <p className="text-sm font-semibold truncate mb-1">{file.name}</p>
                        <div className="flex items-center justify-between text-xs text-gray-600">
                          <span>{file.size}</span>
                          <button className="p-1 hover:bg-gray-100 rounded">
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                  <Folder className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h4 className="font-bold text-lg mb-2">Connect Your Google Drive</h4>
                  <p className="text-sm text-gray-600 mb-4 max-w-md mx-auto">
                    Store your video files in Google Drive to reduce costs and keep your content where you already manage it
                  </p>
                  <div className="flex items-center justify-center space-x-6 text-sm text-gray-600 mb-6">
                    <div className="flex items-center">
                      <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                      <span>No storage fees</span>
                    </div>
                    <div className="flex items-center">
                      <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                      <span>Easy migration</span>
                    </div>
                    <div className="flex items-center">
                      <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                      <span>Keep control</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-2xl font-bold">
                {segmentToReplace !== null ? 'Replace Video Segment' : 'Add New Video Segment'}
              </h3>
              <button 
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadProgress(0);
                  setSegmentToReplace(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              {uploadProgress === 0 ? (
                <>
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center mb-6 hover:border-blue-500 transition-all cursor-pointer">
                    <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h4 className="font-bold text-lg mb-2">Drop your video here</h4>
                    <p className="text-sm text-gray-600 mb-4">or click to browse</p>
                    <p className="text-xs text-gray-500">Supports MP4, MOV, AVI up to 500MB</p>
                  </div>

                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="block text-sm font-semibold mb-2">Segment Name</label>
                      <input 
                        type="text" 
                        placeholder="e.g., Welcome & Overview"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold mb-2">Start Time</label>
                        <input 
                          type="text" 
                          placeholder="0:00"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-2">Duration</label>
                        <input 
                          type="text" 
                          placeholder="2:30"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                    <div className="flex items-start">
                      <Info className="w-5 h-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-blue-900">
                        <p className="font-semibold mb-1">Micro-Video Tip</p>
                        <p>Upload only the segment you want to update. The system will seamlessly stitch it with existing segments during playback.</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex space-x-3">
                    <button 
                      onClick={() => {
                        setShowUploadModal(false);
                        setSegmentToReplace(null);
                      }}
                      className="flex-1 px-6 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 font-semibold transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleSegmentUpload}
                      className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold transition-all shadow-lg"
                    >
                      {segmentToReplace !== null ? 'Replace Segment' : 'Upload Segment'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="py-8">
                  <div className="text-center mb-6">
                    <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Upload className="w-10 h-10 text-blue-600" />
                    </div>
                    <h4 className="font-bold text-xl mb-2">Uploading...</h4>
                    <p className="text-gray-600">Processing your video segment</p>
                  </div>

                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-semibold">Progress</span>
                      <span className="font-semibold text-blue-600">{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-300"
                        style={{width: `${uploadProgress}%`}}
                      ></div>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center text-gray-600">
                      <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                      <span>Video uploaded successfully</span>
                    </div>
                    <div className="flex items-center text-gray-600">
                      <div className="w-5 h-5 mr-2">
                        {uploadProgress >= 50 ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : (
                          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        )}
                      </div>
                      <span>Processing video...</span>
                    </div>
                    <div className="flex items-center text-gray-400">
                      <div className="w-5 h-5 mr-2">
                        <div className="w-5 h-5 border-2 border-gray-300 rounded-full"></div>
                      </div>
                      <span>Stitching segments...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Preview Mode Modal */}
      {previewMode && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
          <div className="w-full max-w-6xl mx-4">
            <div className="flex items-center justify-between mb-4 text-white">
              <h3 className="text-2xl font-bold">Course Preview</h3>
              <button 
                onClick={() => setPreviewMode(false)}
                className="p-2 hover:bg-white hover:bg-opacity-10 rounded-lg transition-all"
              >
                <X className="w-8 h-8" />
              </button>
            </div>
            
            <div className="bg-black rounded-2xl overflow-hidden">
              <div className="aspect-video bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
                <button className="w-24 h-24 bg-white bg-opacity-90 rounded-full flex items-center justify-center hover:scale-110 transition-all">
                  <Play className="w-12 h-12 text-blue-600 ml-2" />
                </button>
              </div>
              
              <div className="p-6 bg-gray-900">
                <h4 className="text-white font-bold text-lg mb-2">{courseData.title}</h4>
                <p className="text-gray-400 text-sm mb-4">{courseData.description}</p>
                
                <div className="flex items-center space-x-4 text-sm text-gray-400">
                  <span className="flex items-center">
                    <Video className="w-4 h-4 mr-2" />
                    {courseData.modules.length} modules
                  </span>
                  <span>•</span>
                  <span className="flex items-center">
                    <Clock className="w-4 h-4 mr-2" />
                    {courseData.modules.reduce((acc, m) => acc + parseInt(m.duration), 0)} total
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoursifyMicroVideoEditor;