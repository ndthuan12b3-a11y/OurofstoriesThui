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
      config: {
        Row: {
          id: string
          user_id: string
          start_date: string
          name_male: string
          name_female: string
          primary_color: string
          main_title: string
          main_subtitle: string
          avatar_url: string | null
          manager_passcode: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          start_date: string
          name_male: string
          name_female: string
          primary_color: string
          main_title: string
          main_subtitle: string
          avatar_url?: string | null
          manager_passcode?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          start_date?: string
          name_male?: string
          name_female?: string
          primary_color?: string
          main_title?: string
          main_subtitle?: string
          avatar_url?: string | null
          manager_passcode?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      events: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string
          date: string
          photo_url: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          description: string
          date: string
          photo_url: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          description?: string
          date?: string
          photo_url?: string
          created_at?: string
          updated_at?: string
        }
      }
      gallery: {
        Row: {
          id: string
          user_id: string
          description: string
          tags: string[] | null
          photo_url: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          description: string
          tags?: string[] | null
          photo_url: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          description?: string
          tags?: string[] | null
          photo_url?: string
          created_at?: string
          updated_at?: string
        }
      }
      music_playlist: {
        Row: {
          id: string
          user_id: string
          title: string
          music_url: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          music_url: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          music_url?: string
          created_at?: string
          updated_at?: string
        }
      }
      user_roles: {
        Row: {
          id: string
          user_id: string
          role: 'none' | 'vip' | 'admin'
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          role: 'none' | 'vip' | 'admin'
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          role?: 'none' | 'vip' | 'admin'
          created_at?: string
        }
      }
      stories: {
        Row: {
          id: string
          user_id: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          content?: string
          created_at?: string
        }
      }
    }
    Functions: {
      fn_check_manager_passcode: {
        Args: { input_passcode: string }
        Returns: boolean
      }
      fn_hash_passcode: {
        Args: { passcode_to_hash: string }
        Returns: string
      }
      get_all_users: {
        Args: Record<PropertyKey, never>
        Returns: { id: string; email: string }[]
      }
    }
  }
}

export type UserRole = 'none' | 'vip' | 'admin';

export interface AppConfig {
  start_date: string;
  name_male: string;
  name_female: string;
  primary_color: string;
  main_title: string;
  main_subtitle: string;
  avatar_url: string;
  background_image_url?: string;
  background_video_url?: string;
}
