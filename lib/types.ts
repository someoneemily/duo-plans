export type Category = 'Restaurant' | 'Experience' | 'Travel' | 'Other';

export interface Profile {
  id: string;
  username: string | null;
  display_name: string | null;
  instagram_handle: string | null;
  phone_number: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Activity {
  id: string;
  user_id: string;
  name: string;
  category: Category;
  notes: string | null;
  is_open: boolean;
  is_private: boolean;
  is_list_only: boolean;
  google_place_id: string | null;
  source: 'self' | 'explore';
  completed_at: string | null;
  created_at: string;
  dates: string[] | null;
  profiles?: Profile;
}

export type SharedListStatus = 'pending' | 'accepted' | 'declined';

export interface SharedListMember {
  id: string;
  list_id: string;
  user_id: string;
  invited_by_id: string | null;
  status: SharedListStatus;
  responded_at: string | null;
  created_at: string;
  profile: Profile;
}

export interface SharedList {
  id: string;
  creator_id: string;
  created_at: string;
  members: SharedListMember[];
  activityCount: number;
}

export interface Match {
  id: string;
  activity_name: string;
  user1_id: string;
  user2_id: string;
  activity1_id: string;
  activity2_id: string;
  created_at: string;
  other_profile?: Profile;
  category?: Category;
}
