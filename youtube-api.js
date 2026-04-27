const { google } = require('googleapis');
require('dotenv').config();

const oauth2Client = new google.auth.OAuth2(
  process.env.YOUTUBE_CLIENT_ID,
  process.env.YOUTUBE_CLIENT_SECRET,
  process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:3000/oauth2callback'
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

// 토큰 설정
function setCredentials(tokens) {
  oauth2Client.setCredentials(tokens);
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

// 구독 이벤트 감지
function detectSubscription(message) {
  return message.snippet.type === 'newSponsorEvent' ||
         message.authorDetails.isChatSponsor;
}

// 슈퍼챗 감지
function detectSuperChat(message) {
  return message.snippet.type === 'superChatEvent';
}

// 슈퍼챗 금액 가져오기
function getSuperChatAmount(message) {
  if (message.snippet.type === 'superChatEvent' && message.snippet.superChatDetails) {
    // amountMicros를 원화로 변환 (마이크로 단위 = 1/1,000,000)
    return Math.round(message.snippet.superChatDetails.amountMicros / 1000000);
  }
  return 0;
}

module.exports = {
  oauth2Client,
  getAuthUrl,
  getTokenFromCode,
  setCredentials,
  getLiveStreams,
  getLiveChatId,
  pollLiveChatMessages,
  detectSubscription,
  detectSuperChat,
  getSuperChatAmount
};
