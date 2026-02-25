/**
 * Stub for root type-check only. Real types in coursify-app/lib/types.ts.
 */
export interface Course {
  id: string
  title: string
  description: string | null
  created_by: string
  created_at: string
  updated_at: string
  is_published: boolean
  template_id: string | null
}

export interface Module {
  id: string
  course_id: string
  title: string
  description: string | null
  order_index: number
  created_at: string
  updated_at: string
}

export interface Lesson {
  id: string
  module_id: string
  title: string
  description: string | null
  order_index: number
  content_type: 'video' | 'document' | 'quiz' | 'text'
  content_data: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface VideoSegment {
  id: string
  lesson_id: string
  segment_index: number
  video_url: string
  start_time: number | null
  end_time: number | null
  storage_type: 'google_drive' | 'supabase' | 'external_url'
  storage_path: string | null
  created_at: string
  updated_at: string
}

export interface Enrollment {
  id: string
  course_id: string
  user_id: string
  enrolled_at: string
  completed_at: string | null
  progress_percentage: number
}

export interface Progress {
  id: string
  enrollment_id: string
  lesson_id: string
  completed: boolean
  time_spent_seconds: number
  last_accessed_at: string
  completed_at: string | null
}

export interface GoogleDriveConnection {
  id: string
  user_id: string
  access_token: string
  refresh_token: string
  token_expires_at: string
  created_at: string
  updated_at: string
}

export interface CourseTemplate {
  id: string
  name: string
  description: string
  template_data: Record<string, unknown>
  created_at: string
}
