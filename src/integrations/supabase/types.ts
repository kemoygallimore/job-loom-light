export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      applications: {
        Row: {
          candidate_id: string
          company_id: string
          created_at: string
          id: string
          job_id: string
          stage: Database["public"]["Enums"]["application_stage"]
          updated_at: string
        }
        Insert: {
          candidate_id: string
          company_id: string
          created_at?: string
          id?: string
          job_id: string
          stage?: Database["public"]["Enums"]["application_stage"]
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          company_id?: string
          created_at?: string
          id?: string
          job_id?: string
          stage?: Database["public"]["Enums"]["application_stage"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_files: {
        Row: {
          bucket: string
          candidate_id: string
          category: string
          company_id: string
          file_key: string
          file_name: string
          file_size: number
          file_type: string
          id: string
          job_id: string | null
          uploaded_at: string
        }
        Insert: {
          bucket: string
          candidate_id: string
          category: string
          company_id: string
          file_key: string
          file_name: string
          file_size?: number
          file_type: string
          id?: string
          job_id?: string | null
          uploaded_at?: string
        }
        Update: {
          bucket?: string
          candidate_id?: string
          category?: string
          company_id?: string
          file_key?: string
          file_name?: string
          file_size?: number
          file_type?: string
          id?: string
          job_id?: string | null
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_files_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_files_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_files_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_tag_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          candidate_id: string
          company_id: string
          id: string
          tag_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          candidate_id: string
          company_id: string
          id?: string
          tag_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          candidate_id?: string
          company_id?: string
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_tag_assignments_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "candidate_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_tags: {
        Row: {
          color: string
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          label: string
        }
        Insert: {
          color?: string
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          label: string
        }
        Update: {
          color?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
        }
        Relationships: []
      }
      candidates: {
        Row: {
          company_id: string
          country: string | null
          created_at: string
          education_level: string | null
          email: string | null
          id: string
          name: string
          parish_state: string | null
          phone: string | null
          resume_bucket: string | null
          resume_content_type: string | null
          resume_filename: string | null
          resume_object_key: string | null
          resume_size_bytes: number | null
          resume_url: string | null
          street_address: string | null
        }
        Insert: {
          company_id: string
          country?: string | null
          created_at?: string
          education_level?: string | null
          email?: string | null
          id?: string
          name: string
          parish_state?: string | null
          phone?: string | null
          resume_bucket?: string | null
          resume_content_type?: string | null
          resume_filename?: string | null
          resume_object_key?: string | null
          resume_size_bytes?: number | null
          resume_url?: string | null
          street_address?: string | null
        }
        Update: {
          company_id?: string
          country?: string | null
          created_at?: string
          education_level?: string | null
          email?: string | null
          id?: string
          name?: string
          parish_state?: string | null
          phone?: string | null
          resume_bucket?: string | null
          resume_content_type?: string | null
          resume_filename?: string | null
          resume_object_key?: string | null
          resume_size_bytes?: number | null
          resume_url?: string | null
          street_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          id: string
          max_open_jobs: number
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          max_open_jobs?: number
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          max_open_jobs?: number
          name?: string
          slug?: string
        }
        Relationships: []
      }
      feedback_links: {
        Row: {
          application_id: string | null
          candidate_id: string
          company_id: string
          created_at: string
          created_by: string
          expires_at: string
          id: string
          job_id: string
          token: string
        }
        Insert: {
          application_id?: string | null
          candidate_id: string
          company_id: string
          created_at?: string
          created_by: string
          expires_at?: string
          id?: string
          job_id: string
          token?: string
        }
        Update: {
          application_id?: string | null
          candidate_id?: string
          company_id?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          job_id?: string
          token?: string
        }
        Relationships: []
      }
      interview_feedback: {
        Row: {
          candidate_id: string
          company_id: string
          feedback_by: string | null
          feedback_date: string | null
          feedback_text: string
          hiring_manager: string | null
          id: string
          job_id: string
          opportunities: string | null
          rating: number | null
          source: string
          strengths: string | null
          submitted_at: string
          submitted_by: string | null
          weaknesses: string | null
        }
        Insert: {
          candidate_id: string
          company_id: string
          feedback_by?: string | null
          feedback_date?: string | null
          feedback_text: string
          hiring_manager?: string | null
          id?: string
          job_id: string
          opportunities?: string | null
          rating?: number | null
          source?: string
          strengths?: string | null
          submitted_at?: string
          submitted_by?: string | null
          weaknesses?: string | null
        }
        Update: {
          candidate_id?: string
          company_id?: string
          feedback_by?: string | null
          feedback_date?: string | null
          feedback_text?: string
          hiring_manager?: string | null
          id?: string
          job_id?: string
          opportunities?: string | null
          rating?: number | null
          source?: string
          strengths?: string | null
          submitted_at?: string
          submitted_by?: string | null
          weaknesses?: string | null
        }
        Relationships: []
      }
      jobs: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          hiring_manager: string | null
          id: string
          status: Database["public"]["Enums"]["job_status"]
          title: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          hiring_manager?: string | null
          id?: string
          status?: Database["public"]["Enums"]["job_status"]
          title: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          hiring_manager?: string | null
          id?: string
          status?: Database["public"]["Enums"]["job_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          candidate_id: string
          company_id: string
          content: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          candidate_id: string
          company_id: string
          content: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          candidate_id?: string
          company_id?: string
          content?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_id: string | null
          created_at: string
          email: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          email: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      screening_analytics: {
        Row: {
          archived_at: string
          company_id: string
          id: string
          job_title: string
          screening_job_id: string | null
          total_submissions: number
        }
        Insert: {
          archived_at?: string
          company_id: string
          id?: string
          job_title: string
          screening_job_id?: string | null
          total_submissions?: number
        }
        Update: {
          archived_at?: string
          company_id?: string
          id?: string
          job_title?: string
          screening_job_id?: string | null
          total_submissions?: number
        }
        Relationships: []
      }
      screening_jobs: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          expires_at: string
          id: string
          job_id: string | null
          question: string
          title: string
          unique_link_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          job_id?: string | null
          question: string
          title: string
          unique_link_id?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          job_id?: string | null
          question?: string
          title?: string
          unique_link_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "screening_jobs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      screening_submissions: {
        Row: {
          attempt_number: number | null
          candidate_email: string
          candidate_name: string
          company_id: string
          created_at: string
          id: string
          notes: string | null
          privacy_consent: boolean
          rating: number | null
          screening_job_id: string
          status: string
          upload_status: string | null
          video_bucket: string | null
          video_content_type: string | null
          video_filename: string | null
          video_object_key: string | null
          video_size_bytes: number | null
          video_url: string
        }
        Insert: {
          attempt_number?: number | null
          candidate_email: string
          candidate_name: string
          company_id: string
          created_at?: string
          id?: string
          notes?: string | null
          privacy_consent?: boolean
          rating?: number | null
          screening_job_id: string
          status?: string
          upload_status?: string | null
          video_bucket?: string | null
          video_content_type?: string | null
          video_filename?: string | null
          video_object_key?: string | null
          video_size_bytes?: number | null
          video_url: string
        }
        Update: {
          attempt_number?: number | null
          candidate_email?: string
          candidate_name?: string
          company_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          privacy_consent?: boolean
          rating?: number | null
          screening_job_id?: string
          status?: string
          upload_status?: string | null
          video_bucket?: string | null
          video_content_type?: string | null
          video_filename?: string | null
          video_object_key?: string | null
          video_size_bytes?: number | null
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "screening_submissions_screening_job_id_fkey"
            columns: ["screening_job_id"]
            isOneToOne: false
            referencedRelation: "screening_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      archive_resume_version: {
        Args: {
          _bucket: string
          _candidate_id: string
          _company_id: string
          _file_key: string
          _file_name: string
          _file_size: number
          _file_type: string
          _job_id: string
        }
        Returns: string
      }
      get_user_company_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "recruiter" | "super_admin"
      application_stage:
        | "applied"
        | "shortlisted"
        | "screening"
        | "scheduling"
        | "1st_interview"
        | "2nd_interview"
        | "interview"
        | "offer"
        | "hired"
        | "rejected"
      job_status: "open" | "closed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "recruiter", "super_admin"],
      application_stage: [
        "applied",
        "shortlisted",
        "screening",
        "scheduling",
        "1st_interview",
        "2nd_interview",
        "interview",
        "offer",
        "hired",
        "rejected",
      ],
      job_status: ["open", "closed"],
    },
  },
} as const
