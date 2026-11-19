export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      activity_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          title_id: string | null
          user_profile_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          title_id?: string | null
          user_profile_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          title_id?: string | null
          user_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_events_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_applications: {
        Row: {
          club_id: string
          created_at: string | null
          id: string
          reviewed_at: string | null
          reviewed_by_user_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          club_id: string
          created_at?: string | null
          id?: string
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          club_id?: string
          created_at?: string | null
          id?: string
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_applications_club_id_clubs_id_fk"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_applications_reviewed_by_user_id_fkey"
            columns: ["reviewed_by_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_applications_reviewed_by_user_id_fkey"
            columns: ["reviewed_by_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_applications_user_id_user_profiles_id_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_applications_user_id_user_profiles_id_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_invitations: {
        Row: {
          club_id: string
          created_at: string
          id: string
          invitee_user_id: string
          inviter_user_id: string
          responded_at: string | null
          status: string
        }
        Insert: {
          club_id: string
          created_at?: string
          id?: string
          invitee_user_id: string
          inviter_user_id: string
          responded_at?: string | null
          status?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          invitee_user_id?: string
          inviter_user_id?: string
          responded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_invitations_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_invitations_invitee_user_id_fkey"
            columns: ["invitee_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_invitations_invitee_user_id_fkey"
            columns: ["invitee_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_invitations_inviter_user_id_fkey"
            columns: ["inviter_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_invitations_inviter_user_id_fkey"
            columns: ["inviter_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_members: {
        Row: {
          club_id: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          club_id: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          club_id?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_members_club_id_clubs_id_fk"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_members_user_id_user_profiles_id_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_members_user_id_user_profiles_id_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_reading_comments: {
        Row: {
          club_id: string
          content: string
          created_at: string
          id: string
          likes_count: number
          title_id: string
          user_id: string
        }
        Insert: {
          club_id: string
          content: string
          created_at?: string
          id?: string
          likes_count?: number
          title_id: string
          user_id: string
        }
        Update: {
          club_id?: string
          content?: string
          created_at?: string
          id?: string
          likes_count?: number
          title_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_reading_comments_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_reading_comments_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_reading_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_reading_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_reading_items: {
        Row: {
          author: string | null
          club_id: string
          created_at: string | null
          id: string
          title: string | null
          title_id: string | null
        }
        Insert: {
          author?: string | null
          club_id: string
          created_at?: string | null
          id?: string
          title?: string | null
          title_id?: string | null
        }
        Update: {
          author?: string | null
          club_id?: string
          created_at?: string | null
          id?: string
          title?: string | null
          title_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "club_reading_items_club_id_clubs_id_fk"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_reading_items_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_writer_work_likes: {
        Row: {
          created_at: string
          id: string
          user_id: string
          work_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
          work_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_writer_work_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_writer_work_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_writer_work_likes_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "club_writer_works"
            referencedColumns: ["id"]
          },
        ]
      }
      club_writer_works: {
        Row: {
          author_user_id: string
          club_id: string
          content_html: string
          content_text: string
          created_at: string
          id: string
          is_completed: boolean
          is_public: boolean
          title: string
          updated_at: string
        }
        Insert: {
          author_user_id: string
          club_id: string
          content_html?: string
          content_text?: string
          created_at?: string
          id?: string
          is_completed?: boolean
          is_public?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          author_user_id?: string
          club_id?: string
          content_html?: string
          content_text?: string
          created_at?: string
          id?: string
          is_completed?: boolean
          is_public?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_writer_works_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_writer_works_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_writer_works_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          avatar_url: string | null
          categories: string[] | null
          created_at: string | null
          current_title_id: string | null
          description: string | null
          id: string
          join_policy: string
          name: string
          owner_user_id: string
          type: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          categories?: string[] | null
          created_at?: string | null
          current_title_id?: string | null
          description?: string | null
          id?: string
          join_policy?: string
          name: string
          owner_user_id: string
          type: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          categories?: string[] | null
          created_at?: string | null
          current_title_id?: string | null
          description?: string | null
          id?: string
          join_policy?: string
          name?: string
          owner_user_id?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clubs_current_title_id_fkey"
            columns: ["current_title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clubs_owner_user_id_user_profiles_id_fk"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clubs_owner_user_id_user_profiles_id_fk"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      discussion_posts: {
        Row: {
          content: string
          created_at: string | null
          id: string
          likes_count: number
          title_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          likes_count?: number
          title_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          likes_count?: number
          title_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discussion_posts_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discussion_posts_user_id_user_profiles_id_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discussion_posts_user_id_user_profiles_id_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      editions: {
        Row: {
          asin: string | null
          created_at: string | null
          format: string | null
          id: string
          isbn_10: string | null
          isbn_13: string | null
          raw_google_data: Json | null
          saleability: string | null
          updated_at: string | null
          volume_id: string | null
          work_id: string
        }
        Insert: {
          asin?: string | null
          created_at?: string | null
          format?: string | null
          id?: string
          isbn_10?: string | null
          isbn_13?: string | null
          raw_google_data?: Json | null
          saleability?: string | null
          updated_at?: string | null
          volume_id?: string | null
          work_id: string
        }
        Update: {
          asin?: string | null
          created_at?: string | null
          format?: string | null
          id?: string
          isbn_10?: string | null
          isbn_13?: string | null
          raw_google_data?: Json | null
          saleability?: string | null
          updated_at?: string | null
          volume_id?: string | null
          work_id?: string
        }
        Relationships: []
      }
      google_ingest_previews: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          payload: Json
          profile_id: string
          used_at: string | null
          volume_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          payload: Json
          profile_id: string
          used_at?: string | null
          volume_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          payload?: Json
          profile_id?: string
          used_at?: string | null
          volume_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_ingest_previews_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "google_ingest_previews_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          created_at: string | null
          id: string
          is_read: boolean
          recipient_deleted: boolean
          recipient_profile_id: string | null
          recipient_username: string | null
          reply_to: string | null
          sender_deleted: boolean
          sender_profile_id: string
          status: string
          subject: string
          updated_at: string | null
        }
        Insert: {
          body: string
          created_at?: string | null
          id?: string
          is_read?: boolean
          recipient_deleted?: boolean
          recipient_profile_id?: string | null
          recipient_username?: string | null
          reply_to?: string | null
          sender_deleted?: boolean
          sender_profile_id: string
          status?: string
          subject: string
          updated_at?: string | null
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          is_read?: boolean
          recipient_deleted?: boolean
          recipient_profile_id?: string | null
          recipient_username?: string | null
          reply_to?: string | null
          sender_deleted?: boolean
          sender_profile_id?: string
          status?: string
          subject?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_recipient_profile_id_fkey"
            columns: ["recipient_profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_recipient_profile_id_fkey"
            columns: ["recipient_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_profile_id_fkey"
            columns: ["sender_profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_profile_id_fkey"
            columns: ["sender_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_profile_id: string | null
          created_at: string | null
          event_type: string
          id: string
          is_read: boolean
          metadata: Json | null
          post_id: string | null
          recipient_profile_id: string
          review_id: string | null
          title_id: string | null
        }
        Insert: {
          actor_profile_id?: string | null
          created_at?: string | null
          event_type: string
          id?: string
          is_read?: boolean
          metadata?: Json | null
          post_id?: string | null
          recipient_profile_id: string
          review_id?: string | null
          title_id?: string | null
        }
        Update: {
          actor_profile_id?: string | null
          created_at?: string | null
          event_type?: string
          id?: string
          is_read?: boolean
          metadata?: Json | null
          post_id?: string | null
          recipient_profile_id?: string
          review_id?: string | null
          title_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "discussion_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_profile_id_fkey"
            columns: ["recipient_profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_profile_id_fkey"
            columns: ["recipient_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string | null
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_discussion_posts_id_fk"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "discussion_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_likes_user_id_user_profiles_id_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_likes_user_id_user_profiles_id_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_diary_entries: {
        Row: {
          created_at: string | null
          current_page: number | null
          entry_date: string
          id: string
          is_completed: boolean
          minutes_listened: number | null
          note_html: string | null
          note_text: string | null
          progress_mode: string
          progress_percent: number | null
          title_id: string
          total_minutes: number | null
          total_pages: number | null
          user_profile_id: string
        }
        Insert: {
          created_at?: string | null
          current_page?: number | null
          entry_date?: string
          id?: string
          is_completed?: boolean
          minutes_listened?: number | null
          note_html?: string | null
          note_text?: string | null
          progress_mode: string
          progress_percent?: number | null
          title_id: string
          total_minutes?: number | null
          total_pages?: number | null
          user_profile_id: string
        }
        Update: {
          created_at?: string | null
          current_page?: number | null
          entry_date?: string
          id?: string
          is_completed?: boolean
          minutes_listened?: number | null
          note_html?: string | null
          note_text?: string | null
          progress_mode?: string
          progress_percent?: number | null
          title_id?: string
          total_minutes?: number | null
          total_pages?: number | null
          user_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_diary_entries_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_diary_entries_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_diary_entries_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reference_isbns: {
        Row: {
          created_at: string
          id: string
          isbn: string
          source: string
          title_id: string
          updated_at: string
          work_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          isbn: string
          source?: string
          title_id: string
          updated_at?: string
          work_id: string
        }
        Update: {
          created_at?: string
          id?: string
          isbn?: string
          source?: string
          title_id?: string
          updated_at?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reference_isbns_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
        ]
      }
      review_likes: {
        Row: {
          created_at: string | null
          id: string
          review_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          review_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          review_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_likes_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          created_at: string | null
          id: string
          rating: number
          review_text: string | null
          title_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          rating: number
          review_text?: string | null
          title_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          rating?: number
          review_text?: string | null
          title_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      suggestion_work_matches: {
        Row: {
          confidence_score: number | null
          created_at: string
          id: string
          match_type: Database["public"]["Enums"]["suggestion_match_type"]
          reason: string | null
          suggestion_id: string
          updated_at: string
          work_id: string
          work_snapshot: Json | null
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          id?: string
          match_type: Database["public"]["Enums"]["suggestion_match_type"]
          reason?: string | null
          suggestion_id: string
          updated_at?: string
          work_id: string
          work_snapshot?: Json | null
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          id?: string
          match_type?: Database["public"]["Enums"]["suggestion_match_type"]
          reason?: string | null
          suggestion_id?: string
          updated_at?: string
          work_id?: string
          work_snapshot?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "suggestion_work_matches_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      suggestions: {
        Row: {
          admin_final_cover_selection: Json | null
          admin_final_genres: string[] | null
          admin_final_selected_work_ids: string[] | null
          admin_final_selected_work_snapshots: Json | null
          admin_reviewed_at: string | null
          admin_reviewed_by_profile_id: string | null
          algorithm_suggested_genres: string[] | null
          created_at: string
          id: string
          status: Database["public"]["Enums"]["suggestion_status"]
          suggested_by_profile_id: string | null
          suggested_genres: string[] | null
          suggested_selected_work_ids: string[] | null
          suggested_selected_work_snapshots: Json | null
          title_id: string
          updated_at: string
        }
        Insert: {
          admin_final_cover_selection?: Json | null
          admin_final_genres?: string[] | null
          admin_final_selected_work_ids?: string[] | null
          admin_final_selected_work_snapshots?: Json | null
          admin_reviewed_at?: string | null
          admin_reviewed_by_profile_id?: string | null
          algorithm_suggested_genres?: string[] | null
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["suggestion_status"]
          suggested_by_profile_id?: string | null
          suggested_genres?: string[] | null
          suggested_selected_work_ids?: string[] | null
          suggested_selected_work_snapshots?: Json | null
          title_id: string
          updated_at?: string
        }
        Update: {
          admin_final_cover_selection?: Json | null
          admin_final_genres?: string[] | null
          admin_final_selected_work_ids?: string[] | null
          admin_final_selected_work_snapshots?: Json | null
          admin_reviewed_at?: string | null
          admin_reviewed_by_profile_id?: string | null
          algorithm_suggested_genres?: string[] | null
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["suggestion_status"]
          suggested_by_profile_id?: string | null
          suggested_genres?: string[] | null
          suggested_selected_work_ids?: string[] | null
          suggested_selected_work_snapshots?: Json | null
          title_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggestions_admin_reviewed_by_profile_id_fkey"
            columns: ["admin_reviewed_by_profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggestions_admin_reviewed_by_profile_id_fkey"
            columns: ["admin_reviewed_by_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggestions_suggested_by_profile_id_fkey"
            columns: ["suggested_by_profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggestions_suggested_by_profile_id_fkey"
            columns: ["suggested_by_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggestions_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
        ]
      }
      title_bookmarks: {
        Row: {
          created_at: string | null
          id: string
          title_id: string
          user_profile_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          title_id: string
          user_profile_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          title_id?: string
          user_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "title_bookmarks_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "title_bookmarks_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "title_bookmarks_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      title_list_items: {
        Row: {
          created_at: string | null
          id: string
          list_id: string
          title_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          list_id: string
          title_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          list_id?: string
          title_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "title_list_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "title_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "title_list_items_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
        ]
      }
      title_list_likes: {
        Row: {
          created_at: string | null
          id: string
          list_id: string
          user_profile_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          list_id: string
          user_profile_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          list_id?: string
          user_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "title_list_likes_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "title_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "title_list_likes_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "title_list_likes_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      title_lists: {
        Row: {
          created_at: string | null
          id: string
          is_default: boolean
          is_public: boolean
          list_type: string
          name: string
          updated_at: string | null
          user_profile_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_default?: boolean
          is_public?: boolean
          list_type?: string
          name: string
          updated_at?: string | null
          user_profile_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_default?: boolean
          is_public?: boolean
          list_type?: string
          name?: string
          updated_at?: string | null
          user_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "title_lists_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "title_lists_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      title_reference_works: {
        Row: {
          confidence_score: number | null
          created_at: string
          id: string
          source: string
          title_id: string
          updated_at: string
          work_id: string
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          id?: string
          source?: string
          title_id: string
          updated_at?: string
          work_id: string
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          id?: string
          source?: string
          title_id?: string
          updated_at?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "title_reference_works_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
        ]
      }
      title_sources: {
        Row: {
          created_at: string
          external_id: string
          id: string
          source: string
          title_id: string
        }
        Insert: {
          created_at?: string
          external_id: string
          id?: string
          source: string
          title_id: string
        }
        Update: {
          created_at?: string
          external_id?: string
          id?: string
          source?: string
          title_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "title_sources_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
        ]
      }
      title_user_progress: {
        Row: {
          created_at: string
          current_page: number
          id: string
          is_completed: boolean
          last_read_at: string | null
          minutes_listened: number | null
          progress_percent: number | null
          title_id: string
          total_minutes: number | null
          total_pages: number | null
          updated_at: string
          user_profile_id: string
        }
        Insert: {
          created_at?: string
          current_page?: number
          id?: string
          is_completed?: boolean
          last_read_at?: string | null
          minutes_listened?: number | null
          progress_percent?: number | null
          title_id: string
          total_minutes?: number | null
          total_pages?: number | null
          updated_at?: string
          user_profile_id: string
        }
        Update: {
          created_at?: string
          current_page?: number
          id?: string
          is_completed?: boolean
          last_read_at?: string | null
          minutes_listened?: number | null
          progress_percent?: number | null
          title_id?: string
          total_minutes?: number | null
          total_pages?: number | null
          updated_at?: string
          user_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "title_user_progress_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "title_user_progress_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "title_user_progress_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      titles: {
        Row: {
          author: string
          cover_image_url: string | null
          created_at: string
          description: string | null
          dupe_work_ids: Json | null
          genre: string[] | null
          id: string
          isbn: string | null
          isbn_list: Json | null
          published_year: number | null
          title: string
          updated_at: string
          work_id: string | null
        }
        Insert: {
          author: string
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          dupe_work_ids?: Json | null
          genre?: string[] | null
          id?: string
          isbn?: string | null
          isbn_list?: Json | null
          published_year?: number | null
          title: string
          updated_at?: string
          work_id?: string | null
        }
        Update: {
          author?: string
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          dupe_work_ids?: Json | null
          genre?: string[] | null
          id?: string
          isbn?: string | null
          isbn_list?: Json | null
          published_year?: number | null
          title?: string
          updated_at?: string
          work_id?: string | null
        }
        Relationships: []
      }
      user_experience: {
        Row: {
          created_at: string | null
          level: number
          total_experience: number
          updated_at: string | null
          user_profile_id: string
        }
        Insert: {
          created_at?: string | null
          level?: number
          total_experience?: number
          updated_at?: string | null
          user_profile_id: string
        }
        Update: {
          created_at?: string | null
          level?: number
          total_experience?: number
          updated_at?: string | null
          user_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_experience_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_experience_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: true
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_follows: {
        Row: {
          created_at: string | null
          followed_profile_id: string
          follower_profile_id: string
          id: string
          is_friend: boolean
          is_private: boolean
        }
        Insert: {
          created_at?: string | null
          followed_profile_id: string
          follower_profile_id: string
          id?: string
          is_friend?: boolean
          is_private?: boolean
        }
        Update: {
          created_at?: string | null
          followed_profile_id?: string
          follower_profile_id?: string
          id?: string
          is_friend?: boolean
          is_private?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "user_follows_followed_profile_id_fkey"
            columns: ["followed_profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_follows_followed_profile_id_fkey"
            columns: ["followed_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_follows_follower_profile_id_fkey"
            columns: ["follower_profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_follows_follower_profile_id_fkey"
            columns: ["follower_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_genre_points: {
        Row: {
          created_at: string | null
          genre: string
          id: string
          points: number
          reason: string
          source_id: string
          source_type: string
          title_id: string | null
          user_profile_id: string
        }
        Insert: {
          created_at?: string | null
          genre: string
          id?: string
          points: number
          reason: string
          source_id: string
          source_type: string
          title_id?: string | null
          user_profile_id: string
        }
        Update: {
          created_at?: string | null
          genre?: string
          id?: string
          points?: number
          reason?: string
          source_id?: string
          source_type?: string
          title_id?: string | null
          user_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_genre_points_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_genre_points_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_genre_points_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          auth_user_id: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          email: string | null
          favorite_genres: string[]
          id: string
          onboarding_completed_at: string | null
          role: string | null
          signature: string | null
          signature_image: string | null
          updated_at: string | null
          username: string
        }
        Insert: {
          auth_user_id?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          email?: string | null
          favorite_genres?: string[]
          id?: string
          onboarding_completed_at?: string | null
          role?: string | null
          signature?: string | null
          signature_image?: string | null
          updated_at?: string | null
          username: string
        }
        Update: {
          auth_user_id?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          email?: string | null
          favorite_genres?: string[]
          id?: string
          onboarding_completed_at?: string | null
          role?: string | null
          signature?: string | null
          signature_image?: string | null
          updated_at?: string | null
          username?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"] | null
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"] | null
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"] | null
          user_id?: string
        }
        Relationships: []
      }
      work_cover_cache: {
        Row: {
          cached_file_path: string | null
          cached_public_url: string | null
          created_at: string
          id: string
          remote_url: string
          source: string
          source_cover_key: string
          updated_at: string
          work_id: string
        }
        Insert: {
          cached_file_path?: string | null
          cached_public_url?: string | null
          created_at?: string
          id?: string
          remote_url: string
          source: string
          source_cover_key: string
          updated_at?: string
          work_id: string
        }
        Update: {
          cached_file_path?: string | null
          cached_public_url?: string | null
          created_at?: string
          id?: string
          remote_url?: string
          source?: string
          source_cover_key?: string
          updated_at?: string
          work_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          id: string | null
          role: string | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          id?: string | null
          role?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          id?: string | null
          role?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      insert_follow_with_quota: {
        Args: { p_follower_profile_id: string; p_followed_profile_id: string }
        Returns: Json
      }
      can_manage_club: { Args: { target_club_id: string }; Returns: boolean }
      can_manage_club_avatar_object: {
        Args: { object_name: string }
        Returns: boolean
      }
      can_view_activity_for: {
        Args: { target_profile_id: string }
        Returns: boolean
      }
      club_notification_context: {
        Args: { target_actor_profile_id: string; target_club_id: string }
        Returns: Json
      }
      current_profile_id: { Args: never; Returns: string }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      generate_placeholder_username: { Args: never; Returns: string }
      get_club_member_current_progress: {
        Args: { target_club_id: string }
        Returns: {
          current_page: number
          is_completed: boolean
          minutes_listened: number
          progress_percent: number
          total_minutes: number
          total_pages: number
          user_id: string
        }[]
      }
      has_finished_title: {
        Args: { target_title_id: string }
        Returns: boolean
      }
      invite_club_member: {
        Args: { target_club_id: string; target_invitee_profile_id: string }
        Returns: string
      }
      is_club_participant: {
        Args: { target_club_id: string }
        Returns: boolean
      }
      is_current_user_admin: { Args: never; Returns: boolean }
      is_current_user_staff: { Args: never; Returns: boolean }
      join_open_club: { Args: { target_club_id: string }; Returns: string }
      leave_club: { Args: { target_club_id: string }; Returns: string }
      mark_notifications_read: {
        Args: { mark_all?: boolean; target_notification_id?: string }
        Returns: number
      }
      remove_club_member: {
        Args: {
          removal_reason?: string
          target_club_id: string
          target_member_profile_id: string
        }
        Returns: string
      }
      resolve_club_notification: {
        Args: {
          resolution_action: string
          resolved_at: string
          target_entity_id: string
          target_entity_key: string
          target_event_type: string
          target_recipient_profile_id: string
        }
        Returns: number
      }
      respond_to_club_invitation: {
        Args: { accept_invitation: boolean; target_invitation_id: string }
        Returns: string
      }
      review_club_application: {
        Args: {
          approve_application: boolean
          target_application_id: string
          target_club_id: string
        }
        Returns: string
      }
      revoke_club_invitation: {
        Args: { target_club_id: string; target_invitation_id: string }
        Returns: string
      }
      submit_club_application: {
        Args: { target_club_id: string }
        Returns: string
      }
      withdraw_club_application: {
        Args: { target_club_id: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "user" | "moderator"
      suggestion_match_type: "exact_auto_dupe" | "bookworm_suggested"
      suggestion_status: "pending" | "approved" | "dismissed"
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
      app_role: ["admin", "user", "moderator"],
      suggestion_match_type: ["exact_auto_dupe", "bookworm_suggested"],
      suggestion_status: ["pending", "approved", "dismissed"],
    },
  },
} as const
