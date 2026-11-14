
export interface Item {
  id: number;
  type: 'lost' | 'found';
  status: 'pending' | 'approved' | 'rejected' | 'resolved';
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


