// YouTube Live Chat (무료 - API 할당량 없음)
const { LiveChat } = require('youtube-chat');

let liveChat = null;
let chatCallback = null;

// 라이브 채팅 시작
function startLiveChat(videoIdOrUrl, callback) {
  return new Promise((resolve, reject) => {
    try {
      // 기존 연결 종료
      if (liveChat) {
        liveChat.stop();
        liveChat = null;
      }

      // Video ID 추출
      let videoId = videoIdOrUrl;
      if (videoIdOrUrl.includes('youtube.com') || videoIdOrUrl.includes('youtu.be')) {
        const match = videoIdOrUrl.match(/(?:v=|\/)([\w-]{11})/);
        if (match) videoId = match[1];
      }

      console.log('📺 YouTube 채팅 연결 시도:', videoId);

      // LiveChat 인스턴스 생성
      liveChat = new LiveChat({ liveId: videoId });
      chatCallback = callback;

      // 시작 이벤트
      liveChat.on('start', (liveId) => {
        console.log('✅ YouTube 채팅 연결됨:', liveId);
        resolve({ success: true, liveId });
      });

      // 채팅 메시지 이벤트
      liveChat.on('chat', (chatItem) => {
        if (chatCallback) {
          const messageData = {
            type: 'chat',
            author: chatItem.author.name,
            authorChannelId: chatItem.author.channelId,
            message: chatItem.message.map(m => m.text || '').join(''),
            isMember: chatItem.isMembership || false,
            isOwner: chatItem.isOwner || false,
            isModerator: chatItem.isModerator || false,
            isVerified: chatItem.isVerified || false,
            timestamp: chatItem.timestamp
          };

          // 슈퍼챗 감지
          if (chatItem.superchat) {
            messageData.type = 'superchat';
            messageData.amount = chatItem.superchat.amount;
            messageData.currency = chatItem.superchat.currency;
            messageData.color = chatItem.superchat.color;
          }

          // 멤버십 감지
          if (chatItem.isMembership && chatItem.isNewMember) {
            messageData.type = 'membership';
          }

          chatCallback(messageData);
        }
      });

      // 에러 이벤트
      liveChat.on('error', (err) => {
        console.error('❌ YouTube 채팅 에러:', err.message);
      });

      // 종료 이벤트
      liveChat.on('end', (reason) => {
        console.log('⏹️ YouTube 채팅 종료:', reason);
      });

      // 채팅 시작
      const started = liveChat.start();
      if (!started) {
        reject(new Error('채팅 시작 실패'));
      }

    } catch (error) {
      console.error('❌ YouTube 채팅 시작 실패:', error);
      reject(error);
    }
  });
}

// 라이브 채팅 중지
function stopLiveChat() {
  if (liveChat) {
    liveChat.stop();
    liveChat = null;
    chatCallback = null;
    console.log('⏹️ YouTube 채팅 연결 해제');
  }
}

// 연결 상태 확인
function isConnected() {
  return liveChat !== null;
}

module.exports = {
  startLiveChat,
  stopLiveChat,
  isConnected
};
