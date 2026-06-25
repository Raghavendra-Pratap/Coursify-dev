'use client';

import React, { useState, useEffect } from 'react';
import {
  Camera,
  MapPin,
  Calendar,
  Pencil,
  Home,
  User,
  BookOpen,
  Award,
  GraduationCap,
  Mail,
  Briefcase,
  Phone,
  Globe,
  CheckCircle,
  Play,
  Zap,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchJsonCached } from '@/lib/client-fetch-cache';

interface ProfileProps {
  setCurrentView: (view: string) => void;
}

type TabId = 'overview' | 'about' | 'courses' | 'achievements' | 'certificates';

interface ActivityItem {
  id: string;
  type: 'completed' | 'started' | 'certificate' | 'badge';
  title: string;
  timeAgo: string;
  meta?: string;
}

export default function Profile({ setCurrentView }: ProfileProps) {
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState('');
  const [organization, setOrganization] = useState('');
  const [location, setLocation] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [initials, setInitials] = useState('—');
  const [joinedAt, setJoinedAt] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editOrganization, setEditOrganization] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [stats, setStats] = useState({
    completed: 0,
    certificates: 0,
    badges: 0,
    streak: 0,
    rank: 0,
  });
  const [overallCompletion, setOverallCompletion] = useState(0);
  const [timeSpentHours, setTimeSpentHours] = useState(0);
  const [avgScore, setAvgScore] = useState(0);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [enrolledCourses, setEnrolledCourses] = useState<{ id: string; title: string; progress_percentage: number; completed_at: string | null }[]>([]);
  const [achievements, setAchievements] = useState<{ id: string; title: string; description: string; unlockedAt: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
        setLoading(false);
        return;
      }
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          setIsGuest(true);
          setLoading(false);
          return;
        }
        setIsGuest(false);
        const uid = session.user.id;
        setUserId(uid);
        const name = session.user.user_metadata?.full_name ?? session.user.user_metadata?.name ?? session.user.email?.split('@')[0] ?? 'User';
        const inits = name.split(/\s+/).map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
        setEmail(session.user.email ?? null);
        setInitials(inits);
        const { data: profileData } = await supabase.from('user_profiles').select('full_name, role, organization, location, avatar_url, created_at').eq('id', uid).maybeSingle();
        const profile = profileData as { full_name: string | null; role: string; organization: string | null; location: string | null; avatar_url: string | null; created_at: string } | null;
        const joinedDate = profile?.created_at ?? session.user.created_at;
        setJoinedAt(joinedDate ? new Date(joinedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null);
        setDisplayName((profile?.full_name ?? name) || '');
        setRole(profile?.role === 'admin' ? 'Admin' : profile?.role === 'instructor' ? 'Instructor' : 'Learner');
        setOrganization(profile?.organization ?? '');
        setLocation(profile?.location ?? '');
        setAvatarUrl(profile?.avatar_url ?? null);

        let enrollments: { id: string; course_id: string; progress_percentage: number; completed_at: string | null; enrolled_at: string }[] = [];
        let fromEnrolledApi = false;
        const { data: enrollmentsData } = await supabase
          .from('enrollments')
          .select('id, course_id, progress_percentage, completed_at, enrolled_at')
          .eq('user_id', uid);
        type EnrollmentRow = { id: string; course_id: string; progress_percentage: number; completed_at: string | null; enrolled_at: string };
        enrollments = (enrollmentsData ?? []) as EnrollmentRow[];
        if (enrollments.length === 0) {
          try {
            const { data } = await fetchJsonCached<{ courses?: { id: string; title: string; progress_percentage?: number; completed_at?: string | null }[] }>(
              'learning:enrolled',
              '/api/learning/enrolled'
            );
            const list = Array.isArray(data?.courses) ? data.courses : [];
            if (list.length > 0) {
              fromEnrolledApi = true;
              enrollments = list.map((c: { id: string; title: string; progress_percentage?: number; completed_at?: string | null }) => ({
                id: c.id,
                course_id: c.id,
                progress_percentage: c.progress_percentage ?? 0,
                completed_at: c.completed_at ?? null,
                enrolled_at: '',
              }));
              setEnrolledCourses(list.map((c: { id: string; title: string; progress_percentage?: number; completed_at?: string | null }) => ({
                id: c.id,
                title: c.title ?? 'Course',
                progress_percentage: c.progress_percentage ?? 0,
                completed_at: c.completed_at ?? null,
              })));
            }
          } catch {
            // keep enrollments []
          }
        }
        const completedCount = enrollments.filter((e) => e.completed_at).length;
        const totalProgress = enrollments.reduce((s, e) => s + (e.progress_percentage ?? 0), 0);
        const avgCompletion = enrollments.length ? Math.round(totalProgress / enrollments.length) : 0;
        setOverallCompletion(avgCompletion);
        setStats((s) => ({ ...s, completed: completedCount, certificates: completedCount, badges: 0, streak: 0, rank: 0 }));

        const enrollmentIds = enrollments.map((e) => e.id);
        let totalSeconds = 0;
        let scoreSum = 0;
        let scoreCount = 0;
        let activity: ActivityItem[] = [];
        if (fromEnrolledApi && enrollments.length > 0) {
          enrollments.slice(0, 5).forEach((e) => {
            const title = 'Course';
            if (e.completed_at) {
              activity.push({
                id: e.id,
                type: 'completed',
                title: `Completed ${title}`,
                timeAgo: formatTimeAgo(e.completed_at),
                meta: `Score: ${e.progress_percentage ?? 0}%`,
              });
            } else {
              activity.push({
                id: e.id,
                type: 'started',
                title: `Started ${title}`,
                timeAgo: 'Recently',
              });
            }
          });
        }
        let lessonsCompletedCount = 0;
        type ProgressRow = { completed_at: string | null; time_spent_seconds?: number; completed?: boolean };
        let progressRows: ProgressRow[] | null = null;

        if (enrollmentIds.length > 0 && !fromEnrolledApi) {
          const { data: pr } = await supabase
            .from('progress')
            .select('enrollment_id, completed, completed_at, time_spent_seconds')
            .in('enrollment_id', enrollmentIds)
            .order('completed_at', { ascending: false })
            .limit(500);
          progressRows = (pr ?? []) as ProgressRow[];
          progressRows.forEach((p) => {
            totalSeconds += p.time_spent_seconds ?? 0;
            if (p.completed) lessonsCompletedCount++;
          });

          try {
            const { data: quizAttempts } = await supabase.from('quiz_attempts').select('score').in('enrollment_id', enrollmentIds);
            quizAttempts?.forEach((a) => {
              scoreSum += (a as { score: number }).score;
              scoreCount++;
            });
          } catch {
            // quiz_attempts may not exist or RLS may block
          }

          const courseIdsForMap = Array.from(new Set(enrollments.map((e) => e.course_id)));
          const { data: courses } = await supabase.from('courses').select('id, title').in('id', courseIdsForMap);
          const courseMap = new Map((courses ?? []).map((c: { id: string; title: string }) => [c.id, c.title]));

          setEnrolledCourses(
            enrollments.map((e) => ({
              id: e.course_id,
              title: courseMap.get(e.course_id) ?? 'Course',
              progress_percentage: e.progress_percentage ?? 0,
              completed_at: e.completed_at ?? null,
            }))
          );

          enrollments.slice(0, 5).forEach((e) => {
            const title = courseMap.get(e.course_id) ?? 'Course';
            if (e.completed_at) {
              activity.push({
                id: e.id,
                type: 'completed',
                title: `Completed ${title}`,
                timeAgo: formatTimeAgo(e.completed_at),
                meta: `Score: ${e.progress_percentage ?? 0}%`,
              });
            } else {
              activity.push({
                id: e.id,
                type: 'started',
                title: `Started ${title}`,
                timeAgo: formatTimeAgo(e.enrolled_at),
              });
            }
          });
        }

        setTimeSpentHours(Math.round((totalSeconds / 3600) * 10) / 10);
        setAvgScore(scoreCount ? Math.round(scoreSum / scoreCount) : 0);
        setRecentActivity(activity.slice(0, 5));

        const completedDates = enrollments.filter((e) => e.completed_at).map((e) => e.completed_at as string).sort();
        const firstCompletedAt = completedDates[0] ?? null;
        const achievementList: { id: string; title: string; description: string; unlockedAt: string | null }[] = [
          { id: 'first-course', title: 'First course completed', description: 'Complete your first course', unlockedAt: completedCount >= 1 ? firstCompletedAt : null },
          { id: 'five-lessons', title: '5 lessons completed', description: 'Complete 5 lessons across any courses', unlockedAt: lessonsCompletedCount >= 5 ? (progressRows?.[0]?.completed_at ?? 'Just now') : null },
          { id: 'three-courses', title: '3 courses completed', description: 'Complete 3 courses', unlockedAt: completedCount >= 3 ? (completedDates[2] ?? null) : null },
          { id: 'ten-lessons', title: '10 lessons completed', description: 'Complete 10 lessons', unlockedAt: lessonsCompletedCount >= 10 ? 'Just now' : null }
        ];
        setAchievements(achievementList);
      } catch {
        setIsGuest(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  function formatTimeAgo(iso: string) {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const days = Math.floor(diff / 86400000);
    if (days >= 7) return `${Math.floor(days / 7)} week${days >= 14 ? 's' : ''} ago`;
    if (days >= 1) return `${days} day${days > 1 ? 's' : ''} ago`;
    const hours = Math.floor(diff / 3600000);
    if (hours >= 1) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return 'Just now';
  }

  const openEditModal = () => {
    setEditFullName(displayName);
    setEditOrganization(organization);
    setEditLocation(location);
    setShowEditModal(true);
  };

  const saveEditProfile = async () => {
    if (!userId) return;
    setSavingProfile(true);
    try {
      const { error } = await (supabase as any)
        .from('user_profiles')
        .update({
          full_name: editFullName.trim() || null,
          organization: editOrganization.trim() || null,
          location: editLocation.trim() || null,
        })
        .eq('id', userId);
      if (!error) {
        setDisplayName(editFullName.trim() || displayName);
        setOrganization(editOrganization.trim());
        setLocation(editLocation.trim());
        setShowEditModal(false);
      }
    } finally {
      setSavingProfile(false);
    }
  };

  const avatarInputRef = React.useRef<HTMLInputElement>(null);
  const handleAvatarClick = () => avatarInputRef.current?.click();
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    if (!file.type.startsWith('image/')) return;
    e.target.value = '';
    setUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${userId}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      if (uploadError) return;
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      const { error: updateError } = await (supabase as any).from('user_profiles').update({ avatar_url: urlData.publicUrl }).eq('id', userId);
      if (!updateError) setAvatarUrl(urlData.publicUrl);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', icon: Home },
    { id: 'about', label: 'About', icon: User },
    { id: 'courses', label: 'Courses', icon: BookOpen },
    { id: 'achievements', label: 'Achievements', icon: Award },
    { id: 'certificates', label: 'Certificates', icon: GraduationCap },
  ];

  if (loading) {
    return (
      <div className="min-h-screen dark:bg-gray-900">
        <div className="h-48 bg-gradient-to-r from-purple-500 to-blue-600 animate-pulse" />
        <div className="max-w-4xl mx-auto px-6 -mt-16 relative">
          <div className="animate-pulse h-32 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (isGuest) {
    return (
      <div className="p-8 max-w-2xl dark:bg-gray-900 min-h-screen">
        <h2 className="text-xl font-bold mb-2 dark:text-white">Profile</h2>
        <p className="text-gray-600 dark:text-gray-400">Sign in to view your profile.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900">
      {/* Cover */}
      <div className="relative h-48 bg-gradient-to-r from-purple-500 via-purple-600 to-blue-600">
        <button className="absolute top-4 right-4 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium text-white flex items-center gap-2">
          <Camera className="w-4 h-4" />
          Change Cover
        </button>
      </div>

      <div className="max-w-4xl mx-auto px-6 -mt-20 relative z-10 pb-12">
        {/* Profile header card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden mb-6">
          <div className="p-6 flex flex-wrap items-start gap-6">
            <div className="relative">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
              <button
                type="button"
                onClick={handleAvatarClick}
                disabled={uploadingAvatar}
                className="block w-28 h-28 rounded-2xl overflow-hidden bg-gradient-to-br from-pink-400 to-purple-500 shadow-lg focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="w-full h-full flex items-center justify-center text-white font-bold text-4xl">{initials}</span>
                )}
              </button>
              <button
                type="button"
                onClick={handleAvatarClick}
                disabled={uploadingAvatar}
                className="absolute bottom-0 right-0 w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center text-white hover:bg-gray-600"
                title="Change photo"
              >
                {uploadingAvatar ? <span className="text-xs">…</span> : <Camera className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{displayName}</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-0.5">{role}{organization ? ` • ${organization}` : ''}</p>
              <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {location || '—'}</span>
                {joinedAt && (
                  <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> Joined {joinedAt}</span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={openEditModal}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
              >
                <Pencil className="w-4 h-4" />
                Edit Profile
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-5 gap-4 p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
            <div className="bg-white dark:bg-gray-700/50 rounded-xl p-4 text-center border border-gray-100 dark:border-gray-600">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.completed}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">Completed</p>
            </div>
            <div className="bg-white dark:bg-gray-700/50 rounded-xl p-4 text-center border border-gray-100 dark:border-gray-600">
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.certificates}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">Certificates</p>
            </div>
            <div className="bg-white dark:bg-gray-700/50 rounded-xl p-4 text-center border border-gray-100 dark:border-gray-600">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.badges}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">Badges</p>
            </div>
            <div className="bg-white dark:bg-gray-700/50 rounded-xl p-4 text-center border border-gray-100 dark:border-gray-600">
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.streak}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">Day Streak</p>
            </div>
            <div className="bg-white dark:bg-gray-700/50 rounded-xl p-4 text-center border border-gray-100 dark:border-gray-600">
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.rank ? `#${stats.rank}` : '—'}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">Rank</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-6 py-4 font-semibold text-sm whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === id ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Quick Info */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Quick Info</h3>
              <div className="space-y-3">
                {email && (
                  <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                    <Mail className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                    <span>{email}</span>
                  </div>
                )}
                {organization && (
                  <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                    <Briefcase className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                    <span>{organization}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
                  <Phone className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                  <span>—</span>
                </div>
                <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
                  <Globe className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                  <span>{location || '—'}</span>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Recent Activity</h3>
              {recentActivity.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-sm">No recent activity yet.</p>
              ) : (
                <ul className="space-y-4">
                  {recentActivity.map((a) => (
                    <li key={a.id} className="flex items-start gap-3">
                      {a.type === 'completed' && <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />}
                      {a.type === 'started' && <Play className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />}
                      {a.type === 'certificate' && <GraduationCap className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />}
                      {a.type === 'badge' && <Award className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />}
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{a.title}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{a.timeAgo}{a.meta ? ` · ${a.meta}` : ''}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Learning Progress */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Learning Progress</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Overall Completion</p>
              <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden mb-4">
                <div
                  className="h-full bg-purple-500 dark:bg-purple-600 rounded-full transition-all"
                  style={{ width: `${overallCompletion}%` }}
                />
              </div>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{overallCompletion}%</p>
              <div className="flex gap-6 mt-2 text-sm text-gray-600 dark:text-gray-400">
                <span>{timeSpentHours}h Time Spent</span>
                <span>{avgScore}% Avg. Score</span>
              </div>
            </div>

            {/* Current Streak */}
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-6 text-white relative overflow-hidden">
              <Zap className="absolute top-4 right-4 w-12 h-12 text-white/30" />
              <p className="text-3xl font-bold">{stats.streak} days in a row</p>
              <p className="text-white/90 mt-1">Keep it up! Learn tomorrow to maintain your streak.</p>
            </div>
          </div>
        )}

        {activeTab === 'about' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">About</h3>
            <p className="text-gray-600 dark:text-gray-400">Add a short bio in Edit Profile.</p>
          </div>
        )}

        {activeTab === 'courses' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Courses</h3>
            {enrolledCourses.length === 0 ? (
              <p className="text-gray-600 dark:text-gray-400">You haven’t enrolled in any courses yet.</p>
            ) : (
              <ul className="space-y-3">
                {enrolledCourses.map((c) => (
                  <li key={c.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                    <span className="font-medium text-gray-900 dark:text-white">{c.title}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {c.completed_at ? 'Completed' : `${c.progress_percentage}%`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {activeTab === 'achievements' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Achievements</h3>
            {achievements.length === 0 ? (
              <p className="text-gray-600 dark:text-gray-400">Complete courses and lessons to unlock achievements.</p>
            ) : (
              <div className="grid gap-3">
                {achievements.map((a) => (
                  <div
                    key={a.id}
                    className={`flex items-center justify-between p-4 rounded-xl border ${a.unlockedAt ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 opacity-75'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${a.unlockedAt ? 'bg-amber-500 text-white' : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400'}`}>
                        <Award className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">{a.title}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{a.description}</p>
                      </div>
                    </div>
                    {a.unlockedAt ? (
                      <span className="text-sm text-amber-700 dark:text-amber-300">
                        {a.unlockedAt === 'Just now' ? 'Unlocked' : new Date(a.unlockedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-500 dark:text-gray-400">Locked</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'certificates' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Certificates</h3>
            {enrolledCourses.filter((c) => c.completed_at).length === 0 ? (
              <p className="text-gray-600 dark:text-gray-400">Complete courses to earn certificates. Your certificates will appear here.</p>
            ) : (
              <div className="grid gap-3">
                {enrolledCourses
                  .filter((c) => c.completed_at)
                  .map((c) => (
                    <div key={c.id} className="flex items-center justify-between p-4 rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center">
                          <GraduationCap className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">{c.title}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Completed {c.progress_percentage ?? 100}%</p>
                        </div>
                      </div>
                      <span className="text-sm text-green-700 dark:text-green-300">
                        {new Date(c.completed_at!).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowEditModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Edit Profile</h3>
              <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                <X className="w-5 h-5 dark:text-gray-200" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Name</label>
                <input
                  type="text"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  placeholder="Your name"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Position / Department</label>
                <input
                  type="text"
                  value={editOrganization}
                  onChange={(e) => setEditOrganization(e.target.value)}
                  placeholder="e.g. Product, Engineering"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Location</label>
                <input
                  type="text"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  placeholder="e.g. San Francisco, CA"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={saveEditProfile}
                disabled={savingProfile}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                {savingProfile ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
