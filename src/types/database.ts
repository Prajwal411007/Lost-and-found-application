export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type ItemType = 'lost' | 'found';
export type ItemStatus = 'open' | 'pending_claim' | 'returned' | 'closed';
export type ClaimStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type MatchStatus = 'suggested' | 'dismissed' | 'confirmed';
export type NotificationType =
  | 'match_found'
  | 'new_message'
  | 'claim_received'
  | 'claim_decision'
  | 'item_returned'
  | 'system';
export type ReportStatus = 'pending' | 'reviewed' | 'actioned' | 'dismissed';
export type UserRole = 'user' | 'admin' | 'moderator';

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  contact_preference: 'in_app' | 'email' | 'phone';
  role: UserRole;
  is_banned: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  description: string | null;
  created_at: string;
}

export interface ItemAttributes {
  color?: string;
  secondary_color?: string;
  brand?: string;
  model?: string;
  serial_number_last4?: string;
  identifying_marks?: string;
  secret_verification_question?: string;
  [key: string]: any;
}

export interface Item {
  id: string;
  user_id: string;
  type: ItemType;
  title: string;
  description: string;
  category_id: string;
  status: ItemStatus;
  location_country: string | null;
  location_state: string | null;
  location_city: string | null;
  location_landmark: string | null;
  latitude: number | null;
  longitude: number | null;
  date_occurred: string;
  primary_image_url: string | null;
  attributes: ItemAttributes;
  campus_place_id: string | null;
  campus_building_id: string | null;
  view_count: number;
  created_at: string;
  updated_at: string;
  // Joins
  category?: Category;
  user?: Profile;
  images?: ItemImage[];
}

export interface ItemImage {
  id: string;
  item_id: string;
  storage_path: string;
  public_url: string;
  order_index: number;
  created_at: string;
}

export interface MatchScoreDimension {
  name: string;
  weight: number;
  score: number;
  explanation: string;
}

export interface Match {
  id: string;
  lost_item_id: string;
  found_item_id: string;
  score: number;
  score_breakdown: Record<string, MatchScoreDimension>;
  status: MatchStatus;
  notified: boolean;
  created_at: string;
  // Joins
  lost_item?: Item;
  found_item?: Item;
}

export interface Claim {
  id: string;
  item_id: string;
  claimant_id: string;
  status: ClaimStatus;
  verification_answers: {
    answers: Record<string, string>;
    proof_description?: string;
    submitted_at: string;
  };
  finder_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  item?: Item;
  claimant?: Profile;
}

export interface Conversation {
  id: string;
  item_id: string | null;
  participant_one: string;
  participant_two: string;
  last_message_at: string;
  created_at: string;
  // Joins
  item?: Item;
  other_participant?: Profile;
  last_message?: Message;
  unread_count?: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  // Joins
  sender?: Profile;
}

export interface AppNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  link_url: string | null;
  read: boolean;
  created_at: string;
}

export interface NotificationPreferences {
  user_id: string;
  notify_matches: boolean;
  notify_messages: boolean;
  notify_claims: boolean;
  email_notifications: boolean;
  updated_at: string;
}

export interface CampusPlace {
  id: string;
  name: string;
  slug: string;
  city: string;
  state: string | null;
  country: string;
  latitude: number;
  longitude: number;
  zoom_level: number;
  boundary_polygon: any;
  created_at: string;
}

export interface CampusBuilding {
  id: string;
  campus_id: string;
  name: string;
  code: string | null;
  category: 'academic' | 'library' | 'dining' | 'student_union' | 'residence' | 'transit' | 'sports' | 'administrative' | 'other';
  latitude: number;
  longitude: number;
  description: string | null;
  created_at: string;
}

export interface AbuseReport {
  id: string;
  reporter_id: string;
  reported_item_id: string | null;
  reported_user_id: string | null;
  reason: string;
  details: string | null;
  status: ReportStatus;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  reporter?: Profile;
  reported_item?: Item;
  reported_user?: Profile;
}

export interface RegisteredItem {
  id: string;
  owner_id: string;
  name: string;
  category_id?: string | null;
  tag_code: string;
  notes_private?: string | null;
  lost_item_id?: string | null;
  created_at: string;
  updated_at: string;
  category?: Category | null;
}


