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
          linkedin_url: string | null
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
          linkedin_url?: string | null
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
          linkedin_url?: string | null
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
          email_domain: string | null
          email_domain_status: string | null
          email_from_name: string | null
          email_provider_domain_id: string | null
          email_reply_to: string | null
          id: string
          max_open_jobs: number
          name: string
          slug: string
          status: string | null
        }
        Insert: {
          created_at?: string
          email_domain?: string | null
          email_domain_status?: string | null
          email_from_name?: string | null
          email_provider_domain_id?: string | null
          email_reply_to?: string | null
          id?: string
          max_open_jobs?: number
          name: string
          slug: string
          status?: string | null
        }
        Update: {
          created_at?: string
          email_domain?: string | null
          email_domain_status?: string | null
          email_from_name?: string | null
          email_provider_domain_id?: string | null
          email_reply_to?: string | null
          id?: string
          max_open_jobs?: number
          name?: string
          slug?: string
          status?: string | null
        }
        Relationships: []
      }
      company_email_templates: {
        Row: {
          archived_at: string | null
          company_id: string
          created_at: string
          html_body: string
          id: string
          is_active: boolean
          is_default_for_purpose: boolean
          key: string
          name: string
          purpose: string
          subject: string
          text_body: string | null
          updated_at: string
          updated_by: string | null
          variables: Json
        }
        Insert: {
          archived_at?: string | null
          company_id: string
          created_at?: string
          html_body: string
          id?: string
          is_active?: boolean
          is_default_for_purpose?: boolean
          key: string
          name: string
          purpose?: string
          subject: string
          text_body?: string | null
          updated_at?: string
          updated_by?: string | null
          variables?: Json
        }
        Update: {
          archived_at?: string | null
          company_id?: string
          created_at?: string
          html_body?: string
          id?: string
          is_active?: boolean
          is_default_for_purpose?: boolean
          key?: string
          name?: string
          purpose?: string
          subject?: string
          text_body?: string | null
          updated_at?: string
          updated_by?: string | null
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "company_email_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_email_templates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      email_templates: {
        Row: {
          archived_at: string | null
          company_id: string | null
          created_at: string
          html_body: string
          id: string
          is_active: boolean
          is_default_for_purpose: boolean
          key: string
          name: string
          purpose: string
          subject: string
          text_body: string | null
          updated_at: string
          updated_by: string | null
          variables: Json
        }
        Insert: {
          archived_at?: string | null
          company_id?: string | null
          created_at?: string
          html_body: string
          id?: string
          is_active?: boolean
          is_default_for_purpose?: boolean
          key: string
          name: string
          purpose?: string
          subject: string
          text_body?: string | null
          updated_at?: string
          updated_by?: string | null
          variables?: Json
        }
        Update: {
          archived_at?: string | null
          company_id?: string | null
          created_at?: string
          html_body?: string
          id?: string
          is_active?: boolean
          is_default_for_purpose?: boolean
          key?: string
          name?: string
          purpose?: string
          subject?: string
          text_body?: string | null
          updated_at?: string
          updated_by?: string | null
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_templates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          application_id: string | null
          candidate_id: string | null
          company_id: string | null
          context: Json | null
          created_at: string
          error_message: string | null
          from_address: string | null
          id: string
          provider_message_id: string | null
          recipient_email: string
          reply_to: string | null
          status: string
          template_key: string
        }
        Insert: {
          application_id?: string | null
          candidate_id?: string | null
          company_id?: string | null
          context?: Json | null
          created_at?: string
          error_message?: string | null
          from_address?: string | null
          id?: string
          provider_message_id?: string | null
          recipient_email: string
          reply_to?: string | null
          status: string
          template_key: string
        }
        Update: {
          application_id?: string | null
          candidate_id?: string | null
          company_id?: string | null
          context?: Json | null
          created_at?: string
          error_message?: string | null
          from_address?: string | null
          id?: string
          provider_message_id?: string | null
          recipient_email?: string
          reply_to?: string | null
          status?: string
          template_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_send_log_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_send_log_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_send_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
          scorecard_version_id: string | null
          summary: string | null
          panelist_average: number | null
          scorecard_snapshot: Json | null
          ratings: Json | null
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
          scorecard_version_id?: string | null
          summary?: string | null
          panelist_average?: number | null
          scorecard_snapshot?: Json | null
          ratings?: Json | null
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
          scorecard_version_id?: string | null
          summary?: string | null
          panelist_average?: number | null
          scorecard_snapshot?: Json | null
          ratings?: Json | null
        }
        Relationships: []
      }
      jobs: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          expires_at: string
          hiring_manager: string | null
          id: string
          status: Database["public"]["Enums"]["job_status"]
          title: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          expires_at?: string
          hiring_manager?: string | null
          id?: string
          status?: Database["public"]["Enums"]["job_status"]
          title: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          expires_at?: string
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
      policies: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string | null
          draft_content_html: string
          draft_title: string
          id: string
          key: string
          owner_type: string
          published_version_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          draft_content_html?: string
          draft_title: string
          id?: string
          key: string
          owner_type: string
          published_version_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          draft_content_html?: string
          draft_title?: string
          id?: string
          key?: string
          owner_type?: string
          published_version_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "policies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_published_version_fk"
            columns: ["published_version_id"]
            isOneToOne: false
            referencedRelation: "policy_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_versions: {
        Row: {
          company_id: string | null
          content_html: string
          created_at: string
          id: string
          key: string
          owner_type: string
          policy_id: string
          published_at: string
          published_by: string | null
          title: string
          version_number: number
        }
        Insert: {
          company_id?: string | null
          content_html?: string
          created_at?: string
          id?: string
          key: string
          owner_type: string
          policy_id: string
          published_at?: string
          published_by?: string | null
          title: string
          version_number: number
        }
        Update: {
          company_id?: string | null
          content_html?: string
          created_at?: string
          id?: string
          key?: string
          owner_type?: string
          policy_id?: string
          published_at?: string
          published_by?: string | null
          title?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "policy_versions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_versions_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
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
      lead_forms: {
        Row: { id: string; company_id: string; created_by: string | null; title: string; description: string | null; status: string; public_id: string; schema: Json; created_at: string; updated_at: string; deleted_at: string | null }
        Insert: { id?: string; company_id: string; created_by?: string | null; title: string; description?: string | null; status?: string; public_id: string; schema?: Json; created_at?: string; updated_at?: string; deleted_at?: string | null }
        Update: { id?: string; company_id?: string; created_by?: string | null; title?: string; description?: string | null; status?: string; public_id?: string; schema?: Json; created_at?: string; updated_at?: string; deleted_at?: string | null }
        Relationships: []
      }
      lead_form_submissions: {
        Row: { id: string; form_id: string; company_id: string; answers: Json; schema_snapshot: Json; status: string; created_at: string; assignment_id: string | null; candidate_id: string | null }
        Insert: { id?: string; form_id: string; company_id: string; answers?: Json; schema_snapshot?: Json; status?: string; created_at?: string; assignment_id?: string | null; candidate_id?: string | null }
        Update: { id?: string; form_id?: string; company_id?: string; answers?: Json; schema_snapshot?: Json; status?: string; created_at?: string; assignment_id?: string | null; candidate_id?: string | null }
        Relationships: []
      }
      lead_form_uploads: {
        Row: { id: string; submission_id: string; form_id: string; company_id: string; field_id: string; bucket: string; object_key: string; file_name: string; file_type: string; file_size: number; created_at: string }
        Insert: { id?: string; submission_id: string; form_id: string; company_id: string; field_id: string; bucket: string; object_key: string; file_name: string; file_type: string; file_size: number; created_at?: string }
        Update: { id?: string; submission_id?: string; form_id?: string; company_id?: string; field_id?: string; bucket?: string; object_key?: string; file_name?: string; file_type?: string; file_size?: number; created_at?: string }
        Relationships: []
      }
      job_screening_versions: {
        Row: { id: string; company_id: string; job_id: string; version: number; status: string; created_by: string; created_at: string; published_at: string | null; locked_at: string | null }
        Insert: { id?: string; company_id: string; job_id: string; version: number; status?: string; created_by: string; created_at?: string; published_at?: string | null; locked_at?: string | null }
        Update: { id?: string; company_id?: string; job_id?: string; version?: number; status?: string; created_by?: string; created_at?: string; published_at?: string | null; locked_at?: string | null }
        Relationships: []
      }
      job_screening_questions: {
        Row: { id: string; version_id: string; position: number; type: Database["public"]["Enums"]["screening_question_type"]; prompt: string; required: boolean; settings: Json; rubric: Json | null; created_at: string }
        Insert: { id?: string; version_id: string; position: number; type: Database["public"]["Enums"]["screening_question_type"]; prompt: string; required?: boolean; settings?: Json; rubric?: Json | null; created_at?: string }
        Update: { id?: string; version_id?: string; position?: number; type?: Database["public"]["Enums"]["screening_question_type"]; prompt?: string; required?: boolean; settings?: Json; rubric?: Json | null; created_at?: string }
        Relationships: []
      }
      job_screening_choices: {
        Row: { id: string; question_id: string; position: number; label: string; credit_percent: number }
        Insert: { id?: string; question_id: string; position: number; label: string; credit_percent?: number }
        Update: { id?: string; question_id?: string; position?: number; label?: string; credit_percent?: number }
        Relationships: []
      }
      job_screening_responses: {
        Row: { id: string; company_id: string; application_id: string; version_id: string; status: Database["public"]["Enums"]["screening_response_status"]; score: number; review_needed_count: number; submitted_at: string; finalized_at: string | null }
        Insert: { id?: string; company_id: string; application_id: string; version_id: string; status: Database["public"]["Enums"]["screening_response_status"]; score?: number; review_needed_count?: number; submitted_at?: string; finalized_at?: string | null }
        Update: { id?: string; company_id?: string; application_id?: string; version_id?: string; status?: Database["public"]["Enums"]["screening_response_status"]; score?: number; review_needed_count?: number; submitted_at?: string; finalized_at?: string | null }
        Relationships: []
      }
      job_screening_answers: {
        Row: { id: string; response_id: string; question_id: string; answer: Json; answer_display: Json | null; earned_percent: number | null; rubric_level: number | null; graded_by: string | null; graded_at: string | null }
        Insert: { id?: string; response_id: string; question_id: string; answer: Json; answer_display?: Json | null; earned_percent?: number | null; rubric_level?: number | null; graded_by?: string | null; graded_at?: string | null }
        Update: { id?: string; response_id?: string; question_id?: string; answer?: Json; answer_display?: Json | null; earned_percent?: number | null; rubric_level?: number | null; graded_by?: string | null; graded_at?: string | null }
        Relationships: []
      }
      candidate_form_assignments: {
        Row: { id: string; company_id: string; form_id: string; candidate_id: string; created_by: string; token_hash: string; status: Database["public"]["Enums"]["form_assignment_status"]; schema_snapshot: Json; expires_at: string; verified_at: string | null; access_token_hash: string | null; completed_at: string | null; created_at: string; reset_of: string | null }
        Insert: { id?: string; company_id: string; form_id: string; candidate_id: string; created_by: string; token_hash: string; status?: Database["public"]["Enums"]["form_assignment_status"]; schema_snapshot: Json; expires_at: string; verified_at?: string | null; access_token_hash?: string | null; completed_at?: string | null; created_at?: string; reset_of?: string | null }
        Update: { id?: string; company_id?: string; form_id?: string; candidate_id?: string; created_by?: string; token_hash?: string; status?: Database["public"]["Enums"]["form_assignment_status"]; schema_snapshot?: Json; expires_at?: string; verified_at?: string | null; access_token_hash?: string | null; completed_at?: string | null; created_at?: string; reset_of?: string | null }
        Relationships: []
      }
      candidate_form_verifications: {
        Row: { id: string; assignment_id: string; code_hash: string; expires_at: string; attempt_count: number; consumed_at: string | null; created_at: string }
        Insert: { id?: string; assignment_id: string; code_hash: string; expires_at: string; attempt_count?: number; consumed_at?: string | null; created_at?: string }
        Update: { id?: string; assignment_id?: string; code_hash?: string; expires_at?: string; attempt_count?: number; consumed_at?: string | null; created_at?: string }
        Relationships: []
      }
      interview_scorecard_versions: {
        Row: { id: string; company_id: string; version: number; status: string; created_by: string; created_at: string; published_at: string | null }
        Insert: { id?: string; company_id: string; version: number; status?: string; created_by: string; created_at?: string; published_at?: string | null }
        Update: { id?: string; company_id?: string; version?: number; status?: string; created_by?: string; created_at?: string; published_at?: string | null }
        Relationships: []
      }
      interview_scorecard_areas: {
        Row: { id: string; version_id: string; position: number; label: string; description: string | null }
        Insert: { id?: string; version_id: string; position: number; label: string; description?: string | null }
        Update: { id?: string; version_id?: string; position?: number; label?: string; description?: string | null }
        Relationships: []
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
      delete_candidate_for_privacy: {
        Args: { _candidate_id: string }
        Returns: Json
      }
      resolve_email_template: {
        Args: {
          _company_id?: string | null
          _template_id?: string | null
          _template_key?: string | null
          _purpose?: string
          _include_inactive?: boolean
        }
        Returns: {
          archived_at: string | null
          company_id: string | null
          html_body: string
          id: string
          is_active: boolean
          is_default_for_purpose: boolean
          key: string
          name: string
          purpose: string
          source: string
          subject: string
          text_body: string | null
          updated_at: string
          variables: Json
        }[]
      }
      grade_written_screening_answer: {
        Args: { _answer_id: string; _rubric_level: number }
        Returns: Database["public"]["Tables"]["job_screening_answers"]["Row"]
      }
      get_job_pipeline: {
        Args: { _job_id: string; _search?: string | null; _screening_min?: number | null; _screening_max?: number | null; _screening_status?: string | null; _interview_min?: number | null; _interview_max?: number | null; _sort?: string }
        Returns: { id: string; job_id: string; candidate_id: string; stage: Database["public"]["Enums"]["application_stage"]; company_id: string; candidate_name: string; candidate_email: string | null; job_title: string; hiring_manager: string | null; screening_score: number | null; screening_status: string | null; review_needed_count: number | null; interview_average: number | null }[]
      }
      submit_public_job_application: {
        Args: {
          _additional_documents?: Json
          _candidate: Json
          _candidate_id: string
          _consents?: Json
          _job_id: string
          _resume: Json
          _screening_answers?: Json
          _screening_version_id?: string | null
        }
        Returns: {
          application_id: string
          candidate_id: string
        }[]
      }
      reset_candidate_form_assignment: {
        Args: { _assignment_id: string; _token_hash: string; _expires_at: string }
        Returns: string
      }
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
      get_public_company_by_slug: {
        Args: { _slug: string }
        Returns: {
          id: string
          name: string
          slug: string
        }[]
      }
      get_public_company_for_job: {
        Args: { _job_id: string }
        Returns: {
          id: string
          name: string
        }[]
      }
      get_public_platform_policy: {
        Args: { _key: string }
        Returns: {
          content_html: string
          key: string
          title: string
          updated_at: string
        }[]
      }
      get_user_company_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_feature_enabled: { Args: { _company_id: string; _feature: string }; Returns: boolean }
      publish_company_policy: {
        Args: {
          _content_html: string
          _policy_key: string
          _title: string
        }
        Returns: string
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
      screening_question_type: "yes_no" | "single_choice" | "multi_select" | "number" | "short_text" | "long_text"
      screening_response_status: "provisional" | "final"
      form_assignment_status: "pending" | "verified" | "completed" | "expired" | "revoked" | "superseded"
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
