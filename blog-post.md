# YouTube 라이브 시청자와 함께 키우는 "힐링 펫 팜" 개발기

## 프로젝트 소개

"힐링 펫 팜"은 YouTube 라이브 스트리밍 시청자들이 구독, 슈퍼챗, 채팅을 통해 실시간으로 펫을 키우는 인터랙티브 게임입니다. 시청자 참여가 게임에 직접 반영되어, 후원 금액에 따라 다양한 등급의 펫이 부화하고, 채팅 명령어로 펫에게 먹이를 주거나 날씨를 바꿀 수 있습니다.

### 주요 기능

- **시청자 참여형**: 구독/슈퍼챗/채팅 이벤트가 게임에 실시간 반영
- **알 부화 시스템**: 후원 금액별 등급 (Common → Rare → Epic → Legendary → Mythic)
- **AI 자동 행동**: 펫이 스스로 움직이며 먹이를 찾음
- **성장 & 진화**: Lv.10, Lv.20에서 펫 진화
- **환경 변화**: 비, 눈, 밤, 무지개, 파티 등 시각 효과

---

## 기술 스택

### Backend

| 기술 | 버전 | 용도 |
|------|------|------|
| **Node.js** | LTS 14+ | 런타임 환경 |
| **Express.js** | 4.18 | HTTP 서버 프레임워크 |
| **Socket.IO** | 4.6 | 실시간 양방향 통신 (WebSocket) |
| **googleapis** | 118.0 | YouTube Data API v3 통합 |
| **youtube-chat** | 2.2 | YouTube Live Chat 연동 (API 할당량 미사용) |
| **dotenv** | 16.0 | 환경 변수 관리 |

### Frontend

| 기술 | 설명 |
|------|------|
| **HTML5** | 시맨틱 마크업, 이모지 기반 UI |
| **CSS3** | Flexbox, Grid, Keyframe 애니메이션, Glassmorphism |
| **Vanilla JavaScript (ES6+)** | 프레임워크 없이 순수 DOM 조작 |
| **Socket.IO Client** | 서버와 실시간 동기화 |
| **Web Audio API** | 동적 사운드 효과 생성 |
| **localStorage** | 게임 데이터 저장 |

### 외부 API

- **YouTube Data API v3**: 라이브 채팅 메시지 폴링
- **OAuth 2.0**: Google 계정 인증

---

## 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                    YouTube Live Stream                       │
│              (구독, 슈퍼챗, 채팅 메시지 발생)                │
└────────────────────┬────────────────────────────────────────┘
                     │
    ┌────────────────┴────────────────┐
    │                                 │
    ▼                                 ▼
┌─────────────────┐          ┌──────────────────┐
│ YouTube API v3  │          │ youtube-chat     │
│ (OAuth 2.0)     │          │ (할당량 제한없음) │
└────────┬────────┘          └────────┬─────────┘
         │                            │
         └────────────┬───────────────┘
                      ▼
               ┌──────────────────┐
               │  Node.js Server  │
               │  Express.js +    │
               │  Socket.IO       │
               └────────┬─────────┘
                        │ WebSocket
           ┌────────────┴────────────┐
           ▼                         ▼
    ┌──────────────┐         ┌──────────────┐
    │  브라우저     │         │  OBS 소스    │
    │  (게임 플레이)│         │  (스트리밍)  │
    └──────────────┘         └──────────────┘
```

### 데이터 흐름

1. YouTube 라이브에서 이벤트 발생 (구독/슈퍼챗/채팅)
2. 서버에서 이벤트 검증 및 처리
3. Socket.IO로 모든 클라이언트에게 브로드캐스트
4. 클라이언트에서 게임 로직 처리 (펫 생성, 레벨업, 진화 등)
5. DOM 업데이트로 UI 렌더링

---

## 핵심 기능 구현

### 1. 실시간 통신 (Socket.IO)

서버와 클라이언트 간 실시간 양방향 통신을 위해 Socket.IO를 사용했습니다.

```javascript
// server.js - 서버 측
io.on('connection', (socket) => {
  // 슈퍼챗 이벤트 브로드캐스트
  socket.on('simulate-superchat', (data) => {
    io.emit('new-superchat', {
      username: data.username,
      amount: data.amount,
      message: data.message,
      timestamp: Date.now()
    });
  });
});

// game.js - 클라이언트 측
socket.on('new-superchat', (data) => {
  const { rarity, petType } = selectPetByAmount(data.amount);
  createPet(data.username, rarity, petType);
});
```

### 2. 후원 등급 시스템

후원 금액에 따라 펫의 등급이 결정되며, 20% 확률로 한 단계 업그레이드됩니다.

```javascript
function selectPetByAmount(amount) {
  let baseRarity;
  if (amount >= 10000) baseRarity = 4;      // Mythic
  else if (amount >= 5000) baseRarity = 3;  // Legendary
  else if (amount >= 3000) baseRarity = 2;  // Epic
  else if (amount >= 1000) baseRarity = 1;  // Rare
  else baseRarity = 0;                       // Common

  // 20% 확률로 업그레이드
  let finalRarity = baseRarity;
  while (finalRarity < 4 && Math.random() < 0.2) {
    finalRarity++;
  }

  return { rarity: finalRarity, petType: getRandomPet(finalRarity) };
}
```

| 금액 범위 | 최소 등급 | 업그레이드 확률 |
|----------|----------|----------------|
| < 1,000원 | Common | 20%씩 상위 등급 |
| 1K~3K원 | Rare | 20%씩 상위 등급 |
| 3K~5K원 | Epic | 20%씩 상위 등급 |
| 5K~10K원 | Legendary | 20% Mythic |
| 10K+ 원 | Mythic | 100% |

### 3. 펫 AI 시스템

각 펫은 독립적인 AI 루프를 가지며, 배고픔/행복도 상태에 따라 자동으로 행동합니다.

```javascript
function startPetAI(pet) {
  pet.aiInterval = setInterval(() => {
    // 배고픔 증가 (30초마다 5 감소)
    pet.hunger = Math.max(0, pet.hunger - 5);

    // 배고픔에 따른 행동
    if (pet.hunger < 50) {
      const nearestFood = findNearestFood(pet);
      if (nearestFood) {
        moveTowards(pet, nearestFood);
      }
    } else {
      // 랜덤 이동
      pet.targetX = Math.random() * farmWidth;
      pet.targetY = Math.random() * farmHeight;
    }

    // 먹이 충돌 감지
    checkFoodCollision(pet);
  }, 5000);
}
```

**상태별 행동:**

| 상태 | 행동 | 애니메이션 |
|------|------|----------|
| 배고픔 높음 | 음식 찾기 | walk |
| 행복도 낮음 | 칭찬 대기 | idle |
| 일반 | 랜덤 이동 | walk, jump, dance |
| 잠든 상태 | 정지 | sleep |

### 4. 진화 시스템

Lv.10과 Lv.20에서 펫이 진화합니다. 28종의 펫이 각각 고유한 진화 라인을 가집니다.

```javascript
const evolutionSystem = {
  evolutions: {
    '병아리': { 10: '닭', 20: '칠면조' },
    '고양이': { 10: '고양이킹', 20: '사자' },
    '판다': { 10: '곰', 20: '북극곰' },
    // ... 28종 펫
  },

  checkEvolution(pet) {
    const evolution = this.evolutions[pet.name];
    if (!evolution) return;

    if (pet.level === 10 && !pet.evolved10) {
      this.evolve(pet, evolution[10]);
      pet.evolved10 = true;
    } else if (pet.level === 20 && !pet.evolved20) {
      this.evolve(pet, evolution[20]);
      pet.evolved20 = true;
    }
  },

  evolve(pet, newForm) {
    pet.name = newForm;
    pet.emoji = getEmojiForPet(newForm);
    showEvolutionBanner(pet);
    playSound('evolve');
    createParticleEffect(pet.x, pet.y);
  }
};
```

### 5. 채팅 키워드 시스템

40개 이상의 채팅 명령어를 지원합니다. 카테고리별로 구분되어 확장이 용이합니다.

```javascript
const chatKeywords = {
  food: {
    carrot: ['밥', '먹이', 'feed', '배고파'],
    apple: ['좋아요', '❤️', '하트', 'love']
  },
  interaction: {
    pat: ['쓰다듬', '귀여워', 'pat'],
    play: ['놀아줘', 'play', '놀자'],
    jump: ['점프', 'jump', '뛰어'],
    dance: ['춤', 'dance', '춤춰']
  },
  weather: {
    rain: ['비', 'rain', '비와라'],
    snow: ['눈', 'snow', '눈와라'],
    rainbow: ['무지개', 'rainbow']
  },
  event: {
    party: ['파티', 'party', '축제'],
    firework: ['불꽃', 'firework', '폭죽']
  }
};

function handleChat(message) {
  const lowerMessage = message.toLowerCase();

  for (const [category, keywords] of Object.entries(chatKeywords)) {
    for (const [action, words] of Object.entries(keywords)) {
      if (words.some(w => lowerMessage.includes(w))) {
        executeAction(category, action);
        return; // 첫 번째 매칭만 실행
      }
    }
  }
}
```

### 6. 사운드 시스템 (WAV 동적 생성)

외부 사운드 파일 없이 Web Audio API로 효과음을 동적으로 생성합니다.

```javascript
const soundSystem = {
  sounds: {
    hatch: { frequencies: [523, 659, 784], duration: 0.3 },
    eat: { frequencies: [440, 550], duration: 0.15 },
    levelUp: { frequencies: [523, 659, 784, 1047], duration: 0.4 },
    subscribe: { frequencies: [392, 494, 587, 784], duration: 0.4 },
    superchat: { frequencies: [523, 659, 784, 1047], duration: 0.5 },
    evolve: { frequencies: [262, 392, 523, 784], duration: 0.6 }
  },

  generateWav(frequencies, duration, volume = 0.3) {
    const sampleRate = 44100;
    const samples = Math.floor(sampleRate * duration);
    const buffer = new ArrayBuffer(44 + samples * 2);
    const view = new DataView(buffer);

    // WAV 헤더 작성
    this.writeWavHeader(view, samples, sampleRate);

    // 사인파 합성
    for (let i = 0; i < samples; i++) {
      let sample = 0;
      const envelope = Math.min(1, (samples - i) / (sampleRate * 0.1));

      frequencies.forEach(freq => {
        sample += Math.sin(2 * Math.PI * freq * i / sampleRate);
      });

      sample = (sample / frequencies.length) * volume * envelope;
      view.setInt16(44 + i * 2, sample * 32767, true);
    }

    return new Blob([buffer], { type: 'audio/wav' });
  },

  play(soundName) {
    const sound = this.sounds[soundName];
    if (!sound) return;

    const blob = this.generateWav(sound.frequencies, sound.duration);
    const audio = new Audio(URL.createObjectURL(blob));
    audio.volume = this.volume;
    audio.play();
  }
};
```

---

## 성능 최적화

### 1. 이펙트 풀링 (Object Pool Pattern)

DOM 요소 생성/삭제 오버헤드를 줄이기 위해 객체 풀링을 적용했습니다.

```javascript
const effectPool = {
  pool: [],
  active: new Set(),

  acquire() {
    let element = this.pool.pop();
    if (!element) {
      element = document.createElement('div');
    }
    this.active.add(element);
    return element;
  },

  release(element) {
    if (!this.active.has(element)) return;

    element.className = '';
    element.style.cssText = '';
    element.innerHTML = '';

    this.pool.push(element);
    this.active.delete(element);
  },

  releaseAll() {
    this.active.forEach(el => this.release(el));
  }
};
```

### 2. 인터벌 중앙 관리

메모리 누수 방지를 위해 모든 인터벌을 중앙에서 관리합니다.

```javascript
const intervalManager = {
  intervals: new Map(),

  add(id, callback, delay) {
    if (this.intervals.has(id)) {
      this.remove(id);
    }
    const intervalId = setInterval(callback, delay);
    this.intervals.set(id, intervalId);
    return intervalId;
  },

  remove(id) {
    if (this.intervals.has(id)) {
      clearInterval(this.intervals.get(id));
      this.intervals.delete(id);
    }
  },

  clearAll() {
    this.intervals.forEach((intervalId, id) => {
      clearInterval(intervalId);
    });
    this.intervals.clear();
  }
};

// 페이지 언로드 시 정리
window.addEventListener('beforeunload', () => {
  intervalManager.clearAll();
});
```

### 3. DOM 캐시

자주 접근하는 DOM 요소를 미리 캐싱합니다.

```javascript
const domCache = {
  farm: null,
  petsContainer: null,
  foodsContainer: null,
  effectsContainer: null,

  init() {
    this.farm = document.getElementById('farm');
    this.petsContainer = document.getElementById('petsContainer');
    this.foodsContainer = document.getElementById('foodsContainer');
    this.effectsContainer = document.getElementById('effectsContainer');
  }
};

// 초기화 시 한 번만 쿼리
document.addEventListener('DOMContentLoaded', () => {
  domCache.init();
});
```

### 4. 최대 제한 설정

시스템 과부하 방지를 위한 제한을 설정했습니다.

```javascript
const CONFIG = {
  MAX_PETS: 100,        // 최대 펫 수
  MAX_FOODS: 20,        // 필드 위 최대 먹이
  MAX_EFFECTS: 50,      // 최대 이펙트
  MAX_EVENTS: 8,        // 로그 항목
  PET_TIMEOUT: 300000,  // 5분 후 자동 삭제
  AUTO_SAVE_INTERVAL: 300000  // 5분마다 자동 저장
};
```

---

## 보안 고려사항

### 구현된 보안 조치

| 취약점 | 대응 방안 |
|--------|---------|
| **XSS** | `escapeHtml()` 함수로 사용자 입력 이스케이프 |
| **DoS** | Rate Limiting (초당 최대 10 이벤트) |
| **입력 검증** | username(50자), amount(10M), message(200자) 제한 |
| **API 키 노출** | `.env` 파일 `.gitignore`에 등록 |

```javascript
// XSS 방지
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 입력 검증
function validateInput(data) {
  if (typeof data.username !== 'string' || data.username.length > 50) {
    return false;
  }
  if (typeof data.amount === 'number' && data.amount > 10000000) {
    return false;
  }
  if (typeof data.message === 'string' && data.message.length > 200) {
    return false;
  }
  return true;
}

// Rate Limiting
const rateLimiter = new Map();
const RATE_LIMIT = 10; // 초당 최대 이벤트

function checkRateLimit(socketId) {
  const now = Date.now();
  const userEvents = rateLimiter.get(socketId) || [];

  // 1초 이내 이벤트만 유지
  const recentEvents = userEvents.filter(time => now - time < 1000);

  if (recentEvents.length >= RATE_LIMIT) {
    return false;
  }

  recentEvents.push(now);
  rateLimiter.set(socketId, recentEvents);
  return true;
}
```

---

## 프로젝트 구조

```
auto_live/
├── server.js              # Express + Socket.IO 백엔드 (623줄)
├── youtube-api.js         # YouTube API OAuth 통합 (123줄)
├── youtube-chat-free.js   # 무료 라이브 채팅 연동 (110줄)
├── package.json           # 의존성 관리
├── .env                   # 환경 변수 (API 키)
├── .env.example           # 환경 변수 템플릿
├── .gitignore             # Git 제외 파일
├── README.md              # 프로젝트 문서
└── public/
    ├── index.html         # 메인 게임 UI (701줄)
    ├── admin.html         # 관리자 패널
    ├── css/
    │   └── style.css      # 스타일시트 (애니메이션 포함)
    └── js/
        └── game.js        # 핵심 게임 로직 (3,638줄)
```

---

## 사용된 디자인 패턴

| 패턴 | 적용 위치 | 효과 |
|------|----------|------|
| **Singleton** | gameState, soundSystem | 전역 상태 일관성 |
| **Object Pool** | effectPool | 메모리 효율성 |
| **Observer** | Socket.IO 이벤트 | 느슨한 결합 |
| **Factory** | createPet(), selectPetByAmount() | 객체 생성 추상화 |
| **Strategy** | chatKeywords | 확장 가능한 행동 정의 |

---

## 실행 방법

```bash
# 1. 의존성 설치
npm install

# 2. 환경 변수 설정
cp .env.example .env
# .env 파일에 YouTube API 키 입력

# 3. 서버 실행
npm start       # 프로덕션 (http://localhost:3000)
npm run dev     # 개발 (자동 재시작)

# 4. 브라우저 접속
http://localhost:3000
```

---

## 회고 및 배운 점

### 기술적 도전

1. **실시간 동기화**: Socket.IO를 통해 여러 클라이언트 간 게임 상태를 실시간으로 동기화하는 것이 핵심 과제였습니다. 이벤트 기반 아키텍처를 채택하여 느슨한 결합을 유지하면서도 일관된 상태를 보장할 수 있었습니다.

2. **YouTube API 할당량**: YouTube Data API는 일일 할당량 제한이 있어, youtube-chat 라이브러리를 병행 사용하여 API 할당량을 절약했습니다.

3. **성능 최적화**: 100마리 펫 동시 처리를 위해 객체 풀링, 인터벌 중앙 관리, DOM 캐싱 등 다양한 최적화 기법을 적용했습니다.

4. **프레임워크 없는 개발**: React나 Vue 같은 프레임워크 없이 순수 JavaScript로 개발하여 웹 기술의 기본기를 다질 수 있었습니다.

### 개선 가능한 부분

- 이모지 대신 픽셀 아트 스프라이트 적용
- 서버 측 게임 상태 관리 (현재는 클라이언트 localStorage)
- MongoDB 등 데이터베이스 연동으로 영구 저장
- 멀티 스트리머 지원
- 모바일 터치 인터랙션 개선

---

## 마무리

"힐링 펫 팜"은 **프레임워크 없이 순수 JavaScript**로 구현된 실시간 인터랙티브 게임입니다. 이 프로젝트를 통해 WebSocket 통신, 게임 루프, AI 행동, 성능 최적화 등 다양한 웹 개발 개념을 실습할 수 있었습니다.

시청자 참여형 콘텐츠에 관심이 있는 분들께 좋은 레퍼런스가 되길 바랍니다.

---

**GitHub**: [프로젝트 저장소 링크]

**기술 스택**: Node.js, Express, Socket.IO, YouTube API, Vanilla JavaScript
