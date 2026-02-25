'use client'

import React, { useState, useEffect } from 'react';
import { 
  Play, Users, Plus, Clock, Video, Edit, X, Eye, Filter, Grid, List, Star, TrendingUp, TrendingDown,
  Download, Share2, Copy, Trash2, Archive, MoreVertical, BookOpen, CheckCircle, Award, Mail, Link2, Globe,
  Search, BarChart3, Folder, AlertCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getPreferences, getCourseRecommendationScore } from '@/lib/preference-loop';
import type { LearnerPreferences } from '@/lib/preference-loop';

interface MyCoursesProps {
  setCurrentView: (view: string) => void;
}

type CourseId = string | number;

interface CourseRow {
  id: CourseId;
  title: string;
  description: string;
  thumbnail: string;
  modules: number;
  lessons: number;
  learners: number;
  enrolled: number;
  completion: number;
  avgRating: number;
  totalRatings: number;
  status: 'draft' | 'published' | 'archived';
  category: string;
  duration: string;
  lastUpdated: string;
  createdDate: string;
  views: number;
  trend: string;
  trendValue: number;
  hasQuiz: boolean;
  hasCertificate: boolean;
  language: string;
  level: string;
  tags: string[];
}

const formatCourseDate = (dateStr: string) => {
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

const MyCourses: React.FC<MyCoursesProps> = ({ setCurrentView }) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourses, setSelectedCourses] = useState<CourseId[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState<CourseRow | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [courseToShare, setCourseToShare] = useState<CourseRow | null>(null);
  const [shareCopyFeedback, setShareCopyFeedback] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<CourseId | null>(null);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [configMissing, setConfigMissing] = useState(false);
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [preferences, setPreferences] = useState<LearnerPreferences | null>(null);
  const [contentMixByCourse, setContentMixByCourse] = useState<Record<string, { video: number; reading: number; quiz: number }>>({});

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? undefined);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? undefined);
    });
    return () => { subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!userId) {
      setPreferences(null);
      return;
    }
    getPreferences(userId).then(setPreferences);
  }, [userId]);

  useEffect(() => {
    const fetchContentMix = async () => {
      const { data: items } = await supabase.from('content_items').select('content_type, lesson_id');
      if (!items?.length) return;
      const lessonIds = Array.from(new Set(items.map((i: { lesson_id: string }) => i.lesson_id)));
      const { data: lessons } = await supabase.from('lessons').select('id, module_id').in('id', lessonIds);
      if (!lessons?.length) return;
      const moduleIds = Array.from(new Set(lessons.map((l: { module_id: string }) => l.module_id)));
      const { data: modules } = await supabase.from('modules').select('id, course_id').in('id', moduleIds);
      if (!modules?.length) return;
      const lessonToCourse: Record<string, string> = {};
      lessons.forEach((l: { id: string; module_id: string }) => {
        const m = modules.find((x: { id: string }) => x.id === l.module_id);
        if (m) lessonToCourse[l.id] = (m as { course_id: string }).course_id;
      });
      const mix: Record<string, { video: number; reading: number; quiz: number }> = {};
      items.forEach((i: { content_type: string; lesson_id: string }) => {
        const courseId = lessonToCourse[i.lesson_id];
        if (!courseId) return;
        if (!mix[courseId]) mix[courseId] = { video: 0, reading: 0, quiz: 0 };
        if (i.content_type === 'video') mix[courseId].video++;
        else if (i.content_type === 'quiz' || i.content_type === 'form') mix[courseId].quiz++;
        else mix[courseId].reading++;
      });
      setContentMixByCourse(mix);
    };
    fetchContentMix();
  }, []);

  useEffect(() => {
    const fetchCourses = async () => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!url) {
        setCourses([]);
        setConfigMissing(true);
        setLoading(false);
        return;
      }
      setConfigMissing(false);
      try {
        const { data, error } = await supabase.from('courses').select('id, title, description, status, created_at, updated_at').order('updated_at', { ascending: false });
        if (error) throw error;
        const courseList = data || [];
        const courseIds = courseList.map((c: { id: string }) => c.id);
        const [modulesRes, enrollmentsRes] = await Promise.all([
          supabase.from('modules').select('id, course_id').in('course_id', courseIds),
          supabase.from('enrollments').select('course_id, completed_at, progress_percentage').in('course_id', courseIds)
        ]);
        const modules = modulesRes.data ?? [];
        const enrollments = enrollmentsRes.data ?? [];
        const moduleIds = modules.map((m: { id: string }) => m.id);
        const { data: lessonsData } = moduleIds.length
          ? await supabase.from('lessons').select('id, module_id').in('module_id', moduleIds)
          : { data: [] };
        const lessons = lessonsData ?? [];
        const modulesByCourse: Record<string, number> = {};
        const lessonsByCourse: Record<string, number> = {};
        modules.forEach((m: { id: string; course_id: string }) => {
          modulesByCourse[m.course_id] = (modulesByCourse[m.course_id] ?? 0) + 1;
        });
        lessons.forEach((l: { module_id: string }) => {
          const mod = modules.find((x: { id: string }) => x.id === l.module_id);
          if (mod) {
            const cid = (mod as { course_id: string }).course_id;
            lessonsByCourse[cid] = (lessonsByCourse[cid] ?? 0) + 1;
          }
        });
        const enrolledByCourse: Record<string, number> = {};
        const completedByCourse: Record<string, number> = {};
        enrollments.forEach((e: { course_id: string; completed_at: string | null }) => {
          enrolledByCourse[e.course_id] = (enrolledByCourse[e.course_id] ?? 0) + 1;
          if (e.completed_at) completedByCourse[e.course_id] = (completedByCourse[e.course_id] ?? 0) + 1;
        });
        const avgCompletionByCourse: Record<string, number> = {};
        enrollments.forEach((e: { course_id: string; progress_percentage?: number }) => {
          if (!avgCompletionByCourse[e.course_id]) avgCompletionByCourse[e.course_id] = 0;
          avgCompletionByCourse[e.course_id] += e.progress_percentage ?? 0;
        });
        const enrollCount: Record<string, number> = {};
        enrollments.forEach((e: { course_id: string }) => {
          enrollCount[e.course_id] = (enrollCount[e.course_id] ?? 0) + 1;
        });
        Object.keys(avgCompletionByCourse).forEach((cid) => {
          const n = enrollCount[cid] ?? 1;
          avgCompletionByCourse[cid] = Math.round(avgCompletionByCourse[cid] / n);
        });
        setCourses(courseList.map((c: { id: string; title: string; description: string | null; status: string; created_at: string; updated_at: string }) => ({
          id: c.id,
          title: c.title,
          description: c.description || '',
          thumbnail: 'blue',
          modules: modulesByCourse[c.id] ?? 0,
          lessons: lessonsByCourse[c.id] ?? 0,
          learners: enrolledByCourse[c.id] ?? 0,
          enrolled: enrolledByCourse[c.id] ?? 0,
          completion: avgCompletionByCourse[c.id] ?? 0,
          avgRating: 0,
          totalRatings: 0,
          status: c.status as 'draft' | 'published' | 'archived',
          category: 'General',
          duration: '0m',
          lastUpdated: formatCourseDate(c.updated_at),
          createdDate: formatCourseDate(c.created_at),
          views: 0,
          trend: 'up',
          trendValue: 0,
          hasQuiz: false,
          hasCertificate: false,
          language: 'English',
          level: 'Beginner',
          tags: []
        })));
      } catch {
        setCourses([]);
      } finally {
        setLoading(false);
      }
    };
    fetchCourses();
  }, []);

  const thumbnailColors: Record<string, string> = {
    blue: 'from-blue-400 to-blue-500',
    purple: 'from-purple-400 to-purple-500',
    green: 'from-green-400 to-green-500',
    orange: 'from-orange-400 to-orange-500',
    pink: 'from-pink-400 to-pink-500',
    indigo: 'from-indigo-400 to-indigo-500'
  };

  // Filter and sort courses
  const getFilteredCourses = () => {
    let filtered = courses;

    if (selectedFilter !== 'all') {
      filtered = filtered.filter(c => c.status === selectedFilter);
    }

    if (searchQuery) {
      filtered = filtered.filter(c => 
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    switch(sortBy) {
      case 'name':
        filtered.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'learners':
        filtered.sort((a, b) => b.learners - a.learners);
        break;
      case 'completion':
        filtered.sort((a, b) => b.completion - a.completion);
        break;
      case 'recommended':
        if (preferences) {
          filtered.sort((a, b) => {
            const mixA = contentMixByCourse[String(a.id)] ?? { video: 1, reading: 0, quiz: 0 };
            const mixB = contentMixByCourse[String(b.id)] ?? { video: 1, reading: 0, quiz: 0 };
            return getCourseRecommendationScore(mixB, preferences) - getCourseRecommendationScore(mixA, preferences);
          });
        }
        break;
      case 'recent':
      default:
        break;
    }

    return filtered;
  };

  const filteredCourses = getFilteredCourses();

  const toggleCourseSelection = (courseId: CourseId) => {
    setSelectedCourses(prev => 
      prev.includes(courseId) 
        ? prev.filter(id => id !== courseId)
        : [...prev, courseId]
    );
  };

  const handleDeleteCourse = (course: CourseRow) => {
    setCourseToDelete(course);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!courseToDelete) return;
    const id = courseToDelete.id;
    if (typeof id === 'string') {
      try {
        const { error } = await supabase.from('courses').delete().eq('id', id);
        if (error) throw error;
      } catch {
        setShowDeleteModal(false);
        setCourseToDelete(null);
        return;
      }
    }
    setCourses(courses.filter(c => c.id !== id));
    setShowDeleteModal(false);
    setCourseToDelete(null);
    setSelectedCourses(prev => prev.filter(x => x !== id));
  };

  const handleShareCourse = (course: CourseRow) => {
    setCourseToShare(course);
    setShowShareModal(true);
  };

  const handleDuplicateCourse = async (course: CourseRow) => {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (typeof course.id !== 'string' || !userId) {
      setCourses([{ ...course, id: `copy-${Date.now()}`, title: `${course.title} (Copy)`, status: 'draft', learners: 0, enrolled: 0, views: 0, lastUpdated: 'Just now', createdDate: new Date().toLocaleDateString() }, ...courses]);
      return;
    }
    try {
      const { data: newRow, error } = await (supabase as any).from('courses').insert({
        title: `${course.title} (Copy)`,
        description: course.description,
        status: 'draft',
        created_by: userId
      }).select('id, title, description, status, created_at, updated_at').single();
      if (error) throw error;
      const newCourse: CourseRow = {
        id: (newRow as { id: string }).id,
        title: (newRow as { title: string }).title,
        description: (newRow as { description: string | null })?.description ?? '',
        thumbnail: 'blue',
        modules: 0,
        lessons: 0,
        learners: 0,
        enrolled: 0,
        completion: 0,
        avgRating: 0,
        totalRatings: 0,
        status: 'draft',
        category: 'General',
        duration: '0m',
        lastUpdated: formatCourseDate((newRow as { updated_at: string }).updated_at),
        createdDate: formatCourseDate((newRow as { created_at: string }).created_at),
        views: 0,
        trend: 'up',
        trendValue: 0,
        hasQuiz: false,
        hasCertificate: false,
        language: 'English',
        level: 'Beginner',
        tags: []
      };
      setCourses([newCourse, ...courses]);
    } catch {
      setCourses([{ ...course, id: `copy-${Date.now()}`, title: `${course.title} (Copy)`, status: 'draft', learners: 0, enrolled: 0, views: 0, lastUpdated: 'Just now', createdDate: new Date().toLocaleDateString() }, ...courses]);
    }
  };

  const handleArchiveCourse = async (courseId: CourseId) => {
    if (typeof courseId === 'string') {
      try {
        const { error } = await (supabase as any).from('courses').update({ status: 'archived', updated_at: new Date().toISOString() }).eq('id', courseId);
        if (error) throw error;
      } catch {
        return;
      }
    }
    setCourses(courses.map(c => 
      c.id === courseId ? { ...c, status: 'archived' } : c
    ));
  };

  const statsData = {
    total: courses.length,
    published: courses.filter(c => c.status === 'published').length,
    draft: courses.filter(c => c.status === 'draft').length,
    totalLearners: courses.reduce((acc, c) => acc + c.learners, 0),
    avgCompletion: courses.length ? Math.round(courses.reduce((acc, c) => acc + c.completion, 0) / courses.length) : 0
  };

  return (
    <div>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6 sticky top-0 z-20">
        {configMissing && (
          <div className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
            Configure Supabase (see BACKEND_SETUP.md) to load and save courses.
          </div>
        )}
        {!configMissing && !loading && courses.length === 0 && (
          <div className="mb-4 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
            No courses yet. Create your first course below.
          </div>
        )}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Courses</h1>
            <p className="text-gray-600 mt-1">Manage and organize your learning content</p>
          </div>
          <button 
            onClick={() => setCurrentView('create')}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold flex items-center shadow-lg transition-all"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create New Course
          </button>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-5 gap-4 mb-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200">
            <p className="text-sm text-blue-600 font-semibold mb-1">Total Courses</p>
            <p className="text-3xl font-bold text-blue-700">{statsData.total}</p>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl border border-green-200">
            <p className="text-sm text-green-600 font-semibold mb-1">Published</p>
            <p className="text-3xl font-bold text-green-700">{statsData.published}</p>
          </div>
          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-4 rounded-xl border border-yellow-200">
            <p className="text-sm text-yellow-600 font-semibold mb-1">Drafts</p>
            <p className="text-3xl font-bold text-yellow-700">{statsData.draft}</p>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200">
            <p className="text-sm text-purple-600 font-semibold mb-1">Total Learners</p>
            <p className="text-3xl font-bold text-purple-700">{statsData.totalLearners}</p>
          </div>
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-xl border border-orange-200">
            <p className="text-sm text-orange-600 font-semibold mb-1">Avg. Completion</p>
            <p className="text-3xl font-bold text-orange-700">{statsData.avgCompletion}%</p>
          </div>
        </div>

        {/* Filters and Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => setSelectedFilter('all')}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                selectedFilter === 'all' 
                  ? 'bg-blue-600 text-white shadow-lg' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All ({courses.length})
            </button>
            <button 
              onClick={() => setSelectedFilter('published')}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                selectedFilter === 'published' 
                  ? 'bg-green-600 text-white shadow-lg' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Published ({courses.filter(c => c.status === 'published').length})
            </button>
            <button 
              onClick={() => setSelectedFilter('draft')}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                selectedFilter === 'draft' 
                  ? 'bg-yellow-600 text-white shadow-lg' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Drafts ({courses.filter(c => c.status === 'draft').length})
            </button>
          </div>

          <div className="flex items-center space-x-3">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search courses..." 
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
              <option value="recent">Most Recent</option>
              <option value="recommended">Recommended for you</option>
              <option value="name">Name (A-Z)</option>
              <option value="learners">Most Learners</option>
              <option value="completion">Highest Completion</option>
            </select>

            <div className="flex bg-gray-100 rounded-lg p-1">
              <button 
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded transition-all ${
                  viewMode === 'grid' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
                }`}
              >
                <Grid className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={`p-2 rounded transition-all ${
                  viewMode === 'list' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
                }`}
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Courses Grid/List */}
      <div className="p-8">
        {filteredCourses.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-gray-300">
            <Folder className="w-20 h-20 text-gray-400 mx-auto mb-4" />
            <h3 className="text-2xl font-bold mb-2">No courses found</h3>
            <p className="text-gray-600 mb-6">
              {searchQuery 
                ? `No courses match "${searchQuery}"`
                : `No ${selectedFilter} courses yet`
              }
            </p>
            <button 
              onClick={() => setCurrentView('create')}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold"
            >
              Create Your First Course
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCourses.map((course) => (
              <div 
                key={course.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-xl transition-all group"
              >
                {/* Thumbnail */}
                <div className={`bg-gradient-to-br ${thumbnailColors[course.thumbnail]} h-48 flex items-center justify-center relative`}>
                  <Video className="w-20 h-20 text-white opacity-80" />
                  
                  <span className={`absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-semibold ${
                    course.status === 'published' ? 'bg-green-500 text-white' :
                    course.status === 'draft' ? 'bg-yellow-500 text-white' :
                    'bg-gray-500 text-white'
                  }`}>
                    {course.status.charAt(0).toUpperCase() + course.status.slice(1)}
                  </span>

                  {/* Quick Actions */}
                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all flex space-x-2">
                    <button 
                      onClick={() => handleShareCourse(course)}
                      className="p-2 bg-white rounded-lg shadow-lg hover:bg-gray-50"
                    >
                      <Share2 className="w-4 h-4 text-gray-700" />
                    </button>
                    <div className="relative">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveDropdown(activeDropdown === course.id ? null : course.id);
                        }}
                        className="p-2 bg-white rounded-lg shadow-lg hover:bg-gray-50"
                      >
                        <MoreVertical className="w-4 h-4 text-gray-700" />
                      </button>

                      {activeDropdown === course.id && (
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-2xl border border-gray-200 py-2 z-30">
                          <button 
                            onClick={() => {
                              handleDuplicateCourse(course);
                              setActiveDropdown(null);
                            }}
                            className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center text-sm"
                          >
                            <Copy className="w-4 h-4 mr-2" />
                            Duplicate
                          </button>
                          <button 
                            onClick={() => {
                              handleArchiveCourse(course.id);
                              setActiveDropdown(null);
                            }}
                            className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center text-sm"
                          >
                            <Archive className="w-4 h-4 mr-2" />
                            Archive
                          </button>
                          <button className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center text-sm">
                            <Download className="w-4 h-4 mr-2" />
                            Export
                          </button>
                          <hr className="my-2" />
                          <button 
                            onClick={() => {
                              handleDeleteCourse(course);
                              setActiveDropdown(null);
                            }}
                            className="w-full px-4 py-2 text-left hover:bg-red-50 flex items-center text-sm text-red-600"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6">
                  <div className="mb-4">
                    <h3 className="font-bold text-lg mb-2 line-clamp-1">{course.title}</h3>
                    <p className="text-sm text-gray-600 line-clamp-2">{course.description}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <BookOpen className="w-4 h-4 mr-2" />
                      <span>{course.modules} modules</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <Users className="w-4 h-4 mr-2" />
                      <span>{course.learners} learners</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <Clock className="w-4 h-4 mr-2" />
                      <span>{course.duration}</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <Star className="w-4 h-4 mr-1 text-yellow-500 fill-yellow-500" />
                      <span className="font-semibold">{course.avgRating || 'N/A'}</span>
                      {course.totalRatings > 0 && (
                        <span className="text-gray-600 ml-1">({course.totalRatings})</span>
                      )}
                    </div>
                  </div>

                  {course.completion > 0 && (
                    <div className="mb-4">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-600">Avg. Completion</span>
                        <span className="font-semibold flex items-center">
                          {course.completion}%
                          {course.trend === 'up' ? (
                            <TrendingUp className="w-4 h-4 ml-1 text-green-600" />
                          ) : (
                            <TrendingDown className="w-4 h-4 ml-1 text-red-600" />
                          )}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all ${
                            course.completion >= 80 ? 'bg-green-500' :
                            course.completion >= 50 ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}
                          style={{width: `${course.completion}%`}}
                        ></div>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 mb-4">
                    {course.tags.slice(0, 2).map((tag, idx) => (
                      <span key={idx} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                        {tag}
                      </span>
                    ))}
                    {course.tags.length > 2 && (
                      <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                        +{course.tags.length - 2}
                      </span>
                    )}
                  </div>

                  <div className="flex space-x-2">
                    <button 
                      onClick={() => setCurrentView('create')}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold flex items-center justify-center transition-all"
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </button>
                    <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all">
                      <Eye className="w-5 h-5 text-gray-600" />
                    </button>
                    <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all">
                      <BarChart3 className="w-5 h-5 text-gray-600" />
                    </button>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
                    <span>Updated {course.lastUpdated}</span>
                    <div className="flex items-center space-x-2">
                      {course.hasQuiz && (
                        <div className="flex items-center text-blue-600" title="Has Quiz">
                          <CheckCircle className="w-4 h-4" />
                        </div>
                      )}
                      {course.hasCertificate && (
                        <div className="flex items-center text-purple-600" title="Certificate Available">
                          <Award className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          // List View
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left">
                      <input 
                        type="checkbox" 
                        className="rounded border-gray-300"
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCourses(filteredCourses.map(c => c.id));
                          } else {
                            setSelectedCourses([]);
                          }
                        }}
                      />
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Course</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Status</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Learners</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Completion</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Rating</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Last Updated</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredCourses.map((course) => (
                    <tr key={course.id} className="hover:bg-gray-50 transition-all">
                      <td className="px-6 py-4">
                        <input 
                          type="checkbox"
                          checked={selectedCourses.includes(course.id)}
                          onChange={() => toggleCourseSelection(course.id)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className={`w-12 h-12 bg-gradient-to-br ${thumbnailColors[course.thumbnail]} rounded-lg flex items-center justify-center mr-4`}>
                            <Video className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <p className="font-semibold text-sm">{course.title}</p>
                            <p className="text-xs text-gray-600">{course.modules} modules • {course.duration}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          course.status === 'published' ? 'bg-green-100 text-green-700' :
                          course.status === 'draft' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {course.status.charAt(0).toUpperCase() + course.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <Users className="w-4 h-4 mr-2 text-gray-600" />
                          <span className="font-semibold">{course.learners}</span>
                          <span className="text-gray-600 text-sm ml-1">/ {course.enrolled}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${
                                course.completion >= 80 ? 'bg-green-500' :
                                course.completion >= 50 ? 'bg-yellow-500' :
                                'bg-red-500'
                              }`}
                              style={{width: `${course.completion}%`}}
                            ></div>
                          </div>
                          <span className="text-sm font-semibold">{course.completion}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 mr-1" />
                          <span className="font-semibold">{course.avgRating || 'N/A'}</span>
                          {course.totalRatings > 0 && (
                            <span className="text-gray-600 text-sm ml-1">({course.totalRatings})</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-600">{course.lastUpdated}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <button 
                            onClick={() => setCurrentView('create')}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-all" 
                            title="Edit"
                          >
                            <Edit className="w-4 h-4 text-gray-600" />
                          </button>
                          <button className="p-2 hover:bg-gray-100 rounded-lg transition-all" title="View">
                            <Eye className="w-4 h-4 text-gray-600" />
                          </button>
                          <button className="p-2 hover:bg-gray-100 rounded-lg transition-all" title="Analytics">
                            <BarChart3 className="w-4 h-4 text-gray-600" />
                          </button>
                          <div className="relative">
                            <button 
                              onClick={() => setActiveDropdown(activeDropdown === course.id ? null : course.id)}
                              className="p-2 hover:bg-gray-100 rounded-lg transition-all"
                            >
                              <MoreVertical className="w-4 h-4 text-gray-600" />
                            </button>
                            {activeDropdown === course.id && (
                              <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-2xl border border-gray-200 py-2 z-30">
                                <button 
                                  onClick={() => {
                                    handleShareCourse(course);
                                    setActiveDropdown(null);
                                  }}
                                  className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center text-sm"
                                >
                                  <Share2 className="w-4 h-4 mr-2" />
                                  Share
                                </button>
                                <button 
                                  onClick={() => {
                                    handleDuplicateCourse(course);
                                    setActiveDropdown(null);
                                  }}
                                  className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center text-sm"
                                >
                                  <Copy className="w-4 h-4 mr-2" />
                                  Duplicate
                                </button>
                                <button className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center text-sm">
                                  <Download className="w-4 h-4 mr-2" />
                                  Export
                                </button>
                                <hr className="my-2" />
                                <button 
                                  onClick={() => {
                                    handleDeleteCourse(course);
                                    setActiveDropdown(null);
                                  }}
                                  className="w-full px-4 py-2 text-left hover:bg-red-50 flex items-center text-sm text-red-600"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Bulk Actions Bar */}
        {selectedCourses.length > 0 && (
          <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center space-x-4 z-50">
            <span className="font-semibold">{selectedCourses.length} selected</span>
            <div className="w-px h-6 bg-gray-600"></div>
            <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold flex items-center transition-all">
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </button>
            <button className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold flex items-center transition-all">
              <Archive className="w-4 h-4 mr-2" />
              Archive
            </button>
            <button className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-semibold flex items-center transition-all">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </button>
            <button 
              onClick={() => setSelectedCourses([])}
              className="p-2 hover:bg-gray-700 rounded-lg transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && courseToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-2xl font-bold text-center mb-2">Delete Course?</h3>
              <p className="text-gray-600 text-center">
                Are you sure you want to delete <span className="font-semibold">"{courseToDelete.title}"</span>? This action cannot be undone.
              </p>
            </div>
            <div className="p-6">
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                <p className="text-sm text-red-900">
                  <span className="font-semibold">Warning:</span> Deleting this course will also remove:
                </p>
                <ul className="list-disc list-inside text-sm text-red-800 mt-2 space-y-1">
                  <li>All {courseToDelete.learners} learner enrollments</li>
                  <li>Progress data and completion records</li>
                  <li>All course content and videos</li>
                  <li>{courseToDelete.totalRatings} ratings and feedback</li>
                </ul>
              </div>
              <div className="flex space-x-3">
                <button 
                  onClick={() => {
                    setShowDeleteModal(false);
                    setCourseToDelete(null);
                  }}
                  className="flex-1 px-6 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 font-semibold transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmDelete}
                  className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 font-semibold transition-all shadow-lg"
                >
                  Delete Course
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && courseToShare && (() => {
        const baseUrl = typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_APP_URL || window.location.origin) : '';
        const courseUrl = `${baseUrl}/course/${courseToShare.id}`;
        const courseTitle = courseToShare.title || 'Course';

        const handleCopy = async () => {
          try {
            await navigator.clipboard.writeText(courseUrl);
            setShareCopyFeedback(true);
            setTimeout(() => setShareCopyFeedback(false), 2000);
          } catch {
            // fallback for older browsers
            const input = document.createElement('input');
            input.value = courseUrl;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            setShareCopyFeedback(true);
            setTimeout(() => setShareCopyFeedback(false), 2000);
          }
        };

        const handleShareEmail = () => {
          const subject = encodeURIComponent(`Check out this course: ${courseTitle}`);
          const body = encodeURIComponent(`I thought you might like this course:\n\n${courseTitle}\n${courseUrl}`);
          window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
        };

        const handleShareSlack = () => {
          const text = encodeURIComponent(`${courseTitle}: ${courseUrl}`);
          window.open(`https://slack.com/share?text=${text}`, '_blank', 'noopener,noreferrer,width=600,height=400');
        };

        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-2xl font-bold">Share Course</h3>
                <button 
                  onClick={() => {
                    setShowShareModal(false);
                    setCourseToShare(null);
                    setShareCopyFeedback(false);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6">
                <div className="mb-6">
                  <p className="text-sm font-semibold mb-2">Course Link</p>
                  <div className="flex items-center space-x-2">
                    <input 
                      type="text" 
                      value={courseUrl}
                      readOnly
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
                    />
                    <button 
                      type="button"
                      onClick={handleCopy}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold flex items-center transition-all shrink-0"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      {shareCopyFeedback ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>

                <div className="mb-6">
                  <p className="text-sm font-semibold mb-3">Share via</p>
                  <div className="grid grid-cols-4 gap-3">
                    <button 
                      type="button"
                      onClick={handleShareEmail}
                      className="p-4 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all text-center"
                    >
                      <Mail className="w-6 h-6 mx-auto mb-2 text-gray-600" />
                      <p className="text-xs font-semibold">Email</p>
                    </button>
                    <button 
                      type="button"
                      onClick={handleCopy}
                      className="p-4 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all text-center"
                    >
                      <Link2 className="w-6 h-6 mx-auto mb-2 text-gray-600" />
                      <p className="text-xs font-semibold">Link</p>
                    </button>
                    <button 
                      type="button"
                      onClick={handleShareSlack}
                      className="p-4 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all text-center"
                    >
                      <Share2 className="w-6 h-6 mx-auto mb-2 text-gray-600" />
                      <p className="text-xs font-semibold">Slack</p>
                    </button>
                    <button 
                      type="button"
                      onClick={handleCopy}
                      className="p-4 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all text-center"
                    >
                      <Globe className="w-6 h-6 mx-auto mb-2 text-gray-600" />
                      <p className="text-xs font-semibold">Public</p>
                    </button>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <div className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-blue-900">
                      <p className="font-semibold mb-1">Course is Published</p>
                      <p>Learners can access this course immediately after enrolling.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default MyCourses;
