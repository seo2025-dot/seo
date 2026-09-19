/** Formas de las filas devueltas por Supabase (deben coincidir con supabase/schema.sql). */

export interface PerfilFila {
  id: string;
  display_name: string;
  handle: string | null;
  bio: string;
  location: string;
  avatar_url: string | null;
  interests: string[];
  zones: string[];
  relations: string[];
  lifestyle: string[];
  budget: string | null;
  age: number | null;
  sign: string | null;
  professional: { headline?: string; skills?: string[]; portfolio?: string[] } | null;
  badges: string[];
  email_verified: boolean;
  phone_verified: boolean;
  identity_verified: boolean;
  kyc_status: "none" | "pending" | "verified" | "rejected";
  rating: number | string;
  reviews_count: number;
  response_rate: number;
  trust_score: number;
  onboarding_completed?: boolean; 
  is_demo?: boolean;
  created_at: string;
}

export interface ListingFila {
  id: string;
  owner_id: string;
  kind: "offer" | "demand";
  category: "property" | "vehicle" | "business";
  operation: "sale" | "rent" | null;
  subtype: string;
  title: string;
  description: string;
  price: number | string | null;
  budget_max: number | string | null;
  currency: "USD" | "EUR" | "ARS" | "MXN";
  zone: string;
  area: number | string | null;
  min_area: number | string | null;
  attrs: Record<string, unknown>;
  images: string[];
  flash_discount: number | null;
  flash_until: string | null;
  boosted_until: string | null;
  status: "active" | "paused" | "closed";
  created_at: string;
}

export interface JobFila {
  id: string;
  owner_id: string;
  kind: "gig" | "vacancy";
  title: string;
  description: string;
  category: string | null;
  price_from: number | string | null;
  currency: "USD" | "EUR" | "ARS" | "MXN";
  delivery_days: number | null;
  job_type: string | null;
  modality: string | null;
  location: string;
  budget_text: string | null;
  skills: string[];
  image_url: string | null;
  sales_count: number;
  created_at: string;
}

export interface PostFila {
  id: string;
  author_id: string;
  kind: "historia" | "consulta" | "propiedad" | "experiencia";
  body: string;
  zone: string | null;
  image_url: string | null;
  created_at: string;
}

export interface LikeFila {
  post_id: string;
  user_id: string;
}

export interface ComentarioFila {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

export interface MensajeFila {
  id: string;
  chat_id: string;
  sender_id: string | null;
  kind: "text" | "offer" | "quote" | "system";
  body: string;
  amount: number | string | null;
  currency: string | null;
  days: number | null;
  status: "pending" | "accepted" | "rejected" | null;
  created_at: string;
}

export interface ChatResumenFila {
  id: string;
  kind: "listing" | "gig" | "job" | "direct";
  listing_id: string | null;
  job_id: string | null;
  origin: "cita" | "match" | null;
  last_message_at: string;
  other_id: string | null;
  unread: number;
  last_message: MensajeFila | null;
}

export interface NotificacionFila {
  id: string;
  type: "match-demanda" | "match-persona" | "solicitud" | "oferta" | "kyc" | "recompensa" | "sistema";
  title: string;
  body: string;
  href: string | null;
  read_at: string | null;
  created_at: string;
}

export interface AmistadFila {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
}

export interface MonederoFila {
  user_id: string;
  coins: number;
  streak: number;
  last_checkin: string | null;
  last_spin: string | null;
  super_likes: number;
  premium_readings: number;
}

export interface TarotFila {
  id: string;
  cards: number[];
  premium: boolean;
  created_at: string;
}
