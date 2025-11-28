export interface Book {
  id: string
  title: string
  author: string
  description: string | null
  cover_image_url: string | null
  genre: string[] | null
  published_year: number | null
  isbn: string | null
  created_at: string
  updated_at: string
}

export interface UserProfile {
  id: string
  kinde_user_id: string
  username: string
  email: string
  avatar_url: string | null
  bio: string | null
  created_at: string
  updated_at: string
}

export interface Review {
  id: string
  user_id: string
  book_id: string
  rating: number
  review_text: string | null
  created_at: string
  updated_at: string
  user_profiles?: UserProfile
  books?: Book
}

export interface Bookmark {
  id: string
  user_id: string
  book_id: string
  created_at: string
  books?: Book
}

export interface Favorite {
  id: string
  user_id: string
  book_id: string
  created_at: string
  books?: Book
}
