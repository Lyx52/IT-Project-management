export interface Item {
  id: number;
  type: 'lost' | 'found';
  status: 'pending' | 'approved' | 'rejected' | 'resolved';
  /** The moderator's reason; only sent to the author and admins of a rejected post. */
  rejection_reason?: string | null;
  title: string;
  description: string;

  latitude: number | null;
  longitude: number | null;
  location_name: string | null;

  event_date: string;
  resolved_at: string | null;

  images: ItemImage[];
  category: ItemCategory;
  user: ItemUser;

  /** Only on suggested matches: metres from the post they were matched to. */
  distance_m?: number;

  created_at: string;
  updated_at: string;
}

export interface ItemImage {
  id: number;
  url: string;
}

export interface ItemCategory {
  id: number;
  name: string;
}

export interface ItemUser {
  id: number;
  username: string;
}

export interface ApiResponse<T> {
  data: T;
}

export interface Post {
  id: number;
  type: 'lost' | 'found';
  status: string;
  title: string;
  description: string;
  latitude: number | null;
  longitude: number | null;
  location_name: string | null;
  event_date: string;
  resolved_at: string | null;
  images: PostImage[];
  category: PostCategory;
  user: PostUser;
  created_at: string;
  updated_at: string;
}

export interface PostImage {
  id: number;
  url: string;
}

export interface PostCategory {
  id: number;
  name: string;
}

export interface PostUser {
  id: number;
  username: string;
}

export interface Category {
  id: number;
  name: string;
}

/** Laravel's pagination block, the part the pages use. */
export interface PageMeta {
  current_page: number;
  last_page: number;
  total: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}

/** The filters of GET /posts/query, which is also what a saved search stores. */
export interface PostFilters {
  q: string | null;
  type: 'lost' | 'found' | null;
  category_id: number | null;
}

export interface SavedSearch {
  id: number;
  name: string;
  q: string | null;
  type: 'lost' | 'found' | null;
  category: Category | null;
  created_at: string;
  updated_at: string;
}

export interface SavedSearchMatchDetails {
  saved_search_id: number;
  saved_search_name: string;
  post_id: number;
  post_title: string;
  post_type: 'lost' | 'found';
  message: string;
}

export interface PostModeratedDetails {
  post_id: number;
  post_title: string;
  status: 'approved' | 'rejected';
  message: string;
  reason: string | null;
}

export type AppNotification = {
  id: string;
  read_at: string | null;
  created_at: string;
} & (
  | { type: 'saved_search_match'; details: SavedSearchMatchDetails }
  | { type: 'post_moderated'; details: PostModeratedDetails }
);

export interface NotificationPage extends Paginated<AppNotification> {
  meta: PageMeta & { unread_count: number };
}

export interface Message {
  id: number;
  post_id: number;
  body: string;
  sender: {
    id: number;
    username: string;
  };
  receiver: {
    id: number;
    username: string;
  };
  read_at: string | null;
  created_at: string;
  attachments: MessageAttachment[];
}

export interface MessageUser {
  id: number;
  username: string;
}

export interface SendMessageRequest {
  body: string;
  user_id?: number;
}

export interface MessageAttachment {
  id: number;
  type: 'image' | 'video';
  mime_type: string;
  size: number;
  url: string;
}

export interface Conversation {
  post_id: number;
  post_title: string;
  other_user: MessageUser;
  last_message: {
    id: number;
    body: string | null;
    created_at: string;
    sender_id: number;
  };
  unread_count: number;
}
