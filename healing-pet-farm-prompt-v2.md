# 🐾 힐링 펫 팜 (Healing Pet Farm) - 개발 프롬프트 v2

## 📋 프로젝트 개요

```
프로젝트명: 힐링 펫 팜 (Healing Pet Farm)
컨셉: YouTube 라이브 시청자와 함께 키우는 힐링 펫 농장 게임
플랫폼: 웹 브라우저 (YouTube Live API 연동)
스타일: 이모지 기반 (추후 픽셀 아트로 교체 가능)
분위기: 따뜻하고 아늑한 힐링 감성
```

---

## 🎯 핵심 목표

1. 시청자 참여형 힐링 컨텐츠
2. 구독/슈퍼챗/채팅이 게임에 직접 영향
3. 펫이 자동으로 움직이며 먹이를 먹는 귀여운 모습
4. 채팅으로 다양한 인터랙션 가능
5. 장시간 틀어놓고 볼 수 있는 잔잔한 게임

---

## 🔗 YouTube Live 연동 스펙

### 감지할 이벤트 (3가지만)

| YouTube 이벤트 | 게임 액션 | 세부 로직 |
|----------------|-----------|-----------|
| **👤 구독** | 🥚 일반 알 생성 | 랜덤 일반~희귀 펫 |
| **💰 슈퍼챗** | 🥚 좋은 알 생성 | 금액별 등급 알 |
| **💬 채팅** | 다양한 인터랙션 | 키워드별 다른 효과 |

### 슈퍼챗 금액별 알 등급

| 금액 | 알 등급 | 펫 종류 |
|------|---------|---------|
| ~999원 | ⚪ 일반 | 병아리, 토끼, 햄스터 |
| 1,000~4,999원 | 🟢 희귀 | 고양이, 강아지, 여우 |
| 5,000~9,999원 | 🔵 레어 | 펭귄, 판다, 유니콘 |
| 10,000~49,999원 | 🟣 에픽 | 드래곤, 피닉스, 백호 |
| 50,000원~ | 🟡 전설 | 황금드래곤, 천사고양이, 무지개유니콘 |

---

## 💬 채팅 인터랙션 시스템 (풍부한 버전)

### 먹이 주기

| 채팅 키워드 | 효과 | 이모지 | 경험치 |
|-------------|------|--------|--------|
| `밥` `먹이` `feed` `냠냠` | 당근 생성 | 🥕 | +5 |
| `좋아요` `❤️` `♥` `하트` `love` | 사과 생성 | 🍎 | +10 |
| `간식` `snack` `맛있는거` | 쿠키 생성 | 🍪 | +8 |
| `고기` `meat` `스테이크` | 고기 생성 | 🍖 | +15 |
| `케이크` `cake` `생일` | 케이크 생성 | 🍰 | +25 |

### 펫 상호작용

| 채팅 키워드 | 효과 | 설명 |
|-------------|------|------|
| `쓰다듬` `pat` `귀여워` `귀엽다` `예뻐` | 💝 행복도 +5 | 모든 펫 하트 이펙트 |
| `놀아줘` `play` `놀자` `공` | 🎾 공 던지기 | 공이 날아가고 펫들이 쫓아감 |
| `불러` `이리와` `come` `모여` | 📢 펫 집합 | 펫들이 화면 중앙으로 모임 |
| `안녕` `hello` `hi` `하이` | 👋 인사 | 펫들이 손(발) 흔듦 |
| `점프` `jump` `뛰어` | 🦘 점프 | 모든 펫이 점프 |
| `춤` `dance` `댄스` | 💃 춤추기 | 펫들이 춤춤 |
| `뽀뽀` `kiss` `쪽` `츄` | 💋 뽀뽀 | 하트 날아가는 이펙트 |

### 환경 변화

| 채팅 키워드 | 효과 | 지속시간 |
|-------------|------|----------|
| `비` `rain` `비와` | 🌧️ 비 내림 | 30초 |
| `눈` `snow` `눈와` | ❄️ 눈 내림 | 30초 |
| `맑음` `sunny` `해` `햇살` | ☀️ 맑은 날씨 | 즉시 |
| `밤` `night` `달` `별` | 🌙 밤으로 변경 | 60초 |
| `무지개` `rainbow` | 🌈 무지개 등장 | 20초 |

### 특별 이벤트

| 채팅 키워드 | 효과 | 설명 |
|-------------|------|------|
| `파티` `party` `축하` `축하해` | 🎉 파티 모드 | 색종이 + 폭죽 이펙트 |
| `불꽃` `firework` `폭죽` | 🎆 불꽃놀이 | 불꽃 터짐 |
| `꽃` `flower` `꽃비` | 🌸 꽃잎 날림 | 벚꽃 이펙트 |
| `하늘` `sky` `풍선` `balloon` | 🎈 풍선 날림 | 풍선 올라감 |
| `선물` `gift` `present` | 🎁 선물상자 | 랜덤 선물상자 떨어짐 |

### 펫 이름 부르기

| 채팅 형식 | 효과 | 예시 |
|-----------|------|------|
| `[펫이름]아` `[펫이름]야` | 해당 펫 반응 | "토끼야" → 토끼 점프 |
| `[펫이름] 이리와` | 해당 펫 앞으로 이동 | "고양이 이리와" |
| `[펫이름] 밥먹어` | 해당 펫에게 먹이 | "강아지 밥먹어" |

### 특수 명령어

| 채팅 키워드 | 효과 | 설명 |
|-------------|------|------|
| `잠` `sleep` `자장가` `굿나잇` | 😴 수면 모드 | 모든 펫 잠듦 (30초) |
| `일어나` `wake` `기상` `아침` | ⏰ 기상 | 잠든 펫 깨움 |
| `사진` `photo` `찰칵` `📸` | 📸 스크린샷 모드 | 펫들 정렬 + 포즈 |
| `랜덤` `random` `뽑기` | 🎲 랜덤 이벤트 | 랜덤 효과 발생 |

---

## 🐣 펫 시스템

### 등급 및 종류

#### ⚪ 일반 (Common) - 구독 또는 슈퍼챗 ~999원
```javascript
const commonPets = [
  { emoji: '🐣', name: '병아리' },
  { emoji: '🐥', name: '아기병아리' },
  { emoji: '🐰', name: '토끼' },
  { emoji: '🐹', name: '햄스터' },
  { emoji: '🐭', name: '쥐' },
  { emoji: '🦔', name: '고슴도치' },
  { emoji: '🐸', name: '개구리' },
  { emoji: '🐢', name: '거북이' }
];
```

#### 🟢 희귀 (Rare) - 슈퍼챗 1,000~4,999원
```javascript
const rarePets = [
  { emoji: '🐱', name: '고양이' },
  { emoji: '🐶', name: '강아지' },
  { emoji: '🦊', name: '여우' },
  { emoji: '🐻', name: '곰' },
  { emoji: '🐨', name: '코알라' },
  { emoji: '🦝', name: '너구리' },
  { emoji: '🐷', name: '돼지' },
  { emoji: '🐮', name: '소' }
];
```

#### 🔵 레어 (Epic) - 슈퍼챗 5,000~9,999원
```javascript
const epicPets = [
  { emoji: '🐼', name: '판다' },
  { emoji: '🐧', name: '펭귄' },
  { emoji: '🦁', name: '사자' },
  { emoji: '🐯', name: '호랑이' },
  { emoji: '🦄', name: '유니콘' },
  { emoji: '🦢', name: '백조' },
  { emoji: '🦩', name: '플라밍고' },
  { emoji: '🦚', name: '공작' }
];
```

#### 🟣 에픽 (Legendary) - 슈퍼챗 10,000~49,999원
```javascript
const legendaryPets = [
  { emoji: '🐲', name: '드래곤' },
  { emoji: '🐉', name: '용' },
  { emoji: '🦅', name: '독수리' },
  { emoji: '🔥', name: '피닉스' },
  { emoji: '⭐', name: '별토끼' },
  { emoji: '🌙', name: '달토끼' }
];
```

#### 🟡 전설 (Mythic) - 슈퍼챗 50,000원~
```javascript
const mythicPets = [
  { emoji: '👑🐱', name: '황제고양이' },
  { emoji: '✨🐲', name: '황금드래곤' },
  { emoji: '🌈🦄', name: '무지개유니콘' },
  { emoji: '👼', name: '천사' },
  { emoji: '💎🐰', name: '다이아토끼' }
];
```

### 펫 데이터 구조

```javascript
const petSchema = {
  id: "unique_id",
  name: "철수님의 토끼",      // 후원자/구독자 이름 + 펫 종류
  emoji: "🐰",
  rarity: "common",          // common, rare, epic, legendary, mythic
  level: 1,
  exp: 0,
  maxExp: 100,
  happiness: 100,            // 0~100
  hunger: 100,               // 0~100 (배고픔)
  x: 0,
  y: 0,
  targetX: null,             // 이동 목표
  targetY: null,
  state: "idle",             // idle, walking, eating, sleeping, playing, dancing
  direction: "right",        // left, right
  lastFed: "timestamp",
  createdAt: "timestamp",
  createdBy: "후원자닉네임"
};
```

### 펫 행동 AI

```javascript
// 상태 전이 확률
const stateTransitions = {
  idle: {
    duration: [2000, 5000],  // 2~5초
    next: {
      walking: 0.5,          // 50% 이동
      playing: 0.2,          // 20% 놀기
      sleeping: 0.1,         // 10% 잠자기
      idle: 0.2              // 20% 계속 대기
    }
  },
  walking: {
    duration: [1000, 3000],
    next: {
      idle: 0.6,
      eating: 0.3,           // 먹이가 있으면
      walking: 0.1
    }
  },
  eating: {
    duration: [1000, 2000],
    next: { idle: 1.0 }
  },
  playing: {
    duration: [2000, 4000],
    next: { idle: 1.0 }
  },
  sleeping: {
    duration: [5000, 15000],
    next: { idle: 1.0 }
  },
  dancing: {
    duration: [3000, 5000],
    next: { idle: 1.0 }
  }
};
```

### 성장 시스템

```javascript
// 레벨업 필요 경험치
const getRequiredExp = (level) => level * 50 + 50;

// 레벨별 외형 변화
const levelEffects = {
  1: { suffix: '', effect: null },
  2: { suffix: '', effect: null },
  3: { suffix: '', effect: null },
  4: { suffix: '✨', effect: 'sparkle' },
  5: { suffix: '✨', effect: 'sparkle' },
  6: { suffix: '⭐', effect: 'star' },
  7: { suffix: '⭐', effect: 'star' },
  8: { suffix: '🌟', effect: 'glow' },
  9: { suffix: '🌟', effect: 'glow' },
  10: { suffix: '👑', effect: 'crown' }  // 최대 레벨
};
```

---

## 🍎 먹이 시스템

### 먹이 종류

| 먹이 | 이모지 | 획득 방법 | 경험치 | 행복도 | 포만감 |
|------|--------|-----------|--------|--------|--------|
| 당근 | 🥕 | 채팅: 밥, feed | +5 | +2 | +10 |
| 사과 | 🍎 | 채팅: 좋아요, ❤️ | +10 | +5 | +15 |
| 쿠키 | 🍪 | 채팅: 간식 | +8 | +8 | +8 |
| 고기 | 🍖 | 채팅: 고기 | +15 | +5 | +25 |
| 케이크 | 🍰 | 채팅: 케이크 | +25 | +15 | +20 |
| 황금사과 | 🌟 | 슈퍼챗 보너스 | +50 | +30 | +30 |

### 먹이 데이터 구조

```javascript
const foodSchema = {
  id: "unique_id",
  type: "carrot",
  emoji: "🥕",
  x: 0,
  y: 0,
  exp: 5,
  happiness: 2,
  satiety: 10,              // 포만감
  createdAt: "timestamp",
  createdBy: "채팅유저닉네임"
};
```

### 먹이 물리 로직

```javascript
// 먹이 생성
function spawnFood(type, username) {
  const food = {
    id: generateId(),
    type: type,
    emoji: foodTypes[type].emoji,
    x: Math.random() * (farmWidth - 40) + 20,
    y: -50,  // 화면 위에서 시작
    targetY: farmHeight - 100 + Math.random() * 50,
    falling: true,
    createdBy: username
  };
  foods.push(food);
}

// 펫이 먹이 감지
function findNearestFood(pet) {
  let nearest = null;
  let minDistance = Infinity;
  
  for (const food of foods) {
    if (food.falling) continue;  // 떨어지는 중인 건 무시
    const dist = distance(pet, food);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = food;
    }
  }
  
  return minDistance < 200 ? nearest : null;  // 200px 이내만
}
```

---

## 🏡 농장 시스템

### 농장 레이아웃

```
┌─────────────────────────────────────────────────────────┐
│     ☁️          ☀️            ☁️                       │ 하늘
│                                            ☁️          │
├─────────────────────────────────────────────────────────┤
│  🌳              🏠🏠              🌳                   │ 배경
│       🌸    🌷         🌻    🌺         🌹             │ 꽃
│                                                         │
│      🐰        🍎      🐱           🐶                  │ 펫+먹이
│           🐹       🥕        🦊            🐣           │ 영역
│     🌸         🐧              🐼      🌷              │
│                                                         │
│   ～～💧～～～～연못～～～～💧～～                      │ 연못
│                                                         │
│  🌱 🌿 🌾 🌱 🌿 🌾 🌱 🌿 🌾 🌱 🌿 🌾 🌱 🌿           │ 잔디
└─────────────────────────────────────────────────────────┘
```

### 농장 데이터 구조

```javascript
const farmSchema = {
  weather: 'sunny',          // sunny, rainy, snowy, night
  timeOfDay: 'day',          // day, night
  decorations: [
    { type: 'tree', x: 50, y: 100, emoji: '🌳' },
    { type: 'flower', x: 120, y: 150, emoji: '🌸' },
    // ...
  ],
  specialEffects: [],        // rainbow, fireworks, petals, etc.
  stats: {
    totalPets: 0,
    totalFeedings: 0,
    totalSubscribers: 0,
    totalSuperchats: 0
  }
};
```

---

## 🎨 UI 디자인

### 메인 화면

```
┌─────────────────────────────────────────────────────────────┐
│  🐾 힐링 펫 팜        │ 👥 시청자: 152 │ 🔴 LIVE │ ⚙️     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                                                             │
│                    [ 농 장   영 역 ]                        │
│                                                             │
│                  (펫들이 돌아다니는 공간)                    │
│                                                             │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  🐾 펫: 12마리 │ ⭐ 평균Lv: 4.2 │ 💝 행복도: 87%          │
│  📦 먹이: 🥕x15 🍎x8 🍪x5 🍖x3 🍰x2 🌟x1                  │
└─────────────────────────────────────────────────────────────┘
```

### 사이드 패널 (이벤트 로그)

```
┌─────────────────────────┐
│  📋 실시간 이벤트       │
├─────────────────────────┤
│  🎉 김철수님 구독!      │
│  → 🐰 토끼 탄생!       │
│─────────────────────────│
│  💬 이영희: "밥"        │
│  → 🥕 당근 등장!       │
│─────────────────────────│
│  💰 박민수님 ₩5,000    │
│  → 🐼 판다 탄생!       │
│─────────────────────────│
│  💬 최지우: "파티"      │
│  → 🎉 파티 시작!       │
│─────────────────────────│
│  💬 정수현: "귀여워"    │
│  → 💝 행복도 UP!       │
└─────────────────────────┘
```

### 알 부화 연출

```
┌─────────────────────────────┐
│                             │
│      🎊  NEW PET!  🎊      │
│                             │
│           🥚               │
│            ↓                │
│          💥🐱💥            │
│                             │
│    "철수님의 고양이"        │
│       ⭐ 희귀 등급 ⭐       │
│                             │
└─────────────────────────────┘
```

---

## 💫 이펙트 & 애니메이션

### 펫 애니메이션

```css
/* 대기 - 둥실둥실 */
@keyframes pet-idle {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

/* 이동 */
@keyframes pet-walk {
  0%, 100% { transform: translateY(0) rotate(-3deg); }
  50% { transform: translateY(-3px) rotate(3deg); }
}

/* 먹기 */
@keyframes pet-eat {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(0.9) translateY(5px); }
}

/* 잠자기 */
@keyframes pet-sleep {
  0%, 100% { transform: scale(1); opacity: 0.8; }
  50% { transform: scale(1.02); opacity: 0.6; }
}

/* 점프 */
@keyframes pet-jump {
  0%, 100% { transform: translateY(0); }
  30% { transform: translateY(-30px); }
  50% { transform: translateY(-35px); }
  70% { transform: translateY(-30px); }
}

/* 춤 */
@keyframes pet-dance {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-15deg) translateY(-5px); }
  75% { transform: rotate(15deg) translateY(-5px); }
}

/* 행복 (하트 이펙트용) */
@keyframes pet-happy {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.2); }
}
```

### 환경 이펙트

```css
/* 비 */
@keyframes rain {
  0% { transform: translateY(-100vh); }
  100% { transform: translateY(100vh); }
}

/* 눈 */
@keyframes snow {
  0% { transform: translateY(-100vh) rotate(0deg); }
  100% { transform: translateY(100vh) rotate(360deg); }
}

/* 벚꽃 */
@keyframes petals {
  0% { transform: translateY(-50px) rotate(0deg) translateX(0); }
  100% { transform: translateY(100vh) rotate(720deg) translateX(100px); }
}

/* 무지개 */
@keyframes rainbow {
  0% { opacity: 0; transform: scale(0.5); }
  50% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(1.1); }
}

/* 폭죽 */
@keyframes firework {
  0% { transform: scale(0); opacity: 1; }
  50% { transform: scale(1); opacity: 1; }
  100% { transform: scale(1.5); opacity: 0; }
}
```

### 알 부화 애니메이션

```css
/* 알 흔들림 */
@keyframes egg-shake {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-10deg); }
  75% { transform: rotate(10deg); }
}

/* 알 깨짐 */
@keyframes egg-hatch {
  0% { transform: scale(1); }
  50% { transform: scale(1.2); }
  100% { transform: scale(0); opacity: 0; }
}

/* 펫 등장 */
@keyframes pet-appear {
  0% { transform: scale(0) rotate(-180deg); opacity: 0; }
  50% { transform: scale(1.3) rotate(10deg); opacity: 1; }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}
```

---

## 🔊 사운드 효과 (선택적)

| 이벤트 | 파일명 | 설명 |
|--------|--------|------|
| 알 부화 | hatch.mp3 | 뽁 + 귀여운 울음소리 |
| 먹이 떨어짐 | drop.mp3 | 통통 |
| 먹기 | munch.mp3 | 냠냠 |
| 레벨업 | levelup.mp3 | 팡파레 |
| 행복 | happy.mp3 | 하트 소리 |
| 파티 | party.mp3 | 짝짝짝 |
| 비 | rain.mp3 | 빗소리 (루프) |

---

## 🗄️ 데이터 저장 구조

### localStorage

```javascript
const saveData = {
  version: "1.0.0",
  lastSaved: "timestamp",
  
  farm: {
    weather: "sunny",
    decorations: []
  },
  
  pets: [
    // petSchema 배열
  ],
  
  foods: [
    // foodSchema 배열 (저장 시 제외해도 됨)
  ],
  
  stats: {
    totalPets: 0,
    totalPetsEver: 0,       // 역대 총 펫 수
    totalFeedings: 0,
    totalSubscribers: 0,
    totalSuperchats: 0,
    totalSuperchatAmount: 0,
    highestPetLevel: 0,
    playTime: 0             // 총 플레이 시간 (초)
  },
  
  settings: {
    soundEnabled: true,
    showEventLog: true,
    showStats: true
  },
  
  achievements: [
    // 도전과제 달성 목록
  ]
};
```

### 자동 저장

```javascript
// 5분마다 자동 저장
setInterval(() => saveGame(), 5 * 60 * 1000);

// 중요 이벤트 시 즉시 저장
function onImportantEvent() {
  saveGame();
}
// - 펫 생성 시
// - 레벨업 시
// - 설정 변경 시
```

---

## 🛠️ 기술 스택

```
Frontend:
├── HTML5
├── CSS3 (애니메이션, Flexbox/Grid)
├── JavaScript (ES6+)
└── Canvas 또는 DOM 기반 렌더링

Backend:
├── Node.js
├── Express.js
└── Socket.IO (실시간 통신)

API:
├── YouTube Data API v3
└── YouTube Live Streaming API (Live Chat)

Optional:
├── Howler.js (사운드)
└── LocalForage (저장)
```

---

## 📅 개발 로드맵

### Phase 1: 기본 프로토타입 ⏱️ 1~2일
```
□ 프로젝트 셋업 (Node.js + Express + Socket.IO)
□ 기본 농장 UI (HTML/CSS)
□ 펫 표시 (이모지)
□ 펫 자동 이동 (랜덤 워킹)
□ 먹이 표시 및 떨어지기
□ 펫이 먹이 찾아가서 먹기
□ 시뮬레이션 버튼 (테스트용)
  - 구독 시뮬레이션 → 알 생성
  - 슈퍼챗 시뮬레이션 → 좋은 알 생성
  - 채팅 시뮬레이션 → 먹이/효과
```

### Phase 2: 채팅 인터랙션 ⏱️ 1일
```
□ 채팅 키워드 파서
□ 먹이 주기 (밥, 좋아요, 간식 등)
□ 펫 상호작용 (쓰다듬기, 놀아주기, 점프 등)
□ 환경 변화 (비, 눈, 밤, 무지개)
□ 특별 이벤트 (파티, 불꽃놀이, 꽃잎)
□ 펫 이름 부르기
```

### Phase 3: YouTube 연동 ⏱️ 2~3일
```
□ Google Cloud Console 설정
□ YouTube API 인증 (OAuth 2.0)
□ 라이브 채팅 읽기
□ 구독 감지
□ 슈퍼챗 감지
□ 실시간 이벤트 → 게임 연결
```

### Phase 4: 성장 시스템 ⏱️ 1일
```
□ 경험치 시스템
□ 레벨업 로직 및 연출
□ 레벨별 외형 변화 (이펙트)
□ 행복도/배고픔 시스템
□ 펫 상태에 따른 행동 변화
```

### Phase 5: 폴리싱 ⏱️ 1~2일
```
□ 알 부화 연출
□ 각종 이펙트 다듬기
□ 이벤트 로그 UI
□ 통계 화면
□ 사운드 추가 (선택)
□ 반응형 디자인
□ 성능 최적화
```

### Phase 6: 이미지 교체 (선택) ⏱️ 추후
```
□ 픽셀 아트 에셋 준비
□ 이모지 → 이미지 교체
□ 스프라이트 애니메이션
□ 배경 이미지 추가
```

---

## 🚀 실행 명령어

```bash
# 의존성 설치
npm install

# 개발 모드 (자동 재시작)
npm run dev

# 프로덕션 모드
npm start

# 브라우저 접속
http://localhost:3000
```

---

## 📝 참고 사항

### YouTube API 주의점
- 일일 할당량: 10,000 유닛
- 채팅 폴링: 3~5초 간격 권장
- 라이브 채팅 ID는 영상마다 다름

### 성능 최적화
- 펫 최대 수: 30마리 권장
- 먹이 최대 수: 20개 (초과 시 오래된 것 삭제)
- 이펙트 동시 표시: 10개 이내

### 저장
- 자동 저장: 5분마다
- 수동 저장: 중요 이벤트 시

---

## ✨ 추후 확장 아이디어

- [ ] 펫 도감 (수집 시스템)
- [ ] 펫 악세서리 (모자, 안경 등)
- [ ] 계절 이벤트 (크리스마스, 할로윈)
- [ ] 미니게임 (펫 레이싱, 숨바꼭질)
- [ ] 시청자 투표 이벤트
- [ ] 멀티 스트리머 농장 방문
- [ ] 펫 교환/선물

---

> **개발 시작 명령:**
> 
> "이 프롬프트를 기반으로 Phase 1부터 개발을 시작해주세요."
