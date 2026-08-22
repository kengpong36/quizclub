// ============================================================
// ไพ่ป๊อกเด้ง — เครื่องคำนวณกติกา (pure functions, testable in isolation)
// ============================================================

export type Suit = "♠" | "♥" | "♦" | "♣";
export type Card = { rank: string; suit: Suit };

const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];

export function freshDeck(): Card[] {
  const deck: Card[] = [];
  for (const s of SUITS) for (const r of RANKS) deck.push({ rank: r, suit: s });
  return deck;
}

export function shuffleDeck<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function cardValue(rank: string): number {
  if (rank === "A") return 1;
  if (["10", "J", "Q", "K"].includes(rank)) return 0;
  return parseInt(rank, 10);
}

function rankIndex(rank: string): number {
  return RANKS.indexOf(rank) + 1; // A=1 ... K=13 (Ace is low only)
}

export function calcPoint(cards: Card[]): number {
  const sum = cards.reduce((s, c) => s + cardValue(c.rank), 0);
  return sum % 10;
}

export function isPok(cards: Card[]): boolean {
  return cards.length === 2 && (calcPoint(cards) === 8 || calcPoint(cards) === 9);
}

// "เด้ง" — first two cards dealt share the same suit
export function isDeng(cards: Card[]): boolean {
  return cards.length >= 2 && cards[0].suit === cards[1].suit;
}

export function isTong(cards: Card[]): boolean {
  return cards.length === 3 && cards[0].rank === cards[1].rank && cards[1].rank === cards[2].rank;
}

export function isFlush3(cards: Card[]): boolean {
  return cards.length === 3 && cards[0].suit === cards[1].suit && cards[1].suit === cards[2].suit;
}

export function isStraight3(cards: Card[]): boolean {
  if (cards.length !== 3) return false;
  const idx = cards.map((c) => rankIndex(c.rank)).sort((a, b) => a - b);
  return idx[1] === idx[0] + 1 && idx[2] === idx[1] + 1;
}

export type HandResult = {
  tier: number; // higher tier always beats lower tier, regardless of point
  multiplier: number;
  label: string;
  point: number;
};

// ============================================================
// ตารางจ่าย (อ้างอิงสูตรที่ใช้กันทั่วไป — ปรับตัวเลขได้ภายหลังถ้าต้องการ)
//  ตอง                         5 เท่า
//  เรียงเด้ง (สเตรทฟลัช)         5 เท่า
//  เรียง / สี (3 ใบ)             3 เท่า
//  ป๊อก 8/9 เด้ง                 3 เท่า
//  ป๊อก 8/9 ธรรมดา              2 เท่า
//  เด้ง (2 ใบแรกดอกเดียวกัน)     2 เท่า
//  แต้มธรรมดา                   1 เท่า
// ============================================================
export function classifyHand(cards: Card[]): HandResult {
  const point = calcPoint(cards);
  const deng = isDeng(cards);

  if (cards.length === 3) {
    if (isTong(cards)) return { tier: 5, multiplier: 5, label: "ตอง", point };
    const straight = isStraight3(cards);
    const flush = isFlush3(cards);
    if (straight && flush) return { tier: 4, multiplier: 5, label: "เรียงเด้ง (สเตรทฟลัช)", point };
    if (straight) return { tier: 3, multiplier: 3, label: "เรียง", point };
    if (flush) return { tier: 3, multiplier: 3, label: "สี", point };
  }

  if (isPok(cards)) {
    const label = point === 9 ? "ป๊อก 9" : "ป๊อก 8";
    if (deng) return { tier: 2, multiplier: 3, label: label + "เด้ง", point };
    return { tier: 2, multiplier: 2, label, point };
  }

  if (deng) return { tier: 1, multiplier: 2, label: "เด้ง", point };
  return { tier: 1, multiplier: 1, label: "แต้มธรรมดา", point };
}

// returns 1 if a beats b, -1 if b beats a, 0 if tie (ties go to the banker by convention, applied by the caller)
export function compareHands(a: HandResult, b: HandResult): number {
  if (a.tier !== b.tier) return a.tier > b.tier ? 1 : -1;
  if (a.point !== b.point) return a.point > b.point ? 1 : -1;
  return 0;
}
