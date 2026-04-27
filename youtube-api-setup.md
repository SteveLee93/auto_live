# YouTube API 연동 가이드

## Phase 3: YouTube Live API 연동

이 가이드는 힐링 펫 팜을 실제 YouTube 라이브 스트리밍과 연동하는 방법을 설명합니다.

## 1. Google Cloud Console 설정

### 1.1 프로젝트 생성
1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 새 프로젝트 생성
   - 프로젝트 이름: `Healing Pet Farm`
   - 프로젝트 ID는 자동 생성됩니다

### 1.2 YouTube Data API v3 활성화
1. 프로젝트 선택
2. "API 및 서비스" → "라이브러리"로 이동
3. "YouTube Data API v3" 검색
4. API 활성화 클릭

### 1.3 OAuth 2.0 인증 정보 생성
1. "API 및 서비스" → "사용자 인증 정보"로 이동
2. "사용자 인증 정보 만들기" → "OAuth 클라이언트 ID"
3. 애플리케이션 유형: "웹 애플리케이션"
4. 승인된 리디렉션 URI 추가:
   ```
   http://localhost:3000/oauth2callback
   ```
5. 클라이언트 ID와 클라이언트 보안 비밀번호 저장

### 1.4 동의 화면 구성
1. "OAuth 동의 화면" 탭
2. 사용자 유형: 외부 (또는 내부 - 조직용)
3. 애플리케이션 정보 입력
4. 범위 추가:
   - `https://www.googleapis.com/auth/youtube.readonly`
   - `https://www.googleapis.com/auth/youtube.force-ssl`

## 2. 환경 변수 설정

프로젝트 루트에 `.env` 파일 생성:

```env
# YouTube API 설정
YOUTUBE_CLIENT_ID=your_client_id_here
YOUTUBE_CLIENT_SECRET=your_client_secret_here
YOUTUBE_REDIRECT_URI=http://localhost:3000/oauth2callback

# 서버 설정
PORT=3000
NODE_ENV=development
```

**중요**: `.env` 파일은 절대 공개 저장소에 커밋하지 마세요!

## 3. 필요한 패키지 설치

```bash
npm install googleapis dotenv
```

## 4. YouTube API 통합 코드

`youtube-api.js` 파일 생성 (프로젝트 루트):

```javascript
const { google } = require('googleapis');
require('dotenv').config();

const oauth2Client = new google.auth.OAuth2(
  process.env.YOUTUBE_CLIENT_ID,
  process.env.YOUTUBE_CLIENT_SECRET,
  process.env.YOUTUBE_REDIRECT_URI
);

const youtube = google.youtube({
  version: 'v3',
  auth: oauth2Client
});

// OAuth 인증 URL 생성
function getAuthUrl() {
  const scopes = [
    'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/youtube.force-ssl'
  ];

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes
  });
}

// 인증 코드로 토큰 교환
async function getTokenFromCode(code) {
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  return tokens;
}

// 라이브 스트리밍 정보 가져오기
async function getLiveStreams() {
  try {
    const response = await youtube.liveBroadcasts.list({
      part: 'id,snippet,status',
      broadcastStatus: 'active',
      mine: true
    });

    return response.data.items;
  } catch (error) {
    console.error('라이브 스트림 가져오기 실패:', error);
    return [];
  }
}

// 라이브 채팅 ID 가져오기
async function getLiveChatId(videoId) {
  try {
    const response = await youtube.videos.list({
      part: 'liveStreamingDetails',
      id: videoId
    });

    const video = response.data.items[0];
    return video?.liveStreamingDetails?.activeLiveChatId;
  } catch (error) {
    console.error('채팅 ID 가져오기 실패:', error);
    return null;
  }
}

// 라이브 채팅 메시지 폴링
async function pollLiveChatMessages(liveChatId, pageToken = null) {
  try {
    const response = await youtube.liveChatMessages.list({
      liveChatId: liveChatId,
      part: 'id,snippet,authorDetails',
      pageToken: pageToken
    });

    return {
      messages: response.data.items,
      nextPageToken: response.data.nextPageToken,
      pollingIntervalMillis: response.data.pollingIntervalMillis || 5000
    };
  } catch (error) {
    console.error('채팅 메시지 가져오기 실패:', error);
    return null;
  }
}

// 구독 이벤트 감지 (채팅 메시지 기반)
function detectSubscription(message) {
  // YouTube는 구독 이벤트를 직접 제공하지 않으므로
  // 채팅 메시지에서 "구독" 관련 키워드를 감지하거나
  // authorDetails.isChatSponsor 플래그를 확인합니다
  return message.snippet.type === 'newSponsorEvent' ||
         message.authorDetails.isChatSponsor;
}

// 슈퍼챗 감지
function detectSuperChat(message) {
  return message.snippet.type === 'superChatEvent';
}

// 슈퍼챗 금액 가져오기
function getSuperChatAmount(message) {
  if (message.snippet.type === 'superChatEvent') {
    return message.snippet.superChatDetails?.amountMicros / 1000000; // 마이크로 단위를 원화로 변환
  }
  return 0;
}

module.exports = {
  oauth2Client,
  getAuthUrl,
  getTokenFromCode,
  getLiveStreams,
  getLiveChatId,
  pollLiveChatMessages,
  detectSubscription,
  detectSuperChat,
  getSuperChatAmount
};
```

## 5. 서버에 YouTube API 통합

`server.js`에 YouTube API 통합:

```javascript
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const youtubeApi = require('./youtube-api');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const PORT = process.env.PORT || 3000;

// 정적 파일 제공
app.use(express.static(path.join(__dirname, 'public')));

// OAuth 인증 시작
app.get('/auth/youtube', (req, res) => {
  const authUrl = youtubeApi.getAuthUrl();
  res.redirect(authUrl);
});

// OAuth 콜백
app.get('/oauth2callback', async (req, res) => {
  const code = req.query.code;

  try {
    const tokens = await youtubeApi.getTokenFromCode(code);
    console.log('YouTube 인증 성공!');

    // 토큰을 세션이나 데이터베이스에 저장
    // 여기서는 간단히 메모리에 저장
    global.youtubeTokens = tokens;

    res.redirect('/');
  } catch (error) {
    console.error('인증 실패:', error);
    res.status(500).send('인증 실패');
  }
});

// YouTube 라이브 채팅 폴링 시작
let pollingInterval;
let lastPageToken = null;

async function startYouTubeLiveChatPolling(videoId) {
  const liveChatId = await youtubeApi.getLiveChatId(videoId);

  if (!liveChatId) {
    console.error('라이브 채팅 ID를 찾을 수 없습니다');
    return;
  }

  console.log('라이브 채팅 폴링 시작:', liveChatId);

  async function poll() {
    const result = await youtubeApi.pollLiveChatMessages(liveChatId, lastPageToken);

    if (!result) return;

    lastPageToken = result.nextPageToken;

    // 새 메시지 처리
    result.messages.forEach(message => {
      const username = message.authorDetails.displayName;
      const text = message.snippet.displayMessage;

      // 구독 감지
      if (youtubeApi.detectSubscription(message)) {
        io.emit('new-subscribe', {
          username: username,
          timestamp: Date.now()
        });
      }

      // 슈퍼챗 감지
      if (youtubeApi.detectSuperChat(message)) {
        const amount = youtubeApi.getSuperChatAmount(message);
        io.emit('new-superchat', {
          username: username,
          amount: amount,
          message: text,
          timestamp: Date.now()
        });
      }

      // 일반 채팅
      if (message.snippet.type === 'textMessageEvent') {
        io.emit('new-chat', {
          username: username,
          message: text,
          timestamp: Date.now()
        });
      }
    });

    // 다음 폴링 예약
    setTimeout(poll, result.pollingIntervalMillis);
  }

  poll();
}

// Socket.IO 연결
io.on('connection', (socket) => {
  console.log('새로운 클라이언트 연결:', socket.id);

  // 시뮬레이션 이벤트 (테스트용)
  socket.on('simulate-subscribe', (data) => {
    io.emit('new-subscribe', {
      username: data.username || '익명',
      timestamp: Date.now()
    });
  });

  socket.on('simulate-superchat', (data) => {
    io.emit('new-superchat', {
      username: data.username || '익명',
      amount: data.amount || 1000,
      message: data.message || '',
      timestamp: Date.now()
    });
  });

  socket.on('simulate-chat', (data) => {
    io.emit('new-chat', {
      username: data.username || '익명',
      message: data.message || '',
      timestamp: Date.now()
    });
  });

  // YouTube 라이브 시작 명령
  socket.on('start-youtube-live', async (data) => {
    const videoId = data.videoId;
    await startYouTubeLiveChatPolling(videoId);
  });

  socket.on('disconnect', () => {
    console.log('클라이언트 연결 해제:', socket.id);
  });
});

// 서버 시작
server.listen(PORT, () => {
  console.log(`🐾 힐링 펫 팜 서버가 http://localhost:${PORT} 에서 실행 중입니다`);
  console.log(`YouTube 인증: http://localhost:${PORT}/auth/youtube`);
});
```

## 6. 사용 방법

### 6.1 초기 설정
1. `.env` 파일에 YouTube API 인증 정보 입력
2. `npm install googleapis dotenv` 실행
3. 서버 시작: `npm start`

### 6.2 YouTube 인증
1. 브라우저에서 `http://localhost:3000/auth/youtube` 접속
2. Google 계정으로 로그인 및 권한 승인
3. 자동으로 메인 페이지로 리디렉션

### 6.3 라이브 스트리밍 연결
1. YouTube에서 라이브 스트리밍 시작
2. 비디오 ID 확인 (URL에서 `v=` 뒤의 값)
3. 게임 화면에서 "YouTube Live 연결" 버튼 클릭
4. 비디오 ID 입력

### 6.4 테스트
- 구독 테스트: 시뮬레이션 버튼 사용
- 실제 연동 후: YouTube 라이브 채팅에서 메시지 입력

## 7. API 할당량 주의사항

YouTube Data API v3는 일일 할당량이 있습니다:
- 기본 할당량: 10,000 유닛/일
- liveChatMessages.list: 5 유닛/요청
- 3~5초 간격으로 폴링 권장 (약 17,280~28,800 요청/일)

할당량 초과 시 API 요청이 실패하므로 주의하세요!

## 8. 문제 해결

### 인증 오류
- 클라이언트 ID와 시크릿이 올바른지 확인
- 리디렉션 URI가 정확히 일치하는지 확인
- OAuth 동의 화면이 제대로 구성되었는지 확인

### 채팅 메시지가 안 오는 경우
- 라이브 스트리밍이 활성 상태인지 확인
- 라이브 채팅이 활성화되어 있는지 확인
- 폴링 간격이 너무 길지 않은지 확인

### 할당량 초과
- 폴링 간격을 늘리기 (5초 → 10초)
- Google Cloud Console에서 할당량 증가 요청
- 프로덕션 환경에서는 더 효율적인 방법 고려

## 9. 다음 단계

Phase 3 완료 후:
- Phase 4: 성장 시스템 강화
- Phase 5: UI/UX 폴리싱
- Phase 6: 픽셀 아트 교체 (선택)

## 참고 자료

- [YouTube Data API v3 문서](https://developers.google.com/youtube/v3)
- [OAuth 2.0 가이드](https://developers.google.com/identity/protocols/oauth2)
- [googleapis Node.js 라이브러리](https://github.com/googleapis/google-api-nodejs-client)
