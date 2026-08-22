export type Profile = {
  id: string;
  username: string;
  role: "member" | "admin";
  created_at: string;
};

export type Category = {
  id: string;
  game_id: string;
  name: string;
  created_at: string;
};

export type Question = {
  id: string;
  game_id: string;
  category_id: string;
  text: string;
  answer: boolean;
  explain: string;
  created_at: string;
};

export type Score = {
  id: string;
  user_id: string;
  game_id: string;
  score: number;
  total_questions: number;
  best_streak: number;
  played_at: string;
  profiles?: { username: string } | null;
};

// ============================================================
// GAMES REGISTRY — add a new game by pushing an entry here.
// Each game's questions/categories are scoped by `id` (game_id
// column in Supabase), so adding a game needs no schema change —
// just create categories/questions in admin with this game_id.
// Set `href` to override the default `/play/{id}` route when a
// game needs its own custom engine/page (e.g. "party" below).
// ============================================================
export type GameEntry = {
  id: string;
  name: string;
  icon: string;
  desc: string;
  playable: boolean;
  href?: string;
};

export const GAMES: GameEntry[] = [
  {
    id: "truth-or-lie",
    name: "จริงหรือมั่ว",
    icon: "🎭",
    desc: "ทายให้ทันว่าข้อความที่เห็นเป็นเรื่องจริงหรือเรื่องมั่ว ก่อนเวลาจะหมด",
    playable: true,
  },
  {
    id: "party",
    name: "จริงมั่ว วงเหล้า",
    icon: "🍻",
    desc: "โหมดปาร์ตี้เร่งจังหวะให้วงสนุกขึ้น พร้อมกติกาความปลอดภัยในตัว ไม่ต้องล็อกอิน",
    playable: true,
    href: "/party",
  },
  {
    id: "coming-soon",
    name: "เกมใหม่ (เร็วๆ นี้)",
    icon: "✨",
    desc: "พื้นที่ว่างสำหรับเกมถัดไปที่จะเพิ่มเข้ามา",
    playable: false,
  },
];
