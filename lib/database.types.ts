// TypeScript types for Supabase database schema
// This file can be auto-generated using: npx supabase gen types typescript --project-id YOUR_PROJECT_ID > lib/database.types.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      courses: {
        Row: {
          id: string
          title: string
          description: string | null
          created_by: string
          created_at: string
          updated_at: string
          status: 'draft' | 'published' | 'archived'
          thumbnail_url: string | null
          metadata: Json | null
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
          status?: 'draft' | 'published' | 'archived'
          thumbnail_url?: string | null
          metadata?: Json | null
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
          status?: 'draft' | 'published' | 'archived'
          thumbnail_url?: string | null
          metadata?: Json | null
        }
      }
      modules: {
        Row: {
          id: string
          course_id: string
          title: string
          description: string | null
          order_index: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          course_id: string
          title: string
          description?: string | null
          order_index?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          course_id?: string
          title?: string
          description?: string | null
          order_index?: number
          created_at?: string
          updated_at?: string
        }
      }
      lessons: {
        Row: {
          id: string
          module_id: string
          title: string
          description: string | null
          order_index: number
          duration_seconds: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          module_id: string
          title: string
          description?: string | null
          order_index?: number
          duration_seconds?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          module_id?: string
          title?: string
          description?: string | null
          order_index?: number
          duration_seconds?: number
          created_at?: string
          updated_at?: string
        }
      }
      content_items: {
        Row: {
          id: string
          lesson_id: string
          content_type: 'video' | 'quiz' | 'form'
          order_index: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          lesson_id: string
          content_type: 'video' | 'quiz' | 'form'
          order_index?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          lesson_id?: string
          content_type?: 'video' | 'quiz' | 'form'
          order_index?: number
          created_at?: string
          updated_at?: string
        }
      }
      video_segments: {
        Row: {
          id: string
          content_item_id: string
          name: string
          duration_seconds: number
          start_time_seconds: number
          end_time_seconds: number
          source: 'upload' | 'google_drive' | 'youtube'
          source_url: string | null
          storage_path: string | null
          file_size_bytes: number | null
          status: 'active' | 'processing' | 'failed'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          content_item_id: string
          name: string
          duration_seconds: number
          start_time_seconds?: number
          end_time_seconds: number
          source?: 'upload' | 'google_drive' | 'youtube'
          source_url?: string | null
          storage_path?: string | null
          file_size_bytes?: number | null
          status?: 'active' | 'processing' | 'failed'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          content_item_id?: string
          name?: string
          duration_seconds?: number
          start_time_seconds?: number
          end_time_seconds?: number
          source?: 'upload' | 'google_drive' | 'youtube'
          source_url?: string | null
          storage_path?: string | null
          file_size_bytes?: number | null
          status?: 'active' | 'processing' | 'failed'
          created_at?: string
          updated_at?: string
        }
      }
      quizzes: {
        Row: {
          id: string
          content_item_id: string
          title: string
          description: string | null
          passing_score: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          content_item_id: string
          title: string
          description?: string | null
          passing_score?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          content_item_id?: string
          title?: string
          description?: string | null
          passing_score?: number
          created_at?: string
          updated_at?: string
        }
      }
      quiz_questions: {
        Row: {
          id: string
          quiz_id: string
          question_text: string
          question_type: 'multiple_choice' | 'true_false' | 'short_answer'
          options: Json | null
          correct_answer: string
          points: number
          required: boolean
          order_index: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          quiz_id: string
          question_text: string
          question_type: 'multiple_choice' | 'true_false' | 'short_answer'
          options?: Json | null
          correct_answer: string
          points?: number
          required?: boolean
          order_index?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          quiz_id?: string
          question_text?: string
          question_type?: 'multiple_choice' | 'true_false' | 'short_answer'
          options?: Json | null
          correct_answer?: string
          points?: number
          required?: boolean
          order_index?: number
          created_at?: string
          updated_at?: string
        }
      }
      enrollments: {
        Row: {
          id: string
          course_id: string
          user_id: string
          enrolled_at: string
          completed_at: string | null
          progress_percentage: number
          last_accessed_at: string
        }
        Insert: {
          id?: string
          course_id: string
          user_id: string
          enrolled_at?: string
          completed_at?: string | null
          progress_percentage?: number
          last_accessed_at?: string
        }
        Update: {
          id?: string
          course_id?: string
          user_id?: string
          enrolled_at?: string
          completed_at?: string | null
          progress_percentage?: number
          last_accessed_at?: string
        }
      }
      progress: {
        Row: {
          id: string
          enrollment_id: string
          lesson_id: string
          completed: boolean
          time_spent_seconds: number
          last_accessed_at: string
          completed_at: string | null
          quiz_score: number | null
          quiz_passed: boolean | null
        }
        Insert: {
          id?: string
          enrollment_id: string
          lesson_id: string
          completed?: boolean
          time_spent_seconds?: number
          last_accessed_at?: string
          completed_at?: string | null
          quiz_score?: number | null
          quiz_passed?: boolean | null
        }
        Update: {
          id?: string
          enrollment_id?: string
          lesson_id?: string
          completed?: boolean
          time_spent_seconds?: number
          last_accessed_at?: string
          completed_at?: string | null
          quiz_score?: number | null
          quiz_passed?: boolean | null
        }
      }
      user_profiles: {
        Row: {
          id: string
          full_name: string | null
          avatar_url: string | null
          role: 'learner' | 'instructor' | 'admin'
          organization: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          avatar_url?: string | null
          role?: 'learner' | 'instructor' | 'admin'
          organization?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          avatar_url?: string | null
          role?: 'learner' | 'instructor' | 'admin'
          organization?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      course_analytics: {
        Row: {
          id: string
          course_id: string
          event_type: 'view' | 'start' | 'complete' | 'abandon'
          user_id: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          course_id: string
          event_type: 'view' | 'start' | 'complete' | 'abandon'
          user_id?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          course_id?: string
          event_type?: 'view' | 'start' | 'complete' | 'abandon'
          user_id?: string | null
          metadata?: Json | null
          created_at?: string
        }
      }
      learner_invites: {
        Row: {
          id: string
          email: string
          course_id: string | null
          status: string
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          course_id?: string | null
          status?: string
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          course_id?: string | null
          status?: string
          created_by?: string
          created_at?: string
        }
      }
      learner_reminders: {
        Row: {
          id: string
          user_id: string
          created_by: string
          note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          created_by: string
          note?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          created_by?: string
          note?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
