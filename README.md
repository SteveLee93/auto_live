# 🐾 힐링 펫 팜 (Healing Pet Farm)

YouTube 라이브 시청자와 함께 키우는 힐링 펫 농장 게임

![Phase](https://img.shields.io/badge/Phase-5%20Complete-success)
![License](https://img.shields.io/badge/license-MIT-blue)

## 📋 프로젝트 소개

힐링 펫 팜은 YouTube 라이브 스트리밍과 연동되는 인터랙티브 펫 육성 게임입니다. 시청자들의 구독, 슈퍼챗, 채팅이 게임에 직접 영향을 미치며, 귀여운 펫들이 자동으로 돌아다니며 먹이를 먹는 모습을 즐길 수 있습니다.

### 주요 특징

- 🎮 **시청자 참여형**: 구독/슈퍼챗/채팅이 게임에 직접 반영
- 🐣 **알 부화 시스템**: 금액별 다양한 등급의 펫 획득
- 🤖 **AI 자동 행동**: 펫들이 스스로 돌아다니며 먹이를 찾아먹음
- 📈 **성장 시스템**: 경험치, 레벨업, 배고픔, 행복도
- 🌈 **다양한 인터랙션**: 40개 이상의 채팅 키워드 지원
- 🌦️ **날씨 효과**: 비, 눈, 밤, 무지개 등 다양한 환경 변화
- 💾 **자동 저장**: localStorage 기반 자동/수동 저장
- 🎨 **이모지 기반**: 픽셀 아트로 교체 가능한 구조

## 🚀 빠른 시작

### 필수 요구사항

- Node.js 14.0 이상
- npm 6.0 이상

### 설치

```bash
# 저장소 클론 또는 다운로드
cd healing-pet-farm

# 의존성 설치
npm install

# 서버 시작
npm start
```

브라우저에서 `http://localhost:3000` 접속

### 개발 모드 (자동 재시작)

```bash
npm run dev
```

## 🎮 게임 플레이

### 시뮬레이션 모드 (기본)

YouTube API 설정 없이도 테스트 가능:

1. 오른쪽 사이드바에서 시뮬레이션 버튼 사용
2. 구독 버튼 → 펫 생성
3. 슈퍼챗 버튼 → 금액별 다른 등급 펫 생성
4. 채팅 키워드 입력 → 다양한 효과 발생

### YouTube 라이브 연동 모드

YouTube API 설정이 필요합니다. 자세한 내용은 [youtube-api-setup.md](youtube-api-setup.md) 참조

## 💬 채팅 키워드

### 먹이 주기
- `밥`, `먹이`, `feed` → 🥕 당근
- `좋아요`, `❤️`, `하트` → 🍎 사과
- `간식`, `snack` → 🍪 쿠키
- `고기`, `meat` → 🍖 고기
- `케이크`, `cake` → 🍰 케이크

### 상호작용
- `쓰다듬`, `귀여워` → 💝 행복도 증가
- `놀아줘`, `play` → 🎾 공놀이
- `점프`, `jump` → 🦘 점프
- `춤`, `dance` → 💃 춤추기
- `잠`, `sleep` → 😴 수면
- `일어나`, `wake` → ⏰ 기상

### 날씨 효과
- `비`, `rain` → 🌧️ 비 내림 (30초)
- `눈`, `snow` → ❄️ 눈 내림 (30초)
- `밤`, `night` → 🌙 밤 (60초)
- `무지개`, `rainbow` → 🌈 무지개 (20초)
- `맑음`, `sunny` → ☀️ 맑은 날씨

### 특별 이벤트
- `파티`, `party` → 🎉 파티 모드
- `불꽃`, `firework` → 🎆 불꽃놀이
- `꽃`, `flower` → 🌸 벚꽃 이펙트
- `선물`, `gift` → 🎁 황금사과 3개

## 🥚 펫 등급 시스템

| 등급 | 구간 | 펫 종류 | 이모지 |
|------|------|---------|--------|
| ⚪ 일반 | ~999원 | 병아리, 토끼, 햄스터 등 | 🐣🐰🐹 |
| 🟢 희귀 | 1K~4.9K | 고양이, 강아지, 여우 등 | 🐱🐶🦊 |
| 🔵 레어 | 5K~9.9K | 판다, 펭귄, 유니콘 등 | 🐼🐧🦄 |
| 🟣 에픽 | 10K~49.9K | 드래곤, 피닉스 등 | 🐲🔥 |
| 🟡 전설 | 50K~ | 황금드래곤, 천사 등 | ✨👼💎 |

## 📊 Phase 완료 현황

### ✅ Phase 1: 기본 프로토타입
- 프로젝트 셋업 (Node.js + Express + Socket.IO)
- 기본 농장 UI
- 펫 표시 및 자동 이동
- 먹이 시스템
- 시뮬레이션 버튼

### ✅ Phase 2: 채팅 인터랙션
- 먹이 주기 (5종)
- 펫 상호작용 (7종)
- 환경 변화 (5종)
- 특별 이벤트 (4종)

### ✅ Phase 3: YouTube 연동
- YouTube API 설정 가이드
- OAuth 2.0 인증
- 라이브 채팅 폴링
- 구독/슈퍼챗/채팅 감지

### ✅ Phase 4: 성장 시스템
- 경험치 및 레벨업
- 레벨별 외형 변화 (✨⭐🌟👑)
- 배고픔/행복도 자동 감소
- 펫 상태에 따른 행동 변화

### ✅ Phase 5: 폴리싱
- 알 부화 연출 (3초 애니메이션)
- 날씨 이펙트 (비, 눈, 무지개)
- 통계 시스템 강화
- localStorage 저장/불러오기
- 성능 최적화 (최대 펫 수, 먹이 수 제한)
- 반응형 디자인

## 🛠️ 기술 스택

### Frontend
- HTML5
- CSS3 (Flexbox, Grid, Animations)
- Vanilla JavaScript (ES6+)

### Backend
- Node.js
- Express.js
- Socket.IO (실시간 통신)

### API
- YouTube Data API v3
- YouTube Live Streaming API

### 저장소
- localStorage (클라이언트)

## 📁 프로젝트 구조

```
healing-pet-farm/
├── server.js                 # Express + Socket.IO 서버
├── youtube-api.js            # YouTube API 통합
├── package.json              # 프로젝트 설정
├── .env.example              # 환경 변수 예시
├── youtube-api-setup.md      # YouTube API 설정 가이드
├── README.md                 # 이 파일
└── public/
    ├── index.html            # 메인 HTML
    ├── css/
    │   └── style.css         # 스타일시트
    └── js/
        └── game.js           # 게임 로직
```

## 🎨 커스터마이징

### 펫 추가

`public/js/game.js`의 `petData` 객체에 새 펫 추가:

```javascript
const petData = {
  common: [
    { emoji: '🐣', name: '병아리' },
    { emoji: '🐰', name: '토끼' },
    // 여기에 추가
  ],
  // ...
};
```

### 먹이 추가

`foodData` 객체와 `chatKeywords.food`에 추가:

```javascript
const foodData = {
  carrot: { emoji: '🥕', exp: 5, happiness: 2, satiety: 10 },
  // 여기에 추가
};

const chatKeywords = {
  food: {
    carrot: ['밥', '먹이'],
    // 여기에 추가
  }
};
```

### 이모지를 이미지로 교체

CSS에서 `.pet::before` 사용하여 배경 이미지 설정:

```css
.pet[data-type="cat"] {
  background-image: url('/images/pets/cat.png');
  background-size: contain;
}
```

## 🔧 설정

### 환경 변수 (.env)

```env
# YouTube API 설정 (선택)
YOUTUBE_CLIENT_ID=your_client_id
YOUTUBE_CLIENT_SECRET=your_client_secret
YOUTUBE_REDIRECT_URI=http://localhost:3000/oauth2callback

# 서버 설정
PORT=3000
NODE_ENV=development
```

### 게임 설정 (game.js)

```javascript
// 최대 펫 수 제한 (성능)
const MAX_PETS = 30;

// 최대 먹이 수 제한
const MAX_FOODS = 20;

// 배고픔 감소 간격 (밀리초)
const HUNGER_DECREASE_INTERVAL = 30000; // 30초
```

## 📝 개발 로드맵

### Phase 6: 이미지 교체 (선택)
- [ ] 픽셀 아트 에셋 준비
- [ ] 이모지 → 이미지 교체
- [ ] 스프라이트 애니메이션
- [ ] 배경 이미지

### 추후 확장 아이디어
- [ ] 펫 도감 시스템
- [ ] 펫 악세서리 (모자, 안경 등)
- [ ] 계절 이벤트 (크리스마스, 할로윈)
- [ ] 미니게임 (펫 레이싱, 숨바꼭질)
- [ ] 시청자 투표 이벤트
- [ ] 멀티 스트리머 농장 방문
- [ ] 펫 교환/선물 시스템

## 🐛 문제 해결

### 펫이 움직이지 않아요
- 브라우저 콘솔에서 오류 확인
- 페이지 새로고침 (F5)

### 저장이 안 돼요
- 브라우저 localStorage 활성화 확인
- 시크릿 모드에서는 저장이 안 될 수 있음

### YouTube API가 작동하지 않아요
- [youtube-api-setup.md](youtube-api-setup.md) 가이드 참조
- .env 파일 설정 확인
- OAuth 인증 완료 확인

### 성능이 느려요
- 펫 수 제한 (30마리 권장)
- 브라우저 하드웨어 가속 활성화
- 오래된 먹이 자동 삭제 확인

## 🤝 기여

이슈와 풀 리퀘스트는 언제나 환영합니다!

## 📄 라이선스

MIT License

## 👨‍💻 제작

힐링 펫 팜은 YouTube 스트리머들을 위한 인터랙티브 게임입니다.

---

🐾 **즐거운 펫 육성 되세요!** 🐾
# auto_live
