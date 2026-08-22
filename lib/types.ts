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

export type Room = {
  id: string;
  code: string;
  host_guest_id: string;
  game_id: string;
  category_ids: string[];
  question_ids: string[];
  current_index: number;
  status: "lobby" | "playing" | "ended";
  created_at: string;
};

export type RoomPlayer = {
  id: string;
  room_id: string;
  guest_id: string;
  nickname: string;
  joined_at: string;
};

export type RoomAnswer = {
  id: string;
  room_id: string;
  question_index: number;
  guest_id: string;
  nickname: string;
  answer: boolean | null;
  correct: boolean;
  answered_at: string;
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
    id: "multiplayer",
    name: "เล่นสด หลายคน",
    icon: "📡",
    desc: "เล่นพร้อมกันได้ 2-10 คน มีเจ้าภาพคุมจังหวะ เข้าห้องด้วยรหัส 5 หลัก ไม่ต้องล็อกอิน",
    playable: true,
    href: "/multiplayer",
  },
  {
    id: "dice-party",
    name: "ทอยเต๋าปาร์ตี้",
    icon: "🎲",
    desc: "ทอยเต๋าเดินรอบกระดาน ใครไปตกช่องไหนโดนภารกิจนั้น เล่นผลัดกันทีละคน ไม่ต้องล็อกอิน",
    playable: true,
    href: "/dice-party",
  },
  {
    id: "coming-soon",
    name: "เกมใหม่ (เร็วๆ นี้)",
    icon: "✨",
    desc: "พื้นที่ว่างสำหรับเกมถัดไปที่จะเพิ่มเข้ามา",
    playable: false,
  },
];
