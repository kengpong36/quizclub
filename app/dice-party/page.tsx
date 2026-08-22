"use client";

import { useState } from "react";
import Link from "next/link";
import { playDiceRattle, playReveal, playFanfare } from "@/lib/sound";
import SoundToggle from "@/components/SoundToggle";

const BOARD_SIZE = 20;
const TOKEN_EMOJIS = ["🐶", "🐱", "🐰", "🦊", "🐼", "🐸", "🐵", "🦁"];
const TOKEN_COLORS = ["#C9891F", "#1F8577", "#C23B33", "#6B5B95", "#2E86AB", "#E07A5F", "#3D9970", "#8a5f14"];

type TileType = "dare" | "share" | "luck" | "drink" | "action" | "improv";

const TILE_META: Record<TileType, { icon: string; label: string; color: string }> = {
  dare: { icon: "🎭", label: "ท้าทาย", color: "#C23B33" },
  share: { icon: "💬", label: "แชร์", color: "#1F8577" },
  luck: { icon: "🍀", label: "ดวง", color: "#8a5f14" },
  drink: { icon: "🍻", label: "ดื่ม", color: "#C9891F" },
  action: { icon: "⚡", label: "แอ๊กชัน", color: "#6B5B95" },
  improv: { icon: "🧠", label: "คิดเอง", color: "#2E86AB" },
};

const TASKS: Record<TileType, string[]> = {
  dare: [
    "เต้นท่าไก่ 10 วินาทีให้เพื่อนดู",
    "เลียนแบบเสียงสัตว์ที่คนอื่นในวงเลือกให้",
    "ทำหน้าตลกที่สุดเท่าที่ทำได้ ถ่ายรูปเก็บไว้",
    "พูดประโยคที่คนข้างๆ บอก โดยใช้สำเนียงต่างจังหวัด",
    "ยืนขาเดียวนับ 1-10 เป็นภาษาอังกฤษ",
    "ทำท่าเซลฟี่สุดปังใส่กล้องมือถือใครก็ได้ในวง",
    "เดินแบบมั่นใจสุดๆ ข้ามห้องไปกลับ 1 รอบ เหมือนเดินแบบแฟชั่นโชว์",
    "ทำท่าซูเปอร์ฮีโร่ที่ชอบที่สุด ค้างไว้ 5 วินาที",
    "ร้องเพลงชาติแบบกระซิบ",
    "ยิ้มให้เพื่อนทุกคนในวงทีละคน แบบห้ามหัวเราะ",
    "ลองพูด 1 ประโยคโดยไม่ขยับริมฝีปาก",
    "เลียนแบบท่าทางเพื่อนคนหนึ่งในวง ให้คนอื่นทายว่าใคร",
    "จับมือทักทายทุกคนในวงแบบเป็นทางการสุดๆ เหมือนประชุมบอร์ดบริษัท",
    "ยืนประกาศเสียงดังว่า 'ฉันคือราชา/ราชินีแห่งค่ำคืนนี้!'",
    "ทำเสียงหัวเราะแบบตัวร้ายในหนัง 5 วินาที",
    "ให้เพื่อนถ่ายวิดีโอสั้นๆ ท่าทางแปลกที่สุดที่นึกออกตอนนี้",
    "พูดกลับหลัง (สะกดคำย้อนกลับ) ชื่อของตัวเอง",
    "ทำหน้าเหมือนเพิ่งเห็นผี ค้างไว้ 5 วินาที ให้เพื่อนถ่ายรูป",
    "เดินแบบหุ่นยนต์รอบวงเหล้า 1 รอบ",
    "จ้องตาคนข้างๆ 10 วินาทีโดยไม่หัวเราะ ใครยอมแพ้ก่อนโดนภารกิจเพิ่ม",
  ],
  share: [
    "เล่าเรื่องอายที่สุดในชีวิต 1 เรื่อง",
    "บอกความลับเล็กๆ ที่ไม่เคยบอกใครในวงนี้",
    "เล่าว่าเพลงอะไรที่ฟังแล้วนึกถึงแฟนเก่า/คนที่แอบชอบ",
    "บอกข้อดี 3 ข้อของคนที่นั่งอยู่ทางขวามือ",
    "เล่าทริปที่ประทับใจที่สุดในชีวิต แบบสั้นๆ",
    "บอกว่าใครในวงนี้ที่คิดว่าเก่งเรื่องทำอาหารที่สุด",
    "เล่าความฝันแปลกที่สุดที่เคยฝัน",
    "บอกงานอดิเรกแปลกๆ ที่ไม่มีใครในวงรู้มาก่อน",
    "เล่าเรื่องตลกที่เกิดขึ้นตอนเป็นเด็ก",
    "บอกว่าถ้าย้อนเวลาได้ อยากกลับไปแก้ไขอะไรในชีวิต",
    "บอกซูเปอร์พาวเวอร์ที่อยากมีที่สุดพร้อมเหตุผล",
    "เล่าว่าอาหารจานโปรดตลอดกาลคืออะไรและทำไม",
    "บอกคำชมที่ประทับใจที่สุดที่เคยได้รับในชีวิต",
    "เล่าเรื่องที่ทำให้รู้สึกภูมิใจในตัวเองที่สุด",
    "บอกว่าถ้าถูกหวยรางวัลที่ 1 พรุ่งนี้จะทำอะไรเป็นอย่างแรก",
    "เล่าว่าเพื่อนในวงนี้คนไหนที่รู้จักกันมานานที่สุด และรู้จักกันได้ยังไง",
    "บอกนิสัยแปลกๆ ของตัวเองที่คนอื่นอาจไม่รู้",
    "เล่าเรื่องการเดินทางที่หายนะที่สุดที่เคยเจอ",
  ],
  luck: [
    "โชคดี! ข้ามตาไปได้เลย ไม่ต้องทำอะไร",
    "จับฉลากในใจ 1-3 ถ้าเพื่อนทายถูก คุณต้องทำภารกิจพิเศษที่วงกำหนด",
    "ให้เพื่อนในวงทายว่าอายุคุณเท่าไหร่ ทายผิดให้เขาทำท่าทางตลกแทน",
    "โชคร้ายเล็กน้อย! เล่าเรื่องขำๆ ที่เคยพลาดต่อหน้าคนเยอะๆ",
    "หมุนวงล้อในใจ แล้วบอกสีที่นึกถึงตอนนี้ พร้อมเหตุผล",
    "ได้สิทธิ์แจกภารกิจให้เพื่อน 1 คนเลือกเอง",
    "ดวงเข้าข้าง! เลือกได้ว่าจะข้ามตานี้ หรือแลกกับการดื่ม 1 จิบแทน",
    "ทายใจ: เพื่อนข้างๆ กำลังคิดถึงตัวเลข 1-10 อะไร ทายถูกได้แจกภารกิจ ทายผิดโดนแจกภารกิจ",
    "เสี่ยงดวง! โยนหัวก้อยในใจ ออกหัวข้ามตา ออกก้อยรับภารกิจเพิ่มอีก 1 ใบ",
    "ดวงพลิก! เลือกสลับตำแหน่งบนกระดานกับผู้เล่นคนไหนก็ได้",
    "จั่วไพ่มงคล! บอกเลขนำโชคของตัวเองพร้อมเหตุผลแบบจริงจังสุดๆ",
    "ฟ้าลิขิต! ให้วงช่วยกันตั้งฉายาใหม่ให้คุณ ต้องใช้ฉายานั้นไปตลอดเกม",
  ],
  drink: [
    "จิบเครื่องดื่ม 1 จิบ (หรือน้ำเปล่าก็ได้ถ้าไม่สะดวก)",
    "ชวนเพื่อนอีกคนจิบพร้อมกัน 1 จิบ",
    "ดื่มแบบสโลว์โมชั่นให้เพื่อนดูฮาๆ",
    "สลับแก้วกับเพื่อนข้างๆ จิบ 1 ครั้ง (ถ้าโอเคทั้งคู่)",
    "ชนแก้วกับทุกคนในวงก่อนจิบ",
    "จิบพร้อมพูดคำอวยพรสั้นๆ ให้วงนี้",
    "เลือกให้เพื่อน 1 คนจิบไปพร้อมกับคุณ",
    "จิบแบบหลับตา 1 จิบ",
    "ตั้งชื่อค็อกเทลในจินตนาการให้เครื่องดื่มตัวเอง แล้วค่อยจิบ",
    "จิบพร้อมทำหน้าเหมือนเพิ่งชิมอาหารระดับมิชลิน",
  ],
  action: [
    "แจกไฮไฟว์ให้ทุกคนในวง",
    "ตั้งชื่อเล่นใหม่ให้ตัวเองแบบฮาๆ ใช้ไปตลอดเกมนี้",
    "ผิวปากเพลงอะไรก็ได้ 5 วินาที",
    "ทำท่าโพสต์ท่าถ่ายรูปแบบดาราสุดหรู 3 วินาที",
    "พูดคำว่า 'สวัสดีครับ/ค่ะ' เป็นภาษาต่างประเทศให้ได้ 3 ภาษา",
    "นวดบ่าให้คนข้างๆ 10 วินาที",
    "เปลี่ยนที่นั่งกับเพื่อนคนหนึ่งในวง 1 รอบ",
    "ตบมือเป็นจังหวะเพลงที่เพื่อนร้องให้ฟัง",
    "ให้เพื่อนจัดทรงผมให้ใหม่ 10 วินาที",
    "ส่งข้อความชมเพื่อนสนิทคนหนึ่งตอนนี้เลย (ถ้าสะดวก)",
    "ทำมือเป็นรูปหัวใจถ่ายรูปคู่กับทุกคนในวงทีละคน",
    "แข่งใครทำหน้าตายได้นานสุด กับเพื่อนที่นั่งใกล้ที่สุด",
    "โบกมือลาแบบดราม่าสุดๆ เหมือนในหนังไปกลับ 3 รอบ",
  ],
  improv: [
    "แต่งกลอนสั้น 4 บรรทัดเกี่ยวกับวงนี้ ณ ตอนนี้",
    "ด้นสดพูดสุนทรพจน์ 30 วินาที หัวข้อ 'ทำไมมันฝรั่งทอดถึงยิ่งใหญ่'",
    "คิดชื่อบริษัทปลอมพร้อมสโลแกนภายใน 10 วินาที",
    "แต่งทำนองเพลงอะไรก็ได้ ร้องชมคนในวง 1 คน",
    "เล่านิทานสั้นๆ ที่แต่งเองให้จบภายใน 30 วินาที โดยใช้คำที่เพื่อนสุ่มให้ 3 คำ",
    "คิดคำทายปริศนาสั้นๆ ให้เพื่อนในวงทาย",
    "อธิบายภายใน 20 วินาทีว่าทำไมแมวถึงจะปกครองโลกในอนาคต",
    "สร้างท่าเต้นใหม่ 4 ท่า พร้อมตั้งชื่อท่าเต้นนั้นด้วย",
    "แต่งประโยคเด็ดที่จะใช้แนะนำตัวถ้าได้ออกทีวี",
    "ด้นสดเป็นผู้ประกาศข่าว รายงานว่า 'เกิดอะไรขึ้นในวงนี้ตอนนี้' ภายใน 20 วินาที",
    "คิดคำขวัญประจำวงนี้ขึ้นมาใหม่ ให้เพื่อนโหวตว่าชอบไหม",
    "รับบทเป็นตัวละครในหนังที่เพื่อนเลือกให้ พูด 1 ประโยคในบท",
    "คิดชื่อเมนูอาหารแปลกใหม่ พร้อมบรรยายรสชาติให้น่ากิน",
    "แต่งวลีเด็ดประจำตัวขึ้นมาใหม่ แล้วสาธิตวิธีใช้ให้ดู",
    "ด้นสดโฆษณาขายของสมมติที่อยู่ใกล้ตัวตอนนี้ ภายใน 15 วินาที",
  ],
};

type Player = { id: string; name: string; emoji: string; color: string; pos: number };
type Stage = "setup" | "board";

function pickTask(type: TileType, used: Set<string>, setUsed: (s: Set<string>) => void): string {
  const pool = TASKS[type];
  let available = pool.filter((t) => !used.has(t));
  if (available.length === 0) {
    available = pool;
    setUsed(new Set());
  }
  const task = available[Math.floor(Math.random() * available.length)];
  const next = new Set(used);
  next.add(task);
  setUsed(next);
  return task;
}

export default function DicePartyPage() {
  const [stage, setStage] = useState<Stage>("setup");
  const [nameInput, setNameInput] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [tiles, setTiles] = useState<TileType[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [rolling, setRolling] = useState(false);
  const [dieFace, setDieFace] = useState(1);
  const [activeTask, setActiveTask] = useState<{ type: TileType; text: string } | null>(null);
  const [usedByType, setUsedByType] = useState<Record<TileType, Set<string>>>({
    dare: new Set(),
    share: new Set(),
    luck: new Set(),
    drink: new Set(),
    action: new Set(),
    improv: new Set(),
  });

  function addPlayer() {
    const name = nameInput.trim();
    if (!name || players.length >= 8) return;
    const i = players.length;
    setPlayers([
      ...players,
      { id: crypto.randomUUID(), name, emoji: TOKEN_EMOJIS[i], color: TOKEN_COLORS[i], pos: 0 },
    ]);
    setNameInput("");
  }
  function removePlayer(id: string) {
    setPlayers(players.filter((p) => p.id !== id));
  }

  function startGame() {
    const types: TileType[] = ["dare", "share", "luck", "drink", "action", "improv"];
    const board = Array.from({ length: BOARD_SIZE }, () => types[Math.floor(Math.random() * types.length)]);
    setTiles(board);
    setPlayers(players.map((p) => ({ ...p, pos: 0 })));
    setCurrentIdx(0);
    setActiveTask(null);
    setStage("board");
  }

  function rollDice() {
    if (rolling || activeTask) return;
    setRolling(true);
    playDiceRattle();
    let ticks = 0;
    const iv = setInterval(() => {
      setDieFace(1 + Math.floor(Math.random() * 6));
      ticks++;
      if (ticks > 8) {
        clearInterval(iv);
        const finalRoll = 1 + Math.floor(Math.random() * 6);
        setDieFace(finalRoll);
        setRolling(false);
        movePlayer(finalRoll);
      }
    }, 90);
  }

  function movePlayer(roll: number) {
    const player = players[currentIdx];
    const newPos = (player.pos + roll) % BOARD_SIZE;
    const updated = players.map((p, i) => (i === currentIdx ? { ...p, pos: newPos } : p));
    setPlayers(updated);
    const tileType = tiles[newPos];
    playReveal();
    const used = usedByType[tileType];
    const text = pickTask(tileType, used, (s) =>
      setUsedByType((prev) => ({ ...prev, [tileType]: s }))
    );
    setActiveTask({ type: tileType, text });
  }

  function nextTurn() {
    setActiveTask(null);
    setCurrentIdx((i) => (i + 1) % players.length);
  }

  function endGame() {
    playFanfare();
    setStage("setup");
    setPlayers(players.map((p) => ({ ...p, pos: 0 })));
    setActiveTask(null);
  }

  const SafetyBanner = () => (
    <div
      className="info-text"
      style={{
        textAlign: "center",
        marginBottom: 16,
        padding: "10px 12px",
        border: "1px solid var(--line)",
        borderRadius: 10,
        background: "var(--card)",
      }}
    >
      🚫 พาสภารกิจไหนก็ได้เสมอ &nbsp;·&nbsp; 💧 สลับเป็นน้ำเปล่าได้ตลอดเกม
    </div>
  );

  if (stage === "setup") {
    return (
      <div className="frame">
        <SoundToggle />
        <h2 className="section-title">🎲 ทอยเต๋าปาร์ตี้</h2>
        <div className="section-sub">
          ผลัดกันทอยเต๋าเดินรอบกระดาน ตกช่องไหนโดนภารกิจนั้น เพิ่มผู้เล่น 2-8 คน
        </div>
        <SafetyBanner />
        <label className="field-label">เพิ่มผู้เล่น</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="ชื่อผู้เล่น"
            maxLength={16}
            onKeyDown={(e) => e.key === "Enter" && addPlayer()}
          />
          <button className="btn small" onClick={addPlayer} disabled={players.length >= 8}>
            เพิ่ม
          </button>
        </div>
        <div style={{ marginTop: 14 }}>
          {players.map((p) => (
            <div className="cat-manage-row" key={p.id}>
              <div className="cinfo">
                {p.emoji} {p.name}
              </div>
              <button className="icon-btn" onClick={() => removePlayer(p.id)}>
                🗑️
              </button>
            </div>
          ))}
          {players.length === 0 && <div className="empty-note">ยังไม่มีผู้เล่น เพิ่มอย่างน้อย 2 คน</div>}
        </div>
        <button className="btn" disabled={players.length < 2} onClick={startGame} style={{ marginTop: 16 }}>
          {players.length < 2 ? "ต้องมีอย่างน้อย 2 คน" : `เริ่มเกม (${players.length} คน)`}
        </button>
        <Link href="/" className="btn ghost" style={{ display: "block", textAlign: "center", marginTop: 12 }}>
          กลับหน้าแรก
        </Link>
      </div>
    );
  }

  // stage === "board"
  const boardCenter = 150;
  const radius = 128;
  const currentPlayer = players[currentIdx];

  return (
    <div className="frame">
      <SoundToggle />
      <div className="row-between">
        <h2 className="section-title" style={{ marginBottom: 0 }}>
          🎲 ทอยเต๋าปาร์ตี้
        </h2>
        <button className="link-btn" onClick={endGame}>
          🛑 จบเกม
        </button>
      </div>

      <div
        style={{
          position: "relative",
          width: 300,
          height: 300,
          margin: "16px auto",
        }}
      >
        {tiles.map((t, i) => {
          const angle = (i / BOARD_SIZE) * 2 * Math.PI - Math.PI / 2;
          const x = boardCenter + radius * Math.cos(angle) - 15;
          const y = boardCenter + radius * Math.sin(angle) - 15;
          const meta = TILE_META[t];
          const playersHere = players.filter((p) => p.pos === i);
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: x,
                top: y,
                width: 30,
                height: 30,
                borderRadius: 8,
                background: meta.color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                border: "1.5px solid var(--card)",
                boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
              }}
              title={meta.label}
            >
              {meta.icon}
              {playersHere.map((p, pi) => (
                <div
                  key={p.id}
                  style={{
                    position: "absolute",
                    top: -10 - pi * 4,
                    right: -6 - pi * 4,
                    fontSize: 16,
                    filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))",
                    transition: "all .4s cubic-bezier(.2,.8,.2,1)",
                  }}
                >
                  {p.emoji}
                </div>
              ))}
            </div>
          );
        })}
        <div
          style={{
            position: "absolute",
            left: boardCenter - 55,
            top: boardCenter - 55,
            width: 110,
            height: 110,
            borderRadius: "50%",
            background: "var(--card)",
            border: "1px solid var(--line)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: 8,
          }}
        >
          <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "Kanit" }}>ตาของ</div>
          <div style={{ fontFamily: "Kanit", fontWeight: 800, fontSize: 15 }}>
            {currentPlayer.emoji} {currentPlayer.name}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginBottom: 16 }}>
        {(Object.keys(TILE_META) as TileType[]).map((t) => (
          <span key={t} className="badge" style={{ background: TILE_META[t].color, color: "#fff" }}>
            {TILE_META[t].icon} {TILE_META[t].label}
          </span>
        ))}
      </div>

      {!activeTask ? (
        <>
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <div
              style={{
                fontFamily: "Kanit",
                fontWeight: 900,
                fontSize: 56,
                color: "var(--gold)",
              }}
            >
              🎲 {dieFace}
            </div>
          </div>
          <button className="btn" onClick={rollDice} disabled={rolling}>
            {rolling ? "กำลังทอย..." : `ทอยเต๋า (${currentPlayer.name})`}
          </button>
        </>
      ) : (
        <div className="reveal show" key={activeTask.text}>
          <div className="verdict ok">
            {TILE_META[activeTask.type].icon} {TILE_META[activeTask.type].label} —{" "}
            {currentPlayer.name}
          </div>
          <div>{activeTask.text}</div>
          <button className="btn" style={{ marginTop: 14 }} onClick={nextTurn}>
            เสร็จแล้ว ผู้เล่นถัดไป →
          </button>
        </div>
      )}

      <SafetyBanner />
    </div>
  );
}
