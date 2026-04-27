const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const fs = require('fs');

// ============================================
// 입력 검증 유틸리티
// ============================================
function validateUsername(username) {
  if (!username || typeof username !== 'string') return '익명';
  return username.slice(0, 50).trim() || '익명';
}

function validateAmount(amount) {
  const num = parseInt(amount, 10);
  return isNaN(num) || num < 0 ? 0 : Math.min(num, 10000000);
}

function validateMessage(message) {
  if (!message || typeof message !== 'string') return '';
  return message.slice(0, 200);
}

// Rate limiting (간단한 구현)
const rateLimits = new Map();
const RATE_LIMIT_WINDOW = 1000; // 1초
const RATE_LIMIT_MAX = 10; // 초당 최대 10개 이벤트

function checkRateLimit(socketId) {
  const now = Date.now();
  const record = rateLimits.get(socketId) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW };

  if (now > record.resetTime) {
    record.count = 1;
    record.resetTime = now + RATE_LIMIT_WINDOW;
  } else {
    record.count++;
  }

  rateLimits.set(socketId, record);
  return record.count <= RATE_LIMIT_MAX;
}

// YouTube API (선택적 - .env 파일이 있을 경우에만)
let youtubeApi = null;
if (fs.existsSync('.env')) {
  try {
    require('dotenv').config();
    youtubeApi = require('./youtube-api');
    console.log('✅ YouTube API 모듈 로드 완료');
  } catch (error) {
    console.log('⚠️ YouTube API 모듈 로드 실패 (시뮬레이션 모드로 실행)');
  }
}

// YouTube Chat Free (API 할당량 없음)
let youtubeChatFree = null;
try {
  youtubeChatFree = require('./youtube-chat-free');
  console.log('✅ YouTube Chat Free 모듈 로드 완료 (할당량 제한 없음)');
} catch (error) {
  console.log('⚠️ YouTube Chat Free 모듈 로드 실패:', error.message);
}

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const PORT = process.env.PORT || 3001;

// 전역 상태
global.youtubeTokens = null;
global.isYoutubeLiveActive = false;
global.currentLiveChatId = null;

// 게임 상태 (클라이언트에서 동기화)
let sharedGameState = {
  pets: [],
  stats: {
    totalSubscribers: 0,
    totalSuperchats: 0,
    totalSuperchatAmount: 0,
    totalPetsEver: 0,
    highestPetLevel: 1
  }
};

// 정적 파일 제공
app.use(express.static(path.join(__dirname, 'public')));

// 메인 페이지
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 관리자 페이지
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// 테스트 페이지
app.get('/test', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'test.html'));
});

// YouTube OAuth 인증 시작
app.get('/auth/youtube', (req, res) => {
  if (!youtubeApi) {
    return res.status(500).send('YouTube API가 설정되지 않았습니다. .env 파일을 확인하세요.');
  }

  const authUrl = youtubeApi.getAuthUrl();
  res.redirect(authUrl);
});

// YouTube OAuth 콜백
app.get('/oauth2callback', async (req, res) => {
  if (!youtubeApi) {
    return res.status(500).send('YouTube API가 설정되지 않았습니다.');
  }

  const code = req.query.code;

  if (!code) {
    return res.status(400).send('인증 코드가 없습니다.');
  }

  try {
    const tokens = await youtubeApi.getTokenFromCode(code);
    global.youtubeTokens = tokens;

    console.log('✅ YouTube 인증 성공!');
    res.send(`
      <html>
        <head>
          <title>인증 완료</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              text-align: center;
              padding: 50px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
            }
            .container {
              background: white;
              color: #333;
              padding: 40px;
              border-radius: 15px;
              max-width: 500px;
              margin: 0 auto;
              box-shadow: 0 10px 40px rgba(0,0,0,0.3);
            }
            h1 { color: #FF69B4; }
            button {
              background: linear-gradient(135deg, #FF69B4, #FF1493);
              color: white;
              border: none;
              padding: 15px 30px;
              font-size: 16px;
              border-radius: 25px;
              cursor: pointer;
              margin-top: 20px;
            }
            button:hover {
              transform: translateY(-2px);
              box-shadow: 0 5px 15px rgba(255, 105, 180, 0.4);
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🎉 YouTube 인증 완료!</h1>
            <p>이제 YouTube 라이브 스트리밍과 연동할 수 있습니다.</p>
            <button onclick="window.close(); window.opener.location.reload();">창 닫기</button>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('❌ YouTube 인증 실패:', error);
    res.status(500).send('인증 실패: ' + error.message);
  }
});

// YouTube 라이브 채팅 폴링
let pollingInterval = null;
let lastPageToken = null;

async function startYouTubeLiveChatPolling(videoId) {
  if (!youtubeApi || !global.youtubeTokens) {
    console.error('❌ YouTube API가 인증되지 않았습니다');
    return false;
  }

  try {
    // 토큰 설정
    youtubeApi.setCredentials(global.youtubeTokens);

    // 라이브 채팅 ID 가져오기
    const liveChatId = await youtubeApi.getLiveChatId(videoId);

    if (!liveChatId) {
      console.error('❌ 라이브 채팅 ID를 찾을 수 없습니다');
      return false;
    }

    global.currentLiveChatId = liveChatId;
    global.isYoutubeLiveActive = true;

    console.log('✅ 라이브 채팅 폴링 시작:', liveChatId);

    // 기존 폴링 중지
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }

    // 폴링 함수
    async function poll() {
      if (!global.isYoutubeLiveActive) return;

      try {
        const result = await youtubeApi.pollLiveChatMessages(liveChatId, lastPageToken);

        if (!result) return;

        lastPageToken = result.nextPageToken;

        // 새 메시지 처리
        result.messages.forEach(message => {
          const username = message.authorDetails.displayName;
          const text = message.snippet.displayMessage || '';

          // 구독/멤버십 감지
          if (youtubeApi.detectSubscription(message)) {
            console.log('📺 구독/멤버십:', username);
            io.emit('new-subscribe', {
              username: username,
              timestamp: Date.now()
            });
          }

          // 슈퍼챗 감지
          if (youtubeApi.detectSuperChat(message)) {
            const amount = youtubeApi.getSuperChatAmount(message);
            console.log('💰 슈퍼챗:', username, amount);
            io.emit('new-superchat', {
              username: username,
              amount: amount,
              message: text,
              timestamp: Date.now()
            });
          }

          // 일반 채팅
          if (message.snippet.type === 'textMessageEvent') {
            console.log('💬 채팅:', username, text);

            // "시작" 키워드로 펫 생성
            const trimmedText = text.trim().toLowerCase();
            if (trimmedText === '시작' || trimmedText.includes('시작')) {
              console.log('🎮 시작 명령 감지:', username, '원본:', text);
              io.emit('chat-start-pet', {
                username: username,
                timestamp: Date.now()
              });
            }

            // "제거" 키워드로 자기 펫 삭제
            if (trimmedText === '제거' || trimmedText.includes('제거')) {
              console.log('🗑️ 제거 명령 감지:', username, '원본:', text);
              io.emit('chat-remove-pet', {
                username: username,
                timestamp: Date.now()
              });
            }

            io.emit('new-chat', {
              username: username,
              message: text,
              timestamp: Date.now()
            });
          }
        });

        // 다음 폴링 예약
        setTimeout(poll, result.pollingIntervalMillis);
      } catch (error) {
        console.error('❌ 폴링 오류:', error);
        // 오류 발생 시 5초 후 재시도
        setTimeout(poll, 5000);
      }
    }

    // 첫 폴링 시작
    poll();

    return true;
  } catch (error) {
    console.error('❌ YouTube 라이브 폴링 시작 실패:', error);
    return false;
  }
}

function stopYouTubeLiveChatPolling() {
  global.isYoutubeLiveActive = false;
  global.currentLiveChatId = null;
  lastPageToken = null;
  console.log('⏹️ 라이브 채팅 폴링 중지');
}

// ============================================
// YouTube Chat Free (API 할당량 없음)
// ============================================
async function startYouTubeChatFree(videoIdOrUrl) {
  if (!youtubeChatFree) {
    console.error('❌ YouTube Chat Free 모듈이 로드되지 않았습니다');
    return false;
  }

  try {
    // 채팅 메시지 콜백
    const chatCallback = (messageData) => {
      const username = messageData.author;
      const text = messageData.message || '';

      console.log(`💬 [Free] ${messageData.type}:`, username, text);

      // 슈퍼챗
      if (messageData.type === 'superchat') {
        io.emit('new-superchat', {
          username: username,
          amount: messageData.amount || 0,
          message: text,
          timestamp: Date.now()
        });
      }

      // 멤버십 (새 멤버)
      if (messageData.type === 'membership') {
        io.emit('new-subscribe', {
          username: username,
          timestamp: Date.now()
        });
      }

      // 일반 채팅
      if (messageData.type === 'chat' || messageData.type === 'superchat') {
        // "시작" 키워드로 펫 생성
        const trimmedText = text.trim();
        if (trimmedText === '시작' || trimmedText.includes('시작')) {
          console.log('🎮 [Free] 시작 명령 감지:', username);
          io.emit('chat-start-pet', {
            username: username,
            timestamp: Date.now()
          });
        }

        // "제거" 키워드로 자기 펫 삭제
        if (trimmedText === '제거' || trimmedText.includes('제거')) {
          console.log('🗑️ [Free] 제거 명령 감지:', username);
          io.emit('chat-remove-pet', {
            username: username,
            timestamp: Date.now()
          });
        }

        io.emit('new-chat', {
          username: username,
          message: text,
          timestamp: Date.now()
        });
      }
    };

    // 채팅 시작
    const result = await youtubeChatFree.startLiveChat(videoIdOrUrl, chatCallback);

    if (result.success) {
      global.isYoutubeLiveActive = true;
      global.currentLiveChatId = result.liveId;
      console.log('✅ YouTube Chat Free 연결 성공:', result.liveId);
      return true;
    }

    return false;
  } catch (error) {
    console.error('❌ YouTube Chat Free 시작 실패:', error);
    return false;
  }
}

function stopYouTubeChatFree() {
  if (youtubeChatFree) {
    youtubeChatFree.stopLiveChat();
  }
  global.isYoutubeLiveActive = false;
  global.currentLiveChatId = null;
  console.log('⏹️ YouTube Chat Free 연결 해제');
}

// Socket.IO 연결
io.on('connection', (socket) => {
  console.log('🔌 새로운 클라이언트 연결:', socket.id);

  // YouTube 상태 전송
  socket.emit('youtube-status', {
    authenticated: !!global.youtubeTokens,
    liveActive: global.isYoutubeLiveActive,
    freeAvailable: !!youtubeChatFree
  });

  // YouTube 라이브 시작
  socket.on('start-youtube-live', async (data) => {
    const videoId = data.videoId;
    console.log('▶️ YouTube 라이브 시작 요청:', videoId);

    const success = await startYouTubeLiveChatPolling(videoId);

    socket.emit('youtube-live-status', {
      success: success,
      message: success ? '라이브 연결 성공!' : '라이브 연결 실패'
    });
  });

  // YouTube 라이브 중지
  socket.on('stop-youtube-live', () => {
    console.log('⏹️ YouTube 라이브 중지 요청');
    stopYouTubeLiveChatPolling();
    stopYouTubeChatFree();

    socket.emit('youtube-live-status', {
      success: true,
      message: '라이브 연결 해제됨'
    });
  });

  // YouTube Chat Free 시작 (API 할당량 없음!)
  socket.on('start-youtube-free', async (data) => {
    const videoId = data.videoId;
    console.log('▶️ YouTube Chat Free 시작 요청:', videoId);

    // 기존 연결 중지
    stopYouTubeLiveChatPolling();
    stopYouTubeChatFree();

    const success = await startYouTubeChatFree(videoId);

    socket.emit('youtube-live-status', {
      success: success,
      message: success ? '🎉 무료 라이브 연결 성공! (할당량 제한 없음)' : '라이브 연결 실패'
    });

    // 모든 클라이언트에게 상태 업데이트 전송
    io.emit('youtube-status', {
      authenticated: !!global.youtubeTokens,
      liveActive: global.isYoutubeLiveActive,
      freeAvailable: !!youtubeChatFree
    });
  });

  // 시청자 입장 시뮬레이션
  socket.on('simulate-viewer-join', (data) => {
    if (!checkRateLimit(socket.id)) return;
    const username = validateUsername(data?.username);
    console.log('👋 시청자 입장 시뮬레이션:', { username });
    io.emit('viewer-join', {
      username,
      timestamp: Date.now()
    });
  });

  // 구독 시뮬레이션
  socket.on('simulate-subscribe', (data) => {
    if (!checkRateLimit(socket.id)) return;
    const username = validateUsername(data?.username);
    console.log('🎮 구독 시뮬레이션:', { username });
    io.emit('new-subscribe', {
      username,
      timestamp: Date.now()
    });
  });

  // 슈퍼챗 시뮬레이션
  socket.on('simulate-superchat', (data) => {
    if (!checkRateLimit(socket.id)) return;
    const username = validateUsername(data?.username);
    const amount = validateAmount(data?.amount);
    const message = validateMessage(data?.message);
    console.log('🎮 슈퍼챗 시뮬레이션:', { username, amount });
    io.emit('new-superchat', {
      username,
      amount: amount || 1000,
      message,
      timestamp: Date.now()
    });
  });

  // 채팅 시뮬레이션
  socket.on('simulate-chat', (data) => {
    if (!checkRateLimit(socket.id)) return;
    const username = validateUsername(data?.username);
    const message = validateMessage(data?.message);
    console.log('🎮 채팅 시뮬레이션:', { username, message });

    // "시작" 키워드로 펫 생성
    const trimmedMsg = message.trim();
    if (trimmedMsg === '시작' || trimmedMsg.includes('시작')) {
      console.log('🎮 시작 명령 (시뮬레이션):', username);
      io.emit('chat-start-pet', {
        username: username,
        timestamp: Date.now()
      });
    }

    // "제거" 키워드로 자기 펫 삭제
    if (trimmedMsg === '제거' || trimmedMsg.includes('제거')) {
      console.log('🗑️ 제거 명령 (시뮬레이션):', username);
      io.emit('chat-remove-pet', {
        username: username,
        timestamp: Date.now()
      });
    }

    io.emit('new-chat', {
      username,
      message,
      timestamp: Date.now()
    });
  });

  // 게임 상태 동기화 (메인 페이지에서 주기적으로 전송)
  socket.on('sync-game-state', (data) => {
    sharedGameState = {
      pets: data.pets || [],
      stats: data.stats || sharedGameState.stats
    };
  });

  // 관리자: 통계 요청
  socket.on('admin-request-stats', () => {
    const stats = sharedGameState.stats || {};
    socket.emit('admin-stats', {
      totalPets: sharedGameState.pets.length,
      viewers: io.engine.clientsCount,
      subscribers: stats.totalSubscribers || 0,
      superchats: stats.totalSuperchats || 0,
      totalSuperchatAmount: stats.totalSuperchatAmount || 0,
      highestLevel: stats.highestPetLevel || 1,
      pets: sharedGameState.pets.map(p => ({
        id: p.id,
        name: p.name,
        emoji: p.emoji,
        level: p.level,
        rarity: p.rarity,
        totalScore: p.totalScore || 0,
        happiness: p.happiness,
        hunger: p.hunger,
        createdBy: p.createdBy,
        isDefault: p.isDefault
      }))
    });
  });

  // 관리자: 설정 저장
  socket.on('admin-save-settings', (settings) => {
    console.log('👑 관리자 설정 저장:', settings);
    io.emit('settings-updated', settings);
  });

  // 관리자: 펫 먹이주기
  socket.on('admin-feed-pet', (data) => {
    console.log('👑 관리자 펫 먹이주기:', data);
    io.emit('admin-feed-pet', data);
  });

  // 관리자: 펫 제거
  socket.on('admin-remove-pet', (data) => {
    console.log('👑 관리자 펫 제거:', data);
    io.emit('admin-remove-pet', data);
  });

  // 관리자: 전체 초기화
  socket.on('admin-reset-pets', () => {
    console.log('👑 관리자 전체 초기화');
    io.emit('admin-reset-pets');
  });

  // 연결 해제
  socket.on('disconnect', () => {
    // Rate limit 레코드 정리
    rateLimits.delete(socket.id);
    console.log('🔌 클라이언트 연결 해제:', socket.id);
  });
});

// 서버 시작
server.listen(PORT, () => {
  console.log(`\n🐾 힐링 펫 팜 서버가 http://localhost:${PORT} 에서 실행 중입니다`);

  if (youtubeApi) {
    console.log(`📺 YouTube 인증: http://localhost:${PORT}/auth/youtube`);
  } else {
    console.log(`⚠️  시뮬레이션 모드 (YouTube API 비활성화)`);
    console.log(`   YouTube API를 사용하려면:`);
    console.log(`   1. .env.example을 .env로 복사`);
    console.log(`   2. YouTube API 인증 정보 입력`);
    console.log(`   3. npm install googleapis dotenv 실행`);
    console.log(`   4. 서버 재시작`);
  }

  console.log(`\n✨ 브라우저에서 http://localhost:${PORT} 를 열어보세요!\n`);
});

// 프로세스 종료 시 정리
process.on('SIGINT', () => {
  console.log('\n\n👋 서버를 종료합니다...');
  stopYouTubeLiveChatPolling();
  stopYouTubeChatFree();
  process.exit(0);
});
