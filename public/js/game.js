// Socket.IO 연결
const socket = io();

// ============================================
// 설정 상수 (Magic Numbers 제거)
// ============================================
const CONFIG = {
  // 게임 설정
  MAX_PETS: 100,
  MAX_EXP: 60,
  HATCH_DURATION: 2500,
  PET_TIMEOUT: 5 * 60 * 1000, // 5분

  // 애니메이션
  EFFECT_DURATION: 1500,
  BUBBLE_DURATION: 2000,
  BANNER_DURATION: 4000,

  // 저장
  AUTO_SAVE_INTERVAL: 5 * 60 * 1000, // 5분
  SYNC_INTERVAL: 2000, // 2초

  // 레벨업
  EXP_PER_LEVEL: 60,
  EVOLUTION_LEVEL_1: 10,
  EVOLUTION_LEVEL_2: 20,

  // 후원 등급
  SUPERCHAT_TIERS: {
    RARE: 1000,
    EPIC: 3000,
    LEGENDARY: 5000,
    MYTHIC: 10000
  }
};

// ============================================
// 기본 펫 데이터
// ============================================
const defaultPetData = [
  { emoji: '🐶', name: '멍멍이', rarity: 'common', color: '#8D6E63' },
  { emoji: '🐱', name: '야옹이', rarity: 'common', color: '#FFB74D' },
  { emoji: '🐰', name: '토순이', rarity: 'rare', color: '#FFCDD2' }
];

// ============================================
// 유틸리티 함수
// ============================================

// XSS 방지를 위한 HTML 이스케이프
function escapeHtml(text) {
  if (typeof text !== 'string') return text;
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 입력값 검증
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

// 게임 상태
const gameState = {
  pets: [],
  foods: [],
  effects: [],
  defaultPets: [], // 기본 펫들 (삭제 안됨)
  deletedPets: {}, // 삭제된 펫 데이터 저장 (유저별) - 재접속 시 복구용
  weather: 'sunny',
  timeOfDay: 'day',
  combo: 0,
  lastFeedTime: 0,
  stats: {
    totalPets: 0,
    totalPetsEver: 0,
    totalFeedings: 0,
    totalSubscribers: 0,
    totalSuperchats: 0,
    totalSuperchatAmount: 0,
    highestPetLevel: 0,
    playTime: 0
  },
  settings: {
    soundEnabled: true,
    soundVolume: 0.5,
    musicEnabled: true,
    musicVolume: 0.3,
    showEventLog: true,
    showStats: true,
    autoSave: true,
    petTimeout: 5 * 60 * 1000 // 5분 후 펫 삭제 (밀리초)
  }
};

// ============================================
// 이펙트 풀링 시스템 (성능 최적화)
// ============================================
const effectPool = {
  pool: [],
  maxPoolSize: 50,
  activeEffects: new Set(),

  acquire() {
    let el = this.pool.pop();
    if (!el) {
      el = document.createElement('div');
    }
    this.activeEffects.add(el);
    return el;
  },

  release(el) {
    if (!el) return;
    this.activeEffects.delete(el);
    el.className = '';
    el.textContent = '';
    el.style.cssText = '';
    if (el.parentNode) {
      el.parentNode.removeChild(el);
    }
    if (this.pool.length < this.maxPoolSize) {
      this.pool.push(el);
    }
  },

  // 모든 활성 이펙트 정리
  clearAll() {
    this.activeEffects.forEach(el => this.release(el));
  }
};

// ============================================
// 인터벌 관리자 (메모리 누수 방지)
// ============================================
const intervalManager = {
  intervals: {},

  set(name, callback, delay) {
    // 기존 인터벌 정리
    if (this.intervals[name]) {
      clearInterval(this.intervals[name]);
    }
    this.intervals[name] = setInterval(callback, delay);
    return this.intervals[name];
  },

  clear(name) {
    if (this.intervals[name]) {
      clearInterval(this.intervals[name]);
      delete this.intervals[name];
    }
  },

  clearAll() {
    Object.keys(this.intervals).forEach(name => {
      clearInterval(this.intervals[name]);
    });
    this.intervals = {};
  }
};

// 페이지 언로드 시 모든 리소스 정리
window.addEventListener('beforeunload', () => {
  intervalManager.clearAll();
  effectPool.clearAll();
  // 펫 AI 인터벌도 정리
  gameState.pets.forEach(pet => {
    if (pet.aiInterval) clearInterval(pet.aiInterval);
  });
});

// ============================================
// DOM 캐시 (성능 최적화)
// ============================================
const DOM = {};

function initDOMCache() {
  DOM.farm = document.getElementById('farm');
  DOM.petsContainer = document.getElementById('petsContainer');
  DOM.foodsContainer = document.getElementById('foodsContainer');
  DOM.effectsContainer = document.getElementById('effectsContainer');
  DOM.rankingList = document.getElementById('rankingList');
  DOM.liveRankingList = document.getElementById('liveRankingList');
  DOM.eventLog = document.getElementById('eventLog');
  DOM.farmEventLog = document.getElementById('farmEventLog');
  DOM.petCount = document.getElementById('petCount');
  DOM.avgLevel = document.getElementById('avgLevel');
  DOM.happiness = document.getElementById('happiness');
  DOM.topScore = document.getElementById('topScore');
}

// ============================================
// 사운드 시스템 (HTML5 Audio 기반 - OBS 호환)
// ============================================
const soundSystem = {
  sounds: {},
  initialized: false,

  // WAV 파일 생성 함수
  generateWav(frequencies, duration, volume = 0.5) {
    const sampleRate = 44100;
    const numSamples = Math.floor(sampleRate * duration);
    const numChannels = 1;
    const bytesPerSample = 2;

    const buffer = new ArrayBuffer(44 + numSamples * bytesPerSample);
    const view = new DataView(buffer);

    // WAV 헤더 작성
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + numSamples * bytesPerSample, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
    view.setUint16(32, numChannels * bytesPerSample, true);
    view.setUint16(34, bytesPerSample * 8, true);
    writeString(36, 'data');
    view.setUint32(40, numSamples * bytesPerSample, true);

    // 오디오 데이터 생성
    for (let i = 0; i < numSamples; i++) {
      let sample = 0;
      const t = i / sampleRate;
      const envelope = Math.min(1, (numSamples - i) / (sampleRate * 0.1)) * Math.min(1, i / (sampleRate * 0.01));

      frequencies.forEach((freq, idx) => {
        const delay = idx * 0.03;
        if (t >= delay) {
          sample += Math.sin(2 * Math.PI * freq * (t - delay)) / frequencies.length;
        }
      });

      sample *= envelope * volume;
      const intSample = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
      view.setInt16(44 + i * bytesPerSample, intSample, true);
    }

    const blob = new Blob([buffer], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
  },

  init() {
    if (this.initialized) return;
    this.initialized = true;

    // 사운드 정의 및 생성
    const soundDefs = {
      hatch: { freq: [523, 659, 784], duration: 0.3 },
      eat: { freq: [440, 550], duration: 0.15 },
      levelUp: { freq: [523, 659, 784, 1047], duration: 0.4 },
      combo: { freq: [330, 440, 550], duration: 0.25 },
      subscribe: { freq: [392, 494, 587, 784], duration: 0.4 },
      superchat: { freq: [523, 659, 784, 1047], duration: 0.5 },
      click: { freq: [880], duration: 0.1 },
      evolve: { freq: [262, 392, 523, 784], duration: 0.6 },
      questComplete: { freq: [523, 659, 784], duration: 0.4 },
      welcome: { freq: [440, 554, 659], duration: 0.3 }
    };

    Object.entries(soundDefs).forEach(([name, def]) => {
      try {
        const url = this.generateWav(def.freq, def.duration, 0.5);
        this.sounds[name] = url;
      } catch (e) {
        console.error(`사운드 생성 실패 (${name}):`, e);
      }
    });

    console.log('🔊 사운드 시스템 초기화됨 (HTML5 Audio)');
  },

  play(soundName, volume = null) {
    if (!gameState.settings.soundEnabled) {
      console.log('🔇 사운드 비활성화됨');
      return;
    }

    const soundUrl = this.sounds[soundName];
    if (!soundUrl) {
      console.log('⚠️ 사운드 없음:', soundName);
      return;
    }

    try {
      const audio = new Audio(soundUrl);
      audio.volume = volume || gameState.settings.soundVolume;

      audio.oncanplaythrough = () => {
        console.log('🔊 오디오 로드됨:', soundName);
      };

      audio.onerror = (e) => {
        console.error('❌ 오디오 로드 실패:', soundName, e);
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          console.log('✅ 재생 시작:', soundName);
        }).catch(e => {
          console.log('🔇 오디오 재생 실패:', soundName, e.message);
        });
      }
    } catch (e) {
      console.error('사운드 재생 오류:', e);
    }
  },

  playMelody(notes, tempo = 200) {
    if (!gameState.settings.soundEnabled) return;
    notes.forEach((note, i) => {
      setTimeout(() => this.play('click'), i * tempo);
    });
  }
};

// ============================================
// 펫 진화 시스템
// ============================================
const evolutionSystem = {
  // 진화 데이터 (레벨별 진화 형태)
  evolutions: {
    // Common 진화
    '🐣': { lv10: '🐓', lv20: '🦃', name10: '닭', name20: '칠면조' },
    '🐥': { lv10: '🐔', lv20: '🦚', name10: '암탉', name20: '공작새' },
    '🐰': { lv10: '🐇', lv20: '🦘', name10: '산토끼', name20: '캥거루' },
    '🐹': { lv10: '🐿️', lv20: '🦫', name10: '다람쥐', name20: '비버' },
    '🐭': { lv10: '🐀', lv20: '🦔', name10: '큰쥐', name20: '고슴도치킹' },
    '🦔': { lv10: '🦡', lv20: '🦝', name10: '오소리', name20: '너구리왕' },
    '🐸': { lv10: '🐊', lv20: '🐉', name10: '악어', name20: '용' },
    '🐷': { lv10: '🐗', lv20: '🦏', name10: '멧돼지', name20: '코뿔소' },

    // Rare 진화
    '🐱': { lv10: '🐈', lv20: '🦁', name10: '고양이킹', name20: '사자' },
    '🐶': { lv10: '🐕', lv20: '🐺', name10: '강아지킹', name20: '늑대' },
    '🦊': { lv10: '🐺', lv20: '🦊', name10: '은여우', name20: '구미호', isSpecial: true },
    '🐻': { lv10: '🐻‍❄️', lv20: '🐼', name10: '북극곰', name20: '판다왕' },
    '🐨': { lv10: '🦥', lv20: '🦘', name10: '나무늘보', name20: '캥거루' },
    '🦝': { lv10: '🦡', lv20: '🦫', name10: '오소리', name20: '비버왕' },
    '🐧': { lv10: '🐦', lv20: '🦅', name10: '펭귄왕', name20: '독수리' },
    '🦦': { lv10: '🦭', lv20: '🐋', name10: '물개', name20: '고래' },

    // Epic 진화
    '🐼': { lv10: '🐻', lv20: '🐻‍❄️', name10: '곰', name20: '빙하곰', isSpecial: true },
    '🦁': { lv10: '🐯', lv20: '👑', name10: '호랑이', name20: '수왕', isSpecial: true },
    '🐯': { lv10: '🐅', lv20: '🐲', name10: '백호', name20: '청룡' },
    '🦄': { lv10: '🎠', lv20: '🌈', name10: '페가수스', name20: '무지개정령' },
    '🦢': { lv10: '🕊️', lv20: '🦅', name10: '비둘기', name20: '피닉스새' },
    '🦉': { lv10: '🦇', lv20: '🐉', name10: '박쥐왕', name20: '드래곤' },
    '🦩': { lv10: '🦜', lv20: '🦚', name10: '앵무새', name20: '공작왕' },
    '🦚': { lv10: '🦃', lv20: '🔥', name10: '칠면조', name20: '피닉스' },

    // Legendary 진화
    '🐲': { lv10: '🐉', lv20: '👑', name10: '용왕', name20: '드래곤로드', isSpecial: true },
    '🔥': { lv10: '☄️', lv20: '🌟', name10: '운석', name20: '별의정령' },
    '🦅': { lv10: '🦉', lv20: '👑', name10: '올빼미왕', name20: '하늘의왕' },
    '🌟': { lv10: '⭐', lv20: '💫', name10: '큰별', name20: '은하' },
    '🌙': { lv10: '🌕', lv20: '🌌', name10: '보름달', name20: '우주' },
    '🦋': { lv10: '🌺', lv20: '🌸', name10: '꽃요정', name20: '봄의정령' },

    // Mythic 진화 (최종 형태만)
    '👑': { lv10: '💎', lv20: '🌌', name10: '다이아왕', name20: '우주황제', isSpecial: true },
    '✨': { lv10: '🌟', lv20: '💫', name10: '별정령', name20: '은하정령' },
    '🌈': { lv10: '🌌', lv20: '✨', name10: '우주', name20: '창조신' },
    '💎': { lv10: '👑', lv20: '🌌', name10: '황제', name20: '영원' },
    '🔮': { lv10: '⚡', lv20: '🌀', name10: '번개마법사', name20: '시공마법사' }
  },

  checkEvolution(pet) {
    const evoData = this.evolutions[pet.emoji];
    if (!evoData) return null;

    if (pet.level >= 20 && evoData.lv20 && !pet.evolved20) {
      return { level: 20, newEmoji: evoData.lv20, newName: evoData.name20, isSpecial: evoData.isSpecial };
    }
    if (pet.level >= 10 && evoData.lv10 && !pet.evolved10) {
      return { level: 10, newEmoji: evoData.lv10, newName: evoData.name10 };
    }

    return null;
  },

  evolve(pet, evolution) {
    const oldEmoji = pet.emoji;
    const oldName = pet.name;

    // 진화 적용
    pet.emoji = evolution.newEmoji;
    pet.name = evolution.newName;

    if (evolution.level === 10) {
      pet.evolved10 = true;
    } else if (evolution.level === 20) {
      pet.evolved20 = true;
    }

    // 진화 보너스
    pet.totalScore = (pet.totalScore || 0) + evolution.level * 10;

    // 진화 이펙트
    this.showEvolutionEffect(pet, oldEmoji, evolution);

    // 퀘스트 업데이트

    // 펫 UI 업데이트
    const petEl = document.getElementById(`pet-${pet.id}`);
    if (petEl) {
      const emojiEl = petEl.querySelector('.pet-emoji');
      if (emojiEl) emojiEl.textContent = pet.emoji;

      const nameEl = petEl.querySelector('.pet-name');
      if (nameEl) {
        const ownerEl = nameEl.querySelector('.pet-owner');
        const petnameEl = nameEl.querySelector('.pet-petname');
        if (ownerEl) ownerEl.textContent = pet.createdBy || '???';
        if (petnameEl) petnameEl.textContent = pet.name;
      }
    }

    soundSystem.play('evolve');
    addLog(`✨ ${pet.createdBy}의 ${oldName}이(가) ${pet.name}(으)로 진화했습니다!`, 'evolve');

    updateRanking();
    saveGame();
  },

  showEvolutionEffect(pet, oldEmoji, evolution) {
    // 진화 배너
    const banner = document.createElement('div');
    banner.className = 'evolution-banner';
    banner.innerHTML = `
      <div class="evolution-content">
        <span class="evolution-old">${oldEmoji}</span>
        <span class="evolution-arrow">→</span>
        <span class="evolution-new">${evolution.newEmoji}</span>
      </div>
      <div class="evolution-text">진화!</div>
      <div class="evolution-name">${evolution.newName}</div>
    `;
    DOM.farm.appendChild(banner);
    setTimeout(() => banner.remove(), 3000);

    // 파티클 이펙트
    const particles = evolution.isSpecial ?
      ['✨', '💫', '⭐', '🌟', '💎', '👑'] :
      ['✨', '⭐', '🌟', '💫'];

    for (let i = 0; i < 20; i++) {
      setTimeout(() => {
        createEffect(
          pet.x + randomRange(-60, 60),
          pet.y + randomRange(-60, 40),
          particles[Math.floor(Math.random() * particles.length)],
          'effect evolution-particle'
        );
      }, i * 50);
    }

    // 펫 글로우 효과
    const petEl = document.getElementById(`pet-${pet.id}`);
    if (petEl) {
      petEl.classList.add('evolving');
      setTimeout(() => petEl.classList.remove('evolving'), 2000);
    }
  }
};

// ============================================
// 디버그 모드 (성능 모니터링)
// ============================================
const debugMode = {
  enabled: false,
  fpsElement: null,
  frameCount: 0,
  lastTime: performance.now(),

  toggle() {
    this.enabled = !this.enabled;
    if (this.enabled) {
      this.createFPSDisplay();
      this.startMonitoring();
      console.log('🔧 디버그 모드 활성화');
    } else {
      this.stopMonitoring();
      console.log('🔧 디버그 모드 비활성화');
    }
  },

  createFPSDisplay() {
    if (this.fpsElement) return;
    this.fpsElement = document.createElement('div');
    this.fpsElement.id = 'fps-display';
    this.fpsElement.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(0,0,0,0.8);
      color: #0f0;
      padding: 8px 12px;
      font-family: monospace;
      font-size: 12px;
      border-radius: 4px;
      z-index: 10000;
    `;
    document.body.appendChild(this.fpsElement);
  },

  startMonitoring() {
    const updateFPS = () => {
      if (!this.enabled) return;
      this.frameCount++;
      const now = performance.now();
      if (now - this.lastTime >= 1000) {
        const fps = Math.round(this.frameCount * 1000 / (now - this.lastTime));
        const petCount = gameState.pets.length;
        const effectCount = effectPool.activeEffects.size;
        if (this.fpsElement) {
          this.fpsElement.innerHTML = `FPS: ${fps}<br>펫: ${petCount}<br>이펙트: ${effectCount}`;
          this.fpsElement.style.color = fps < 30 ? '#f00' : fps < 50 ? '#ff0' : '#0f0';
        }
        this.frameCount = 0;
        this.lastTime = now;
      }
      requestAnimationFrame(updateFPS);
    };
    requestAnimationFrame(updateFPS);
  },

  stopMonitoring() {
    if (this.fpsElement) {
      this.fpsElement.remove();
      this.fpsElement = null;
    }
  }
};

// 전역 노출
window.evolutionSystem = evolutionSystem;
window.soundSystem = soundSystem;
window.debugMode = debugMode;
window.gameState = gameState;
window.effectPool = effectPool;

// 농장 크기
let farmWidth = document.getElementById('farm').offsetWidth;
let farmHeight = document.getElementById('farm').offsetHeight;

// 윈도우 리사이즈 대응
window.addEventListener('resize', () => {
  farmWidth = document.getElementById('farm').offsetWidth;
  farmHeight = document.getElementById('farm').offsetHeight;
});

// 펫 데이터 (이모지 + 색상)
const petData = {
  common: [
    { emoji: '🐣', name: '병아리', color: '#FFD93D' },
    { emoji: '🐥', name: '아기병아리', color: '#FFEB3B' },
    { emoji: '🐰', name: '토끼', color: '#FFCDD2' },
    { emoji: '🐹', name: '햄스터', color: '#FFCC80' },
    { emoji: '🐭', name: '쥐', color: '#E0E0E0' },
    { emoji: '🦔', name: '고슴도치', color: '#A1887F' },
    { emoji: '🐸', name: '개구리', color: '#A5D6A7' },
    { emoji: '🐷', name: '돼지', color: '#F8BBD9' }
  ],
  rare: [
    { emoji: '🐱', name: '고양이', color: '#FFB74D' },
    { emoji: '🐶', name: '강아지', color: '#8D6E63' },
    { emoji: '🦊', name: '여우', color: '#FF7043' },
    { emoji: '🐻', name: '곰', color: '#795548' },
    { emoji: '🐨', name: '코알라', color: '#90A4AE' },
    { emoji: '🦝', name: '너구리', color: '#78909C' },
    { emoji: '🐧', name: '펭귄', color: '#37474F' },
    { emoji: '🦦', name: '수달', color: '#6D4C41' }
  ],
  epic: [
    { emoji: '🐼', name: '판다', color: '#FAFAFA' },
    { emoji: '🦁', name: '사자', color: '#FFA726' },
    { emoji: '🐯', name: '호랑이', color: '#FF9800' },
    { emoji: '🦄', name: '유니콘', color: '#E1BEE7' },
    { emoji: '🦢', name: '백조', color: '#FFFFFF' },
    { emoji: '🦉', name: '부엉이', color: '#8D6E63' },
    { emoji: '🦩', name: '플라밍고', color: '#F48FB1' },
    { emoji: '🦚', name: '공작', color: '#26A69A' }
  ],
  legendary: [
    { emoji: '🐲', name: '드래곤', color: '#66BB6A' },
    { emoji: '🔥', name: '피닉스', color: '#FF5722' },
    { emoji: '🦅', name: '독수리', color: '#5D4037' },
    { emoji: '🌟', name: '별토끼', color: '#FFD700' },
    { emoji: '🌙', name: '달토끼', color: '#B39DDB' },
    { emoji: '🦋', name: '황금나비', color: '#FFC107' }
  ],
  mythic: [
    { emoji: '👑', name: '황제', color: '#FFD700' },
    { emoji: '✨', name: '별의정령', color: '#E1F5FE' },
    { emoji: '🌈', name: '무지개정령', color: 'linear-gradient(45deg, #FF6B6B, #FFE66D, #4ECDC4, #45B7D1, #96E6A1)' },
    { emoji: '💎', name: '다이아몬드', color: '#81D4FA' },
    { emoji: '🔮', name: '마법사', color: '#CE93D8' }
  ]
};

// 먹이 데이터 (경험치 상향)
const foodData = {
  carrot: { emoji: '🥕', exp: 10, happiness: 3, satiety: 15 },
  apple: { emoji: '🍎', exp: 15, happiness: 8, satiety: 20 },
  cookie: { emoji: '🍪', exp: 12, happiness: 12, satiety: 12 },
  meat: { emoji: '🍖', exp: 25, happiness: 8, satiety: 30 },
  cake: { emoji: '🍰', exp: 40, happiness: 20, satiety: 25 },
  fish: { emoji: '🐟', exp: 22, happiness: 10, satiety: 25 },
  cheese: { emoji: '🧀', exp: 18, happiness: 12, satiety: 20 },
  honey: { emoji: '🍯', exp: 20, happiness: 15, satiety: 18 },
  bamboo: { emoji: '🎋', exp: 15, happiness: 10, satiety: 22 },
  dujjeonku: { emoji: '🟤', exp: 20, happiness: 15, satiety: 18 },
  golden: { emoji: '🌟', exp: 80, happiness: 40, satiety: 40 }
};

// 펫별 선호 음식 (선호 음식 먹으면 경험치/행복도 1.5배!)
const petFavoriteFood = {
  '병아리': 'carrot', '아기병아리': 'carrot',
  '토끼': 'carrot', '햄스터': 'cookie',
  '쥐': 'cheese', '고슴도치': 'apple',
  '개구리': 'apple', '돼지': 'meat',
  '고양이': 'fish', '강아지': 'meat',
  '여우': 'meat', '곰': 'honey',
  '코알라': 'bamboo', '너구리': 'apple',
  '펭귄': 'fish', '수달': 'fish',
  '판다': 'bamboo', '사자': 'meat',
  '호랑이': 'meat', '유니콘': 'cake',
  '백조': 'apple', '부엉이': 'meat',
  '플라밍고': 'fish', '공작': 'cookie',
  '드래곤': 'meat', '피닉스': 'golden',
  '독수리': 'meat', '별토끼': 'carrot',
  '달토끼': 'cake', '황금나비': 'honey',
  '황제': 'golden', '별의정령': 'golden',
  '무지개정령': 'cake', '다이아몬드': 'golden',
  '마법사': 'cake'
};

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
  10: { suffix: '👑', effect: 'crown' }
};

// 채팅 키워드 매핑
const chatKeywords = {
  food: {
    carrot: ['밥', '먹이', 'feed', '냠냠', '당근'],
    apple: ['좋아요', '❤️', '♥', '하트', 'love', '사과'],
    cookie: ['간식', 'snack', '맛있는거', '쿠키'],
    meat: ['고기', 'meat', '스테이크'],
    cake: ['케이크', 'cake', '생일'],
    fish: ['생선', 'fish', '물고기', '회'],
    cheese: ['치즈', 'cheese'],
    honey: ['꿀', 'honey', '벌꿀'],
    bamboo: ['대나무', 'bamboo', '죽순'],
    dujjeonku: ['두쫀쿠', '쫀쿠', '두쫀']
  },
  interaction: {
    pat: ['쓰다듬', 'pat', '귀여워', '귀엽다', '예뻐'],
    play: ['놀아줘', 'play', '놀자', '공'],
    call: ['불러', '이리와', 'come', '모여'],
    hello: ['안녕', 'hello', 'hi', '하이'],
    jump: ['점프', 'jump', '뛰어'],
    dance: ['춤', 'dance', '댄스'],
    kiss: ['뽀뽀', 'kiss', '쪽', '츄'],
    sleep: ['잠', 'sleep', '자장가', '굿나잇'],
    wake: ['일어나', 'wake', '기상', '아침']
  },
  weather: {
    rain: ['비', 'rain', '비와'],
    snow: ['눈', 'snow', '눈와'],
    sunny: ['맑음', 'sunny', '해', '햇살'],
    night: ['밤', 'night', '달', '별'],
    rainbow: ['무지개', 'rainbow']
  },
  event: {
    party: ['파티', 'party', '축하', '축하해'],
    firework: ['불꽃', 'firework', '폭죽'],
    flower: ['꽃', 'flower', '꽃비'],
    balloon: ['하늘', 'sky', '풍선', 'balloon'],
    gift: ['선물', 'gift', 'present']
  }
};

// 유틸리티 함수
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

function distance(obj1, obj2) {
  if (!obj1 || !obj2) return Infinity;
  const x1 = obj1.x || 0;
  const y1 = obj1.y || 0;
  const x2 = obj2.x || 0;
  const y2 = obj2.y || 0;
  const dx = x1 - x2;
  const dy = y1 - y2;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return isNaN(dist) ? Infinity : dist;
}

// ============================================
// 환경 효과 시스템
// ============================================

function initEnvironment() {
  // 환경 컨테이너 추가
  let envContainer = document.getElementById('environmentContainer');
  if (!envContainer) {
    envContainer = document.createElement('div');
    envContainer.id = 'environmentContainer';
    document.getElementById('farm').appendChild(envContainer);
  }

  // 나비 추가
  createButterflies();

  // 새 추가
  createBirds();

  // 반짝이 파티클 추가
  createSparkles();

  // 잔디 애니메이션 추가
  animateGrass();
}

function createButterflies() {
  const envContainer = document.getElementById('environmentContainer');
  const butterflies = ['🦋', '🦋', '🦋'];
  const colors = ['#FF69B4', '#87CEEB', '#FFD700'];

  butterflies.forEach((butterfly, i) => {
    const el = document.createElement('div');
    el.className = 'butterfly';
    el.textContent = butterfly;
    el.style.left = `${10 + i * 30}%`;
    el.style.top = `${20 + randomRange(0, 30)}%`;
    el.style.animationDelay = `${i * 5}s`;
    el.style.animationDuration = `${15 + randomRange(0, 10)}s`;
    envContainer.appendChild(el);
  });
}

function createBirds() {
  const envContainer = document.getElementById('environmentContainer');
  const birds = ['🐦', '🕊️'];

  intervalManager.set('birds', () => {
    if (Math.random() < 0.3) {
      const el = document.createElement('div');
      el.className = 'bird';
      el.textContent = birds[Math.floor(Math.random() * birds.length)];
      el.style.left = '-50px';
      el.style.top = `${5 + randomRange(0, 15)}%`;
      el.style.animationDuration = `${15 + randomRange(0, 10)}s`;
      envContainer.appendChild(el);

      setTimeout(() => el.remove(), 25000);
    }
  }, 10000);
}

function createSparkles() {
  const envContainer = document.getElementById('environmentContainer');

  for (let i = 0; i < 15; i++) {
    const el = document.createElement('div');
    el.className = 'sparkle';
    el.textContent = '✨';
    el.style.left = `${randomRange(5, 95)}%`;
    el.style.top = `${randomRange(10, 90)}%`;
    el.style.animationDelay = `${randomRange(0, 3)}s`;
    el.style.animationDuration = `${2 + randomRange(0, 2)}s`;
    envContainer.appendChild(el);
  }
}

function animateGrass() {
  const grassEl = document.querySelector('.grass');
  if (!grassEl) return;

  const grassItems = '🌱 🌿 🌾 🌱 🌿 🌾 🌱 🌿 🌾 🌱 🌿 🌾 🌱 🌿 🌾 🌱 🌿 🌾'.split(' ');
  grassEl.innerHTML = grassItems.map((item, i) =>
    `<span style="animation-delay: ${i * 0.1}s">${item}</span>`
  ).join(' ');
}

// ============================================
// 펫 시스템
// ============================================

function selectPetByAmount(amount) {
  // 기본 등급 결정
  let minRarity;
  if (amount < 1000) {
    minRarity = 0; // common 이상
  } else if (amount < 3000) {
    minRarity = 1; // rare 이상
  } else if (amount < 5000) {
    minRarity = 2; // epic 이상
  } else if (amount < 10000) {
    minRarity = 3; // legendary 이상
  } else {
    minRarity = 4; // mythic
  }

  // 더 높은 등급 나올 확률 (20% 확률로 한 단계 업)
  const rarityList = ['common', 'rare', 'epic', 'legendary', 'mythic'];
  let finalRarity = minRarity;

  // 최대 신화까지 업그레이드 가능
  while (finalRarity < 4 && Math.random() < 0.2) {
    finalRarity++;
  }

  const rarity = rarityList[finalRarity];
  const pool = petData[rarity];

  return { rarity, petType: pool[Math.floor(Math.random() * pool.length)] };
}

// 알 부화 애니메이션
function hatchEgg(x, y, username, rarity, petType, callback) {
  const eggEmoji = {
    common: '🥚',
    rare: '🥚',
    epic: '🔵',
    legendary: '🟣',
    mythic: '🟡'
  };

  const egg = document.createElement('div');
  egg.className = 'egg';
  egg.style.left = `${x}px`;
  egg.style.top = `${y}px`;
  egg.textContent = eggEmoji[rarity] || '🥚';

  document.getElementById('petsContainer').appendChild(egg);

  // 2.5초 후 부화
  setTimeout(() => {
    egg.style.animation = 'egg-hatch 0.6s forwards';

    // 부화 사운드 효과
    soundSystem.play('hatch');

    // 부화 폭발 이펙트
    const explosion = document.createElement('div');
    explosion.className = 'hatch-explosion';
    explosion.style.left = `${x + 30}px`;
    explosion.style.top = `${y + 30}px`;
    document.getElementById('effectsContainer').appendChild(explosion);

    setTimeout(() => {
      egg.remove();
      explosion.remove();

      if (callback) callback();

      // 부화 축하 이펙트
      const celebEmojis = ['✨', '🎉', '⭐', '💫', '🌟'];
      for (let i = 0; i < 8; i++) {
        setTimeout(() => {
          createEffect(
            x + randomRange(-50, 50),
            y + randomRange(-50, 50),
            celebEmojis[Math.floor(Math.random() * celebEmojis.length)],
            'effect party'
          );
        }, i * 80);
      }
    }, 600);
  }, 2500);
}

// 펫 생성
function createPet(username, rarity, petType, withHatch = false, isSuperchat = false, amount = 0) {
  const x = randomRange(100, farmWidth - 100);
  const y = randomRange(180, farmHeight - 180);

  if (withHatch) {
    hatchEgg(x, y, username, rarity, petType, () => {
      const pet = createPetDirect(username, rarity, petType, x, y, isSuperchat);
      pet.superchatAmount = amount;
      addLog(`🎊 ${pet.createdBy}의 ${pet.name}이(가) 부화했습니다!`, 'subscribe');
    });
  } else {
    const pet = createPetDirect(username, rarity, petType, x, y, isSuperchat);
    pet.superchatAmount = amount;
    return pet;
  }
}

// 희귀도별 경험치 배율
const rarityMultiplier = {
  common: 1.0,
  rare: 1.5,
  epic: 2.0,
  legendary: 3.0,
  mythic: 5.0
};

// 희귀도별 이동속도 (빠르게 조정)
const raritySpeed = {
  common: 3.0,
  rare: 3.5,
  epic: 4.0,
  legendary: 5.0,
  mythic: 6.0
};

function createPetDirect(username, rarity, petType, x, y, isSuperchat = false) {
  const pet = {
    id: generateId(),
    name: petType.name,
    emoji: petType.emoji,
    color: petType.color || '#FFD93D',
    rarity: rarity,
    level: 1,
    exp: 0,
    maxExp: 60, // 빠른 첫 레벨업
    happiness: 100,
    hunger: 100,
    x: x,
    y: y,
    targetX: null,
    targetY: null,
    state: 'idle',
    direction: 'right',
    bubble: null,
    bubbleTimer: null,
    lastFed: Date.now(),
    createdAt: Date.now(),
    createdBy: username,
    isSuperchat: isSuperchat,
    superchatAmount: 0,
    totalScore: 0
  };

  gameState.pets.push(pet);
  gameState.stats.totalPets++;
  gameState.stats.totalPetsEver++;

  renderPet(pet);
  updateStats();
  updateRanking();
  petAI(pet);

  return pet;
}

function removePetById(petId) {
  // 기본 펫은 삭제 불가
  const pet = gameState.pets.find(p => p.id === petId);
  if (pet && pet.isDefault) return;

  gameState.pets = gameState.pets.filter(p => p.id !== petId);
  const petEl = document.getElementById(`pet-${petId}`);
  if (petEl) petEl.remove();
}

// 펫 색상 가져오기
function getPetColor(pet) {
  // 펫의 색상 정보가 있으면 사용
  if (pet.color) return pet.color;

  // 없으면 petData에서 찾기
  const pool = petData[pet.rarity];
  if (pool) {
    const petInfo = pool.find(p => p.emoji === pet.emoji);
    if (petInfo && petInfo.color) return petInfo.color;
  }

  // 기본 색상 (희귀도별)
  const defaultColors = {
    common: '#FFD93D',
    rare: '#4FC3F7',
    epic: '#BA68C8',
    legendary: '#FFB74D',
    mythic: '#FFD700'
  };
  return defaultColors[pet.rarity] || '#FFD93D';
}

// 펫 렌더링
function renderPet(pet) {
  const petEl = document.createElement('div');
  let className = `pet idle rarity-${pet.rarity}`;
  if (pet.isSuperchat) {
    className += ' superchat-pet';
  }
  petEl.className = className;
  petEl.id = `pet-${pet.id}`;
  petEl.style.left = `${pet.x}px`;
  petEl.style.top = `${pet.y}px`;

  // 펫 색상 적용
  const petColor = getPetColor(pet);
  petEl.style.setProperty('--pet-color', petColor);

  const ownerName = pet.createdBy || '???';
  const displayName = pet.name;
  const totalLen = ownerName.length + displayName.length;
  const sizeClass = totalLen > 20 ? (totalLen > 28 ? 'very-long-name' : 'long-name') : '';

  petEl.innerHTML = `
    <div class="pet-aura aura-${pet.rarity}"></div>
    <div class="pet-color-glow"></div>
    <div class="pet-status-bars">
      <div class="status-bar-item hunger-bar" title="포만감">
        <span class="bar-icon">🍽️</span>
        <div class="bar-track"><div class="bar-fill" style="width: ${pet.hunger}%"></div></div>
      </div>
    </div>
    <div class="pet-bubble" style="display: none;"></div>
    <div class="pet-emoji">${pet.emoji}</div>
    <div class="pet-level-badge">Lv.${pet.level}</div>
    <div class="pet-name ${sizeClass}">
      <span class="pet-owner">${escapeHtml(ownerName)}</span>
      <span class="pet-petname">${escapeHtml(displayName)}</span>
    </div>
    <div class="pet-rank-badge" style="display: none;"></div>
  `;

  petEl.addEventListener('click', () => onPetClick(pet));
  document.getElementById('petsContainer').appendChild(petEl);
}

// 펫 클릭 이벤트
function onPetClick(pet) {
  pet.happiness = Math.min(100, pet.happiness + 5);

  // 하트 이펙트 여러 개
  for (let i = 0; i < 3; i++) {
    setTimeout(() => {
      createEffect(
        pet.x + randomRange(-20, 20),
        pet.y + randomRange(-30, -10),
        '💝',
        'effect heart'
      );
    }, i * 150);
  }

  // 펫 행복 애니메이션
  const petEl = document.getElementById(`pet-${pet.id}`);
  if (petEl) {
    petEl.classList.add('happy');
    setTimeout(() => petEl.classList.remove('happy'), 500);
  }

  showPetBubble(pet, '💕');
}

// 펫 말풍선 표시
function showPetBubble(pet, content, duration = 2000) {
  const petEl = document.getElementById(`pet-${pet.id}`);
  if (!petEl) return;

  const bubbleEl = petEl.querySelector('.pet-bubble');
  if (!bubbleEl) return;

  // 기존 타이머 클리어
  if (pet.bubbleTimer) {
    clearTimeout(pet.bubbleTimer);
  }

  bubbleEl.textContent = content;
  bubbleEl.style.display = 'block';

  pet.bubbleTimer = setTimeout(() => {
    bubbleEl.style.display = 'none';
    pet.bubble = null;
  }, duration);
}

// 펫 업데이트
function updatePet(pet) {
  const petEl = document.getElementById(`pet-${pet.id}`);
  if (!petEl) return;

  // NaN 방지
  if (isNaN(pet.x) || isNaN(pet.y)) {
    console.warn('⚠️ NaN detected for pet:', pet.name, 'x:', pet.x, 'y:', pet.y);
    pet.x = randomRange(100, farmWidth - 100);
    pet.y = randomRange(180, farmHeight - 180);
    pet.state = 'idle';
    pet.targetX = null;
    pet.targetY = null;
  }

  // 유효한 상태인지 확인
  const validStates = ['idle', 'walking', 'seeking-food', 'eating', 'sleeping', 'dancing'];
  if (!validStates.includes(pet.state)) {
    console.warn('⚠️ Invalid state for pet:', pet.name, 'state:', pet.state);
    pet.state = 'idle';
  }

  petEl.style.left = `${pet.x}px`;
  petEl.style.top = `${pet.y}px`;

  // 방향
  if (pet.direction === 'left') {
    petEl.classList.add('flipped');
  } else {
    petEl.classList.remove('flipped');
  }

  // 상태
  let className = `pet ${pet.state} rarity-${pet.rarity}`;
  if (pet.isSuperchat) className += ' superchat-pet';
  if (pet.direction === 'left') className += ' flipped';
  petEl.className = className;

  // 오라 업데이트
  const auraEl = petEl.querySelector('.pet-aura');
  if (auraEl) {
    auraEl.className = `pet-aura aura-${pet.rarity}`;
  }

  // 상태바 업데이트 (배고픔만)
  const hungerBar = petEl.querySelector('.hunger-bar .bar-fill');
  if (hungerBar) hungerBar.style.width = `${pet.hunger}%`;

  // 레벨 배지 업데이트
  const levelBadge = petEl.querySelector('.pet-level-badge');
  if (levelBadge) levelBadge.textContent = `Lv.${pet.level}`;
}

// 펫 AI
function petAI(pet) {
  const updateInterval = 50; // 더 빠른 반응 (100ms -> 50ms)
  let tickCount = 0;

  const aiInterval = setInterval(() => {
    try {
      tickCount++;
      // 매 60틱(3초)마다 상태 로그
      if (tickCount % 60 === 0) {
        console.log(`🔄 AI tick ${tickCount}: ${pet.name} state=${pet.state} pos=(${Math.round(pet.x)},${Math.round(pet.y)}) hunger=${Math.round(pet.hunger)}`);
      }

      if (!gameState.pets.find(p => p.id === pet.id)) {
        clearInterval(aiInterval);
        return;
      }

      // 상태별 말풍선
      updatePetBubbleState(pet);

      // 배고픔 상태 클래스 적용
      const petEl = document.getElementById(`pet-${pet.id}`);
    if (petEl) {
      if (pet.hunger < 30) {
        petEl.classList.add('hungry');
      } else {
        petEl.classList.remove('hungry');
      }
    }

    switch (pet.state) {
      case 'idle': {
        // 먼저 근처에 먹이가 있으면 바로 먹기
        const nearFood = findNearestFood(pet);
        if (nearFood && distance(pet, nearFood) < 70) {
          console.log('🐾 idle에서 가까운 음식 발견:', pet.name, 'food:', nearFood.id);
          eatFood(pet, nearFood);
          break;
        }

        // 배고프면 적극적으로 먹이 찾기 (확률 대폭 증가)
        let searchChance = 0.1;
        if (pet.hunger < 20) searchChance = 0.8;
        else if (pet.hunger < 40) searchChance = 0.5;
        else if (pet.hunger < 70) searchChance = 0.3;

        // 음식이 있으면 항상 먹으러 감
        if (nearFood) {
          console.log('🐾 seeking-food로 전환:', pet.name, 'target:', nearFood.id);
          pet.state = 'seeking-food';
          pet.targetX = nearFood.x;
          pet.targetY = nearFood.y;
          pet.targetFoodId = nearFood.id;
        } else if (!nearFood && Math.random() < 0.15) {
          pet.state = 'walking';
          pet.targetX = randomRange(80, farmWidth - 80);
          pet.targetY = randomRange(150, farmHeight - 150);
        }

        // 배고프면 조르기
        if (pet.hunger < 30 && Math.random() < 0.03) {
          showPetBubble(pet, '🍽️', 1500);
        }
        break;
      }

      case 'walking': {
        // 걷는 중에 먹이 발견하면 seeking-food로 전환
        const nearFood = findNearestFood(pet);
        if (nearFood) {
          if (distance(pet, nearFood) < 50) {
            eatFood(pet, nearFood);
          } else {
            pet.state = 'seeking-food';
            pet.targetX = nearFood.x;
            pet.targetY = nearFood.y;
            pet.targetFoodId = nearFood.id;
          }
          break;
        }

        if (pet.targetX !== null && pet.targetY !== null) {
          const dx = pet.targetX - pet.x;
          const dy = pet.targetY - pet.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 10) {
            pet.targetX = null;
            pet.targetY = null;
            pet.state = 'idle';
          } else if (dist > 1) {
            const speed = Math.min((raritySpeed[pet.rarity] || 1.5) * 1.5, dist);
            pet.x += (dx / dist) * speed;
            pet.y += (dy / dist) * speed;
            pet.direction = dx > 0 ? 'right' : 'left';
          }
        } else {
          pet.state = 'idle';
        }
        break;
      }

      case 'seeking-food': {
        // 먼저 가까운 먹이 찾기
        const nearFood = findNearestFood(pet);

        // 먹이가 없으면 idle로
        if (!nearFood) {
          pet.state = 'idle';
          pet.targetX = null;
          pet.targetY = null;
          pet.targetFoodId = null;
          break;
        }

        // 가까운 먹이가 있으면 그쪽으로 타겟 업데이트
        pet.targetX = nearFood.x;
        pet.targetY = nearFood.y;
        pet.targetFoodId = nearFood.id;

        const dist = distance(pet, nearFood);

        // 충분히 가까우면 먹기
        if (dist < 50) {
          eatFood(pet, nearFood);
          break;
        }

        // 이동 (0으로 나누기 방지)
        if (dist > 1) {
          const dx = nearFood.x - pet.x;
          const dy = nearFood.y - pet.y;
          const baseSpeed = raritySpeed[pet.rarity] || 1.5;
          const speed = Math.min(baseSpeed * 3.5, dist);

          pet.x += (dx / dist) * speed;
          pet.y += (dy / dist) * speed;
          pet.direction = dx > 0 ? 'right' : 'left';
        }
        break;
      }

      case 'eating':
        // eating 상태가 너무 오래 지속되면 idle로 복구
        if (!pet.eatingStartTime) {
          pet.eatingStartTime = Date.now();
          console.log('⚠️ eating state without startTime, setting now');
        } else if (Date.now() - pet.eatingStartTime > 500) {
          console.log('⚠️ eating timeout recovery:', pet.name, 'elapsed:', Date.now() - pet.eatingStartTime);
          pet.state = 'idle';
          pet.eatingStartTime = null;
        }
        break;

      case 'sleeping':
        if (Math.random() < 0.001) {
          showPetBubble(pet, '💤', 3000);
        }
        break;

      case 'dancing':
        // 춤추는 중 - 가만히 있음 (handleInteraction에서 3초 후 idle로 변경됨)
        break;

      default:
        // 알 수 없는 상태면 idle로 복구
        console.warn('⚠️ Unknown pet state:', pet.state, 'for', pet.name);
        pet.state = 'idle';
        break;
    }

    // 펫끼리 상호작용
    checkPetInteraction(pet);

    updatePet(pet);
    } catch (e) {
      console.error('petAI error:', e);
      pet.state = 'idle';
    }
  }, updateInterval);
}

// 펫 상태별 말풍선
function updatePetBubbleState(pet) {
  if (pet.bubble) return; // 이미 말풍선이 있으면 스킵

  // 배고픔 - 더 자주 표시
  if (pet.hunger < 20 && Math.random() < 0.015) {
    const hungryEmojis = ['😭', '🍽️', '😢', '💭🍖'];
    showPetBubble(pet, hungryEmojis[Math.floor(Math.random() * hungryEmojis.length)], 2500);
    return;
  }

  if (pet.hunger < 40 && Math.random() < 0.008) {
    showPetBubble(pet, '😋?', 2000);
    return;
  }

  // 행복 - 하트 이펙트도 함께
  if (pet.happiness > 85 && pet.hunger > 60 && Math.random() < 0.008) {
    const happyEmojis = ['💕', '♪', '😊', '🥰', '✨'];
    showPetBubble(pet, happyEmojis[Math.floor(Math.random() * happyEmojis.length)], 2000);
    // 가끔 하트 이펙트
    if (Math.random() < 0.3) {
      createEffect(pet.x + randomRange(-20, 20), pet.y - 30, '💗', 'effect heart');
    }
    return;
  }

  // 잠자기
  if (pet.state === 'sleeping' && Math.random() < 0.015) {
    showPetBubble(pet, '💤', 2500);
  }
}

// 펫끼리 상호작용
function checkPetInteraction(pet) {
  if (Math.random() > 0.001) return;

  gameState.pets.forEach(otherPet => {
    if (otherPet.id === pet.id) return;

    const dist = distance(pet, otherPet);
    if (dist < 60) {
      // 서로 하트
      createEffect(
        (pet.x + otherPet.x) / 2,
        (pet.y + otherPet.y) / 2 - 20,
        '💕',
        'effect heart'
      );
    }
  });
}

// 가장 가까운 먹이 찾기
function findNearestFood(pet) {
  let nearest = null;
  let minDist = Infinity;

  for (const food of gameState.foods) {
    if (food.falling) continue;
    const dist = distance(pet, food);
    if (dist < minDist && dist < 500) { // 탐지 범위 확대 (250 -> 500)
      minDist = dist;
      nearest = food;
    }
  }

  // 음식 개수가 있을 때만 로그 (첫 음식 탐지시)
  if (gameState.foods.length > 0 && !nearest) {
    const fallingCount = gameState.foods.filter(f => f.falling).length;
    if (fallingCount === 0 && Math.random() < 0.01) {
      console.log('🔍 음식 탐지 실패:', pet.name, '총 음식:', gameState.foods.length);
    }
  }

  return nearest;
}

// 먹이 먹기
function eatFood(pet, food) {
  console.log('🍴 eatFood 호출:', pet.name, 'food:', food ? food.id : 'null');
  // 이미 먹힌 먹이거나 없는 먹이면 스킵
  if (!food || !gameState.foods.find(f => f.id === food.id)) {
    console.log('❌ 이미 없는 음식');
    pet.state = 'idle';
    return;
  }

  // 배부르면 먹지 않음 (hunger >= 90)
  if (pet.hunger >= 90) {
    console.log('😊 배불러서 안 먹음:', pet.name, 'hunger:', pet.hunger);
    showPetBubble(pet, '😊', 1000);
    pet.state = 'idle';
    // 3초 뒤에 배고프게
    setTimeout(() => {
      if (gameState.pets.find(p => p.id === pet.id)) {
        pet.hunger = Math.max(0, pet.hunger - 30);
        console.log('🍽️ 3초 후 배고파짐:', pet.name, 'hunger:', pet.hunger);
      }
    }, 3000);
    return;
  }

  console.log('✅ 음식 먹기 시작:', pet.name, 'hunger:', pet.hunger);
  pet.state = 'eating';
  pet.eatingStartTime = Date.now();

  // 먹기 사운드 효과
  soundSystem.play('eat');

  // 퀘스트 진행도 업데이트

  // 희귀도별 경험치 배율 적용
  const multiplier = rarityMultiplier[pet.rarity] || 1.0;

  // 선호 음식 체크 (1.5배 보너스!)
  const favoriteFood = petFavoriteFood[pet.name];
  const isFavorite = favoriteFood && food.type === favoriteFood;
  const favoriteBonus = isFavorite ? 1.5 : 1.0;

  const earnedExp = Math.floor(food.exp * multiplier * favoriteBonus);
  const earnedHappiness = Math.floor(food.happiness * favoriteBonus);

  pet.exp += earnedExp;
  pet.happiness = Math.min(100, pet.happiness + earnedHappiness);
  pet.hunger = Math.min(100, pet.hunger + food.satiety);

  // 선호 음식이면 특별 반응
  if (isFavorite) {
    showPetBubble(pet, '😍', 1500);
    createEffect(pet.x, pet.y - 40, '💕 좋아하는 음식!', 'effect favorite-food');
    console.log(`💕 ${pet.name}의 선호 음식! 1.5배 보너스!`);
  }
  pet.lastFed = Date.now();

  // 총 점수 누적
  if (!pet.totalScore) pet.totalScore = 0;
  pet.totalScore += earnedExp;

  // 콤보 시스템
  const now = Date.now();
  if (now - gameState.lastFeedTime < 3000) {
    gameState.combo++;
    if (gameState.combo >= 3) {
      showCombo(gameState.combo);
      // 콤보 보너스 점수
      pet.totalScore += gameState.combo * 2;
    }
  } else {
    gameState.combo = 1;
  }
  gameState.lastFeedTime = now;

  // 레벨업 체크
  if (pet.exp >= pet.maxExp) {
    levelUp(pet);
  }

  removeFoodById(food.id);

  // 귀여운 먹기 반응 (빠르게)
  const petEl = document.getElementById(`pet-${pet.id}`);
  if (petEl) {
    petEl.classList.add('eating-happy');
    setTimeout(() => petEl.classList.remove('eating-happy'), 400);
  }

  // 하트 이펙트 (간소화)
  const hearts = ['💕', '💖', '😋'];
  for (let i = 0; i < 3; i++) {
    setTimeout(() => {
      createEffect(
        pet.x + randomRange(-20, 20),
        pet.y + randomRange(-30, -10),
        hearts[Math.floor(Math.random() * hearts.length)],
        'effect heart-burst'
      );
    }, i * 60);
  }

  // 만족 말풍선
  showPetBubble(pet, '😋', 600);

  setTimeout(() => {
    try {
      // 펫이 아직 존재하는지 확인
      if (!gameState.pets.find(p => p.id === pet.id)) return;

      console.log('✅ 음식 먹기 완료:', pet.name, 'hunger:', pet.hunger);
      pet.state = 'idle';
      pet.eatingStartTime = null;
      // 바로 다음 먹이 찾기
      if (pet.hunger < 80) {
        const nextFood = findNearestFood(pet);
        if (nextFood) {
          console.log('🔄 다음 음식으로 이동:', pet.name, '->', nextFood.id);
          pet.state = 'seeking-food';
          pet.targetX = nextFood.x;
          pet.targetY = nextFood.y;
          pet.targetFoodId = nextFood.id;
        }
      }
    } catch (e) {
      console.error('eatFood callback error:', e);
      pet.state = 'idle';
    }
  }, 150);

  gameState.stats.totalFeedings++;
  updateStats();
  updateRanking();
}

// 콤보 표시
function showCombo(combo) {
  // 콤보 사운드 효과
  soundSystem.play('combo');

  const comboEl = document.createElement('div');
  comboEl.className = 'combo-display';
  comboEl.textContent = `🔥 COMBO x${combo}! 🔥`;
  document.getElementById('farm').appendChild(comboEl);

  setTimeout(() => comboEl.remove(), 2000);
}

// 레벨업 (빠른 성장)
function levelUp(pet) {
  pet.level++;
  pet.exp = 0;
  // 희귀도별 성장 속도 (높을수록 필요 경험치 감소)
  const growthBonus = {
    common: 1.0,
    rare: 0.9,
    epic: 0.8,
    legendary: 0.7,
    mythic: 0.6
  };
  const bonus = growthBonus[pet.rarity] || 1.0;
  pet.maxExp = Math.floor((pet.level * 30 + 30) * bonus); // 기존 50 -> 30으로 감소

  if (pet.level > gameState.stats.highestPetLevel) {
    gameState.stats.highestPetLevel = pet.level;
  }

  // 레벨업 이펙트
  const celebEmojis = ['🎉', '🎊', '⭐', '🌟', '✨', '💫'];
  for (let i = 0; i < 12; i++) {
    setTimeout(() => {
      createEffect(
        pet.x + randomRange(-60, 60),
        pet.y + randomRange(-60, 30),
        celebEmojis[Math.floor(Math.random() * celebEmojis.length)],
        'effect party'
      );
    }, i * 100);
  }

  showPetBubble(pet, '🎉', 3000);
  addLog(`🎉 ${pet.createdBy}의 ${pet.name}이(가) 레벨 ${pet.level}이 되었습니다!`, 'chat');

  // 사운드 이펙트 재생
  soundSystem.play('levelUp');

  // 퀘스트 진행도 업데이트
  
  // 진화 체크 (레벨 10, 20에서 진화)
  evolutionSystem.checkEvolution(pet);

  updateStats();
  updateRanking();
  saveGame();
}

// ============================================
// 먹이 시스템
// ============================================

function spawnFood(type, username) {
  console.log('🍖 spawnFood 호출:', type, username);
  const foodInfo = foodData[type];
  if (!foodInfo) {
    console.log('❌ foodInfo 없음:', type);
    return;
  }

  if (gameState.foods.length >= 20) {
    const oldestFood = gameState.foods[0];
    removeFoodById(oldestFood.id);
  }

  const food = {
    id: generateId(),
    type: type,
    emoji: foodInfo.emoji,
    exp: foodInfo.exp,
    happiness: foodInfo.happiness,
    satiety: foodInfo.satiety,
    x: randomRange(80, farmWidth - 80),
    y: -50,
    targetY: randomRange(150, farmHeight - 150),
    falling: true,
    createdBy: username,
    createdAt: Date.now()
  };

  gameState.foods.push(food);
  console.log('✅ 음식 생성됨:', food.id, 'x:', food.x, 'targetY:', food.targetY);
  renderFood(food);

  setTimeout(() => {
    const foodEl = document.getElementById(`food-${food.id}`);
    if (foodEl) {
      foodEl.style.top = `${food.targetY}px`;
      food.y = food.targetY;
      food.falling = false;
      console.log('✅ 음식 착지:', food.id, 'falling:', food.falling);
    }
  }, 100);
}

function renderFood(food) {
  const foodEl = document.createElement('div');
  foodEl.className = `food falling ${food.type === 'golden' ? 'golden' : ''}`;
  foodEl.id = `food-${food.id}`;
  foodEl.style.left = `${food.x}px`;
  foodEl.style.top = `${food.y}px`;
  foodEl.textContent = food.emoji;

  document.getElementById('foodsContainer').appendChild(foodEl);

  setTimeout(() => {
    if (foodEl) foodEl.classList.remove('falling');
  }, 800);
}

function removeFoodById(foodId) {
  gameState.foods = gameState.foods.filter(f => f.id !== foodId);
  const foodEl = document.getElementById(`food-${foodId}`);
  if (foodEl) foodEl.remove();
}

// ============================================
// 이펙트 시스템
// ============================================

function createEffect(x, y, text, className = 'effect', duration = CONFIG.EFFECT_DURATION) {
  const effectEl = effectPool.acquire();
  effectEl.className = className;
  effectEl.style.left = `${x}px`;
  effectEl.style.top = `${y}px`;
  effectEl.textContent = text;

  const container = document.getElementById('effectsContainer');
  if (container) {
    container.appendChild(effectEl);
  }

  setTimeout(() => effectPool.release(effectEl), duration);
}

// ============================================
// 날씨 시스템
// ============================================

function changeWeather(weather, duration = 30000) {
  gameState.weather = weather;
  const farm = document.getElementById('farm');

  farm.classList.remove('rainy', 'snowy', 'night', 'rainbow');

  // 기존 날씨 효과 제거
  document.querySelectorAll('.weather-effect, .rainbow-effect').forEach(el => el.remove());

  switch (weather) {
    case 'rain':
      farm.classList.add('rainy');
      createRain();
      addLog('🌧️ 비가 내리기 시작했습니다', 'chat');
      setTimeout(() => changeWeather('sunny'), duration);
      break;

    case 'snow':
      farm.classList.add('snowy');
      createSnow();
      addLog('❄️ 눈이 내리기 시작했습니다', 'chat');
      setTimeout(() => changeWeather('sunny'), duration);
      break;

    case 'night':
      farm.classList.add('night');
      addLog('🌙 밤이 되었습니다', 'chat');
      // 밤에는 펫들 졸려함
      gameState.pets.forEach(pet => {
        if (Math.random() < 0.3) {
          showPetBubble(pet, '😴', 3000);
        }
      });
      setTimeout(() => changeWeather('sunny'), duration * 2);
      break;

    case 'rainbow':
      createRainbow();
      addLog('🌈 무지개가 나타났습니다!', 'chat');
      // 모든 펫 행복도 증가
      gameState.pets.forEach(pet => {
        pet.happiness = Math.min(100, pet.happiness + 10);
        showPetBubble(pet, '😍', 2000);
      });
      setTimeout(() => changeWeather('sunny'), duration);
      break;

    case 'sunny':
      addLog('☀️ 날씨가 맑아졌습니다', 'chat');
      break;
  }
}

function createRain() {
  const rainContainer = document.createElement('div');
  rainContainer.className = 'weather-effect rain-effect';

  for (let i = 0; i < 60; i++) {
    const drop = document.createElement('div');
    drop.className = 'rain-drop';
    drop.style.left = `${Math.random() * 100}%`;
    drop.style.animationDelay = `${Math.random() * 2}s`;
    drop.style.animationDuration = `${0.6 + Math.random() * 0.4}s`;
    drop.textContent = '💧';
    rainContainer.appendChild(drop);
  }

  document.getElementById('farm').appendChild(rainContainer);
}

function createSnow() {
  const snowContainer = document.createElement('div');
  snowContainer.className = 'weather-effect snow-effect';

  for (let i = 0; i < 40; i++) {
    const flake = document.createElement('div');
    flake.className = 'snow-flake';
    flake.style.left = `${Math.random() * 100}%`;
    flake.style.animationDelay = `${Math.random() * 4}s`;
    flake.style.animationDuration = `${3 + Math.random() * 3}s`;
    flake.textContent = '❄️';
    snowContainer.appendChild(flake);
  }

  document.getElementById('farm').appendChild(snowContainer);
}

function createRainbow() {
  const rainbow = document.createElement('div');
  rainbow.className = 'rainbow-effect';
  rainbow.textContent = '🌈';
  rainbow.style.position = 'absolute';
  rainbow.style.top = '12%';
  rainbow.style.left = '50%';
  rainbow.style.transform = 'translateX(-50%)';
  rainbow.style.fontSize = '120px';
  rainbow.style.zIndex = '5';

  document.getElementById('farm').appendChild(rainbow);
}

// ============================================
// 채팅 처리
// ============================================

function handleChatMessage(data) {
  console.log('💬 handleChatMessage:', data.username, data.message);
  const msg = data.message.toLowerCase();

  // 먹이
  for (const [foodType, keywords] of Object.entries(chatKeywords.food)) {
    if (keywords.some(kw => msg.includes(kw))) {
      console.log('🍴 음식 키워드 매치:', foodType, 'from:', data.message);
      spawnFood(foodType, data.username);
      return `${foodData[foodType].emoji} ${foodType}`;
    }
  }

  // 날씨
  for (const [weather, keywords] of Object.entries(chatKeywords.weather)) {
    if (keywords.some(kw => msg.includes(kw))) {
      changeWeather(weather);
      return weather;
    }
  }

  // 상호작용 (자신의 펫에만 적용)
  for (const [action, keywords] of Object.entries(chatKeywords.interaction)) {
    if (keywords.some(kw => msg.includes(kw))) {
      handleInteraction(action, data.username);
      return action;
    }
  }

  // 이벤트
  for (const [event, keywords] of Object.entries(chatKeywords.event)) {
    if (keywords.some(kw => msg.includes(kw))) {
      handleEvent(event);
      return event;
    }
  }

  return null;
}

function handleInteraction(action, username) {
  // 해당 유저의 펫 찾기 (없으면 기본 펫 중 랜덤)
  let targetPet = gameState.pets.find(p => p.createdBy === username && !p.isDefault);
  if (!targetPet) {
    // 펫이 없으면 기본 펫 중 하나가 반응
    const defaultPets = gameState.pets.filter(p => p.isDefault);
    if (defaultPets.length > 0) {
      targetPet = defaultPets[Math.floor(Math.random() * defaultPets.length)];
    }
  }

  if (!targetPet) return;

  switch (action) {
    case 'pat':
      targetPet.happiness = Math.min(100, targetPet.happiness + 10);
      createEffect(targetPet.x, targetPet.y, '💝', 'effect heart');
      showPetBubble(targetPet, '💕', 2000);
      soundSystem.play('play');
            // 펫이 기뻐함
      const patPetEl = document.getElementById(`pet-${targetPet.id}`);
      if (patPetEl) {
        patPetEl.classList.add('happy');
        setTimeout(() => patPetEl.classList.remove('happy'), 500);
      }
      break;

    case 'jump':
      const jumpPetEl = document.getElementById(`pet-${targetPet.id}`);
      if (jumpPetEl) {
        jumpPetEl.classList.add('jumping');
        setTimeout(() => jumpPetEl.classList.remove('jumping'), 600);
      }
      showPetBubble(targetPet, '🦘', 1500);
      soundSystem.play('jump');
            break;

    case 'dance':
      targetPet.state = 'dancing';
      showPetBubble(targetPet, '🎵', 3000);
      soundSystem.play('dance');
            setTimeout(() => {
        targetPet.state = 'idle';
      }, 3000);
      break;

    case 'sleep':
      targetPet.state = 'sleeping';
      showPetBubble(targetPet, '💤', 5000);
      addLog(`😴 ${targetPet.name}이(가) 잠에 들었습니다`, 'chat');
      break;

    case 'wake':
      if (targetPet.state === 'sleeping') {
        targetPet.state = 'idle';
        showPetBubble(targetPet, '⏰', 1500);
        addLog(`⏰ ${targetPet.name}이(가) 일어났습니다`, 'chat');
      }
      break;

    default:
      createEffect(targetPet.x, targetPet.y, '💕', 'effect heart');
  }
}

function handleEvent(event) {
  switch (event) {
    case 'party':
      const partyEmojis = ['🎉', '🎊', '🥳', '🎈', '🎀', '✨'];
      for (let i = 0; i < 20; i++) {
        setTimeout(() => {
          const x = randomRange(50, farmWidth - 50);
          const y = randomRange(50, farmHeight - 100);
          createEffect(x, y, partyEmojis[Math.floor(Math.random() * partyEmojis.length)], 'effect party');
        }, i * 100);
      }
      gameState.pets.forEach(pet => showPetBubble(pet, '🥳', 3000));
      break;

    case 'firework':
      for (let i = 0; i < 8; i++) {
        setTimeout(() => {
          const x = randomRange(100, farmWidth - 100);
          const y = randomRange(80, 200);
          createEffect(x, y, '🎆', 'effect party');
        }, i * 300);
      }
      break;

    case 'flower':
      for (let i = 0; i < 25; i++) {
        setTimeout(() => {
          const x = randomRange(0, farmWidth);
          const y = randomRange(0, 150);
          createEffect(x, y, '🌸', 'effect');
        }, i * 80);
      }
      break;

    case 'balloon':
      for (let i = 0; i < 10; i++) {
        setTimeout(() => {
          const x = randomRange(50, farmWidth - 50);
          const y = farmHeight - 50;
          createEffect(x, y, '🎈', 'effect');
        }, i * 120);
      }
      break;

    case 'gift':
      for (let i = 0; i < 5; i++) {
        setTimeout(() => {
          spawnFood('golden', 'Gift Box');
        }, i * 400);
      }
      break;
  }
}

// ============================================
// 통계 & 로그
// ============================================

function updateStats() {
  document.getElementById('petCount').textContent = gameState.pets.length;

  const avgLevel = gameState.pets.length > 0
    ? (gameState.pets.reduce((sum, p) => sum + p.level, 0) / gameState.pets.length).toFixed(1)
    : 0;
  document.getElementById('avgLevel').textContent = avgLevel;

  const avgHappiness = gameState.pets.length > 0
    ? Math.round(gameState.pets.reduce((sum, p) => sum + p.happiness, 0) / gameState.pets.length)
    : 0;
  document.getElementById('happiness').textContent = avgHappiness;

  // 1위 점수 표시
  const nonDefaultPets = gameState.pets.filter(p => !p.isDefault);
  if (nonDefaultPets.length > 0) {
    const topPet = nonDefaultPets.reduce((top, p) => {
      const score = p.totalScore || 0;
      const topScore = top.totalScore || 0;
      return score > topScore ? p : top;
    }, nonDefaultPets[0]);

    const topScore = topPet.totalScore || 0;
    document.getElementById('topScore').textContent =
      topScore > 0 ? `${topPet.createdBy} (${topScore.toLocaleString()}점)` : '-';
  } else {
    document.getElementById('topScore').textContent = '-';
  }
}

function addLog(message, type = 'chat') {
  // 사이드바 이벤트 로그 (테스트 페이지용)
  const logEl = document.getElementById('eventLog');
  if (logEl) {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerHTML = message;
    logEl.insertBefore(entry, logEl.firstChild);
    while (logEl.children.length > 50) {
      logEl.removeChild(logEl.lastChild);
    }
  }

  // HTML 태그 제거하고 간단한 텍스트로 변환
  const textMessage = message.replace(/<br>/g, ' ').replace(/<[^>]*>/g, '');
  const shortMessage = textMessage.length > 35 ? textMessage.substring(0, 35) + '...' : textMessage;

  // 통합 실시간 패널 이벤트
  const liveEventsEl = document.getElementById('liveEvents');
  if (liveEventsEl) {
    const liveEntry = document.createElement('div');
    // 타입에 따른 클래스 지정
    let eventClass = '';
    if (type === 'subscribe') eventClass = 'subscribe';
    else if (type === 'superchat') eventClass = 'superchat';
    else if (type === 'chat' && message.includes('레벨')) eventClass = 'levelup';

    liveEntry.className = `live-event-item ${eventClass}`;
    liveEntry.textContent = shortMessage;
    liveEventsEl.insertBefore(liveEntry, liveEventsEl.firstChild);
    while (liveEventsEl.children.length > 8) {
      liveEventsEl.removeChild(liveEventsEl.lastChild);
    }
  }
}

// ============================================
// 배고픔/행복도 시스템
// ============================================

function startHungerSystem() {
  intervalManager.set('hunger', () => {
    gameState.pets.forEach(pet => {
      pet.hunger = Math.max(0, pet.hunger - 2);

      if (pet.hunger < 30) {
        pet.happiness = Math.max(0, pet.happiness - 1);

        // 배고픔 표시
        if (pet.hunger < 20 && Math.random() < 0.3) {
          showPetBubble(pet, '😢', 2000);
        }
      } else {
        pet.happiness = Math.max(0, pet.happiness - 0.2);
      }

      // 배고픔이 0이 되면 펫 약화
      if (pet.hunger === 0 && !pet.isDefault) {
        weakenPet(pet);
      }

      updatePet(pet);
    });

    updateRanking();
  }, 20000); // 20초마다 체크
}

// 펫 약화 (먹이를 못 먹으면)
function weakenPet(pet) {
  // 점수 감소
  if (pet.totalScore > 0) {
    const lostScore = Math.floor(pet.totalScore * 0.1); // 10% 감소
    pet.totalScore = Math.max(0, pet.totalScore - lostScore);

    if (lostScore > 0) {
      createEffect(pet.x, pet.y - 20, `-${lostScore}`, 'effect score-loss');
      showPetBubble(pet, '😭', 2000);
    }
  }

  // 경험치 감소
  pet.exp = Math.max(0, pet.exp - 10);

  // 레벨 다운 (경험치가 0이고 레벨이 2 이상이면)
  if (pet.exp === 0 && pet.level > 1) {
    pet.level--;
    pet.exp = pet.maxExp - 10;
    pet.maxExp = pet.level * 50 + 50;
    addLog(`😢 ${pet.createdBy}의 ${pet.name}이(가) 배가 고파 레벨이 떨어졌습니다...`, 'chat');
    createEffect(pet.x, pet.y, '📉', 'effect');
  }

  // 배고픔 조금 회복 (완전히 0에서 약간)
  pet.hunger = 10;
}

// ============================================
// 저장/불러오기
// ============================================

function saveGame(force = false) {
  if (!force && !gameState.settings.autoSave) return;

  const saveData = {
    version: '1.2.0',
    lastSaved: Date.now(),
    pets: gameState.pets,
    deletedPets: gameState.deletedPets, // 삭제된 펫 데이터도 저장
    stats: gameState.stats,
    settings: gameState.settings,
    weather: gameState.weather
  };

  try {
    localStorage.setItem('healingPetFarm_save', JSON.stringify(saveData));
    console.log('💾 게임 저장됨 (펫:', gameState.pets.length, '마리, 삭제된펫:', Object.keys(gameState.deletedPets).length, '개)');
  } catch (e) {
    console.error('저장 실패:', e);
  }
}

function loadGame() {
  try {
    const savedData = localStorage.getItem('healingPetFarm_save');
    console.log('📂 저장 데이터 확인:', savedData ? '있음' : '없음');
    if (!savedData) return false;

    const data = JSON.parse(savedData);
    console.log('📂 저장 데이터 파싱 완료, 펫 수:', data.pets ? data.pets.length : 0);

    gameState.stats = data.stats || gameState.stats;
    gameState.settings = { ...gameState.settings, ...data.settings };
    gameState.deletedPets = data.deletedPets || {}; // 삭제된 펫 데이터 로드
    // 소리는 항상 기본으로 켜기
    gameState.settings.soundEnabled = true;
    gameState.weather = data.weather || 'sunny';

    console.log('📂 삭제된 펫 데이터:', Object.keys(gameState.deletedPets).length, '개');

    if (data.pets && data.pets.length > 0) {
      data.pets.forEach(petData => {
        const pet = { ...petData };
        gameState.pets.push(pet);
        // 기본 펫이면 defaultPets에도 추가 (중복 생성 방지)
        if (pet.isDefault) {
          gameState.defaultPets.push(pet);
        }
        renderPet(pet);
        petAI(pet);
      });

      addLog(`💾 저장된 게임을 불러왔습니다 (펫 ${data.pets.length}마리)`, 'chat');
      updateStats();
      return true;
    }

    return false;
  } catch (e) {
    console.error('불러오기 실패:', e);
    return false;
  }
}

// ============================================
// Socket.IO 이벤트
// ============================================

// 시청자 입장 이벤트
socket.on('viewer-join', (data) => {
  const username = validateUsername(data.username);
  triggerViewerJoinEvent(username);
});

// 시청자 입장 이벤트 함수
function triggerViewerJoinEvent(username) {
  const safeUsername = escapeHtml(username);
  // 해당 유저의 기존 펫이 있는지 확인
  const userPet = gameState.pets.find(p => p.createdBy === username && !p.isDefault);

  if (userPet) {
    // 기존 펫이 있으면 "웰컴 백!" 이벤트
    triggerWelcomeBackEvent(username, userPet);
  } else {
    // 새 시청자 - 기본 환영
    // 모든 펫이 인사
    gameState.pets.forEach((pet, i) => {
      setTimeout(() => {
        showPetBubble(pet, '👋', CONFIG.BUBBLE_DURATION);
        // 펫이 점프
        const petEl = document.getElementById(`pet-${pet.id}`);
        if (petEl) {
          petEl.classList.add('jumping');
          setTimeout(() => petEl.classList.remove('jumping'), 600);
        }
      }, i * 200);
    });

    // 환영 메시지 표시
    showWelcomeMessage(username);
    addLog(`👋 <strong>${safeUsername}</strong>님이 입장했습니다!`, 'chat');
  }
}

// 기존 사용자 환영 이벤트
function triggerWelcomeBackEvent(username, pet) {
  // 펫이 주인을 반기며 달려감
  const petEl = document.getElementById(`pet-${pet.id}`);
  if (petEl) {
    // 하이라이트 효과
    petEl.classList.add('welcome-back-highlight');
    setTimeout(() => petEl.classList.remove('welcome-back-highlight'), 3000);

    // 펫이 기뻐함
    showPetBubble(pet, '🥰', 3000);
    petEl.classList.add('jumping');
    setTimeout(() => petEl.classList.remove('jumping'), 600);

    // 하트 이펙트
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        createEffect(
          pet.x + randomRange(-30, 30),
          pet.y + randomRange(-40, -10),
          '💕',
          'effect heart-burst'
        );
      }, i * 150);
    }
  }

  // 펫 타이머 리셋 (다시 활성화)
  pet.lastFed = Date.now();
  pet.happiness = Math.min(100, pet.happiness + 20);
  pet.hunger = Math.min(100, pet.hunger + 10);

  // 다른 펫들도 반응
  gameState.pets.forEach((otherPet, i) => {
    if (otherPet.id === pet.id) return;
    setTimeout(() => {
      showPetBubble(otherPet, '👋', 1500);
    }, i * 100);
  });

  // 환영 메시지 (재방문)
  showWelcomeBackMessage(username, pet);
  const safeUsername = escapeHtml(username);
  const safePetName = escapeHtml(pet.name);
  addLog(`🎉 <strong>${safeUsername}</strong>님이 돌아왔습니다! ${pet.emoji} ${safePetName}이(가) 반갑게 맞이합니다!`, 'chat');
}

// 재방문 환영 메시지 표시
function showWelcomeBackMessage(username, pet) {
  const safeUsername = escapeHtml(validateUsername(username));
  const safePetName = escapeHtml(pet.name);
  const welcomeEl = document.createElement('div');
  welcomeEl.className = 'welcome-message welcome-back';
  welcomeEl.innerHTML = `🎉 <strong>${safeUsername}</strong>님 다시 오셨네요!<br>${pet.emoji} ${safePetName}이(가) 기다렸어요!`;
  document.getElementById('farm').appendChild(welcomeEl);
  setTimeout(() => welcomeEl.remove(), CONFIG.BANNER_DURATION);
}

// 환영 메시지 표시
function showWelcomeMessage(username) {
  const safeUsername = escapeHtml(validateUsername(username));
  const welcomeEl = document.createElement('div');
  welcomeEl.className = 'welcome-message';
  welcomeEl.innerHTML = `👋 <strong>${safeUsername}</strong>님 환영합니다!`;
  document.getElementById('farm').appendChild(welcomeEl);
  setTimeout(() => welcomeEl.remove(), 3000);
}

// "제거" 채팅으로 자기 펫 삭제
socket.on('chat-remove-pet', (data) => {
  const username = validateUsername(data.username);
  const safeUsername = escapeHtml(username);

  // 해당 유저의 펫 찾기 (기본 펫 제외)
  const petIndex = gameState.pets.findIndex(p => p.createdBy === username && !p.isDefault);
  if (petIndex === -1) {
    console.log(`⚠️ ${username}님의 펫이 없습니다.`);
    addLog(`💬 <strong>${safeUsername}</strong>님의 펫이 없습니다.`, 'chat');
    return;
  }

  const pet = gameState.pets[petIndex];

  // 삭제된 펫 데이터 저장 (나중에 복구용)
  gameState.deletedPets[username] = {
    name: pet.name,
    emoji: pet.emoji,
    rarity: pet.rarity,
    level: pet.level,
    exp: pet.exp,
    maxExp: pet.maxExp,
    happiness: pet.happiness,
    totalScore: pet.totalScore || 0,
    evolved10: pet.evolved10 || false,
    evolved20: pet.evolved20 || false,
    isSuperchat: pet.isSuperchat || false,
    deletedAt: Date.now()
  };
  console.log(`💾 ${username}님의 펫 데이터 저장됨 (Lv.${pet.level})`);

  // DOM에서 펫 제거
  const petEl = document.getElementById(`pet-${pet.id}`);
  if (petEl) {
    petEl.remove();
  }

  // 배열에서 제거
  gameState.pets.splice(petIndex, 1);

  // 이펙트
  createEffect(pet.x, pet.y, '💨', 'effect fade');
  addLog(`🗑️ <strong>${safeUsername}</strong>님이 펫을 제거했습니다. "시작"으로 데이터가 이어집니다!`, 'chat');

  updateStats();
  updateRanking();
  saveGame();
});

// 확률 기반 등급 선택 (일반41%, 희귀33%, 에픽16%, 전설8%, 신화2%)
function selectRandomRarity() {
  const rand = Math.random() * 100;
  if (rand < 2) return 'mythic';       // 2%
  if (rand < 10) return 'legendary';   // 8%
  if (rand < 26) return 'epic';        // 16%
  if (rand < 59) return 'rare';        // 33%
  return 'common';                      // 41%
}

// "시작" 채팅으로 펫 생성
socket.on('chat-start-pet', (data) => {
  console.log('🎮 chat-start-pet 이벤트 수신:', data);
  const username = validateUsername(data.username);
  const safeUsername = escapeHtml(username);

  // 이미 해당 유저의 펫이 있는지 확인 (중복 방지)
  const existingPet = gameState.pets.find(p => p.createdBy === username && !p.isDefault);
  if (existingPet) {
    // 이미 펫이 있으면 무시하고 알림만
    console.log(`⚠️ ${username}님은 이미 펫이 있습니다.`);
    addLog(`💬 <strong>${safeUsername}</strong>님은 이미 펫이 있습니다!`, 'chat');
    return;
  }

  // 등급별 이모지
  const rarityEmoji = {
    common: '⚪',
    rare: '🟢',
    epic: '🔵',
    legendary: '🟣',
    mythic: '🟡'
  };
  const rarityName = {
    common: '일반',
    rare: '희귀',
    epic: '에픽',
    legendary: '전설',
    mythic: '신화'
  };

  // 삭제된 펫 데이터가 있는지 확인 (복구!)
  const deletedPetData = gameState.deletedPets[username];
  if (deletedPetData) {
    console.log(`🔄 ${username}님의 이전 펫 데이터 복구! Lv.${deletedPetData.level}`);
    soundSystem.play('hatch');

    // 이전 펫 데이터로 복구
    const x = randomRange(100, farmWidth - 100);
    const y = randomRange(farmHeight * 0.4, farmHeight * 0.85);
    const rarity = deletedPetData.rarity;
    const petType = { emoji: deletedPetData.emoji, name: deletedPetData.name };

    // 펫 생성 후 데이터 복구
    const pet = createPetDirect(username, rarity, petType, x, y, deletedPetData.isSuperchat);
    pet.level = deletedPetData.level;
    pet.exp = deletedPetData.exp;
    pet.maxExp = deletedPetData.maxExp || CONFIG.EXP_PER_LEVEL;
    pet.happiness = deletedPetData.happiness;
    pet.totalScore = deletedPetData.totalScore;
    pet.evolved10 = deletedPetData.evolved10;
    pet.evolved20 = deletedPetData.evolved20;

    // 복구된 펫 업데이트
    updatePet(pet);

    // 삭제된 데이터에서 제거
    delete gameState.deletedPets[username];

    // 환영 이펙트
    showEventBanner(`🔄 ${safeUsername}님의 ${rarityEmoji[rarity]} Lv.${pet.level} ${pet.name} 복구!`, 'chat');
    createHealingEffect();
    showPetBubble(pet, '😊', 2000);

    addLog(`🔄 <strong>${safeUsername}</strong>님의 펫 복구! ${rarityEmoji[rarity]} Lv.${pet.level} <strong>${pet.name}</strong>`, 'chat');
    saveGame();
    return;
  }

  // 새 펫 생성 - 확률 기반 등급 선택 (전설/신화도 낮은 확률로 가능!)
  soundSystem.play('hatch');
  const rarity = selectRandomRarity();
  const pool = petData[rarity];
  const petType = pool[Math.floor(Math.random() * pool.length)];
  createPet(username, rarity, petType, true, false, 0);

  // 환영 이펙트
  showEventBanner(`🐣 ${safeUsername}님의 ${rarityEmoji[rarity]}${rarityName[rarity]} 펫이 태어났습니다!`, 'chat');
  createHealingEffect();

  // 전설 이상이면 특별 효과
  if (rarity === 'legendary' || rarity === 'mythic') {
    triggerSuperchatEvent(username, rarity === 'mythic' ? 10000 : 5000, rarity);
  }

  addLog(`🐣 <strong>${safeUsername}</strong>님이 "시작"! ${rarityEmoji[rarity]} <strong>${rarityName[rarity]}</strong> 펫이 태어났습니다!`, 'chat');
  saveGame();
});

socket.on('new-subscribe', (data) => {
  // 입력값 검증
  const username = validateUsername(data.username);
  const safeUsername = escapeHtml(username);

  // 구독 사운드 효과
  soundSystem.play('subscribe');

  // 이미 같은 유저의 펫이 있는지 확인 (구독취소 후 재구독 처리)
  const existingPet = gameState.pets.find(p => p.createdBy === username && !p.isSuperchat);
  if (existingPet) {
    // 이미 있으면 행복도만 회복하고 이펙트
    existingPet.happiness = 100;
    existingPet.hunger = Math.min(100, existingPet.hunger + 30);
    showPetBubble(existingPet, '💕', 3000);
    createEffect(existingPet.x, existingPet.y, '🎉', 'effect party');
    addLog(`🔄 <strong>${safeUsername}</strong>님이 다시 구독! (펫 행복도 회복)`, 'subscribe');
    saveGame();
    return;
  }

  // 🎊 구독 축하 이벤트!
  triggerSubscribeEvent(username);

  // 구독은 일반 이상 (20% 확률로 등급 업)
  const rarityList = ['common', 'rare', 'epic', 'legendary', 'mythic'];
  let finalRarity = 0; // common부터 시작

  // 최대 신화까지 업그레이드 가능 (각 단계 20% 확률)
  while (finalRarity < 4 && Math.random() < 0.2) {
    finalRarity++;
  }

  const rarity = rarityList[finalRarity];
  const pool = petData[rarity];
  const petType = pool[Math.floor(Math.random() * pool.length)];
  createPet(username, rarity, petType, true, false, 0);

  gameState.stats.totalSubscribers++;

  // 힐링 이펙트 추가
  createHealingEffect();

  addLog(`🎉 <strong>${safeUsername}</strong>님이 구독했습니다! 새 펫 알이 생성됩니다!`, 'subscribe');
  saveGame();
});

// 구독 축하 이벤트
function triggerSubscribeEvent(username) {
  const safeUsername = escapeHtml(username);
  // 축하 배너 표시
  showEventBanner(`🎉 ${safeUsername}님 구독 감사합니다!`, 'subscribe');

  // 모든 펫이 간단히 반응 (작은 점프 + 짧은 이모지)
  gameState.pets.forEach((pet, i) => {
    setTimeout(() => {
      // 짧은 리액션
      const reactions = ['👀', '😊', '✨', '💕'];
      showPetBubble(pet, reactions[Math.floor(Math.random() * reactions.length)], 1500);

      // 작은 점프
      const petEl = document.getElementById(`pet-${pet.id}`);
      if (petEl) {
        petEl.classList.add('mini-bounce');
        setTimeout(() => petEl.classList.remove('mini-bounce'), 400);
      }
    }, i * 100);
  });

  // 축하 이펙트 (간소화)
  const celebEmojis = ['🎉', '✨', '🌟'];
  for (let i = 0; i < 8; i++) {
    setTimeout(() => {
      const x = randomRange(50, farmWidth - 50);
      const y = randomRange(50, 150);
      createEffect(x, y, celebEmojis[Math.floor(Math.random() * celebEmojis.length)], 'effect party');
    }, i * 100);
  }
}

socket.on('new-superchat', (data) => {
  // 입력값 검증
  const username = validateUsername(data.username);
  const amount = validateAmount(data.amount);
  const safeUsername = escapeHtml(username);

  // 슈퍼챗 사운드 효과
  soundSystem.play('superchat');

  const { rarity, petType } = selectPetByAmount(amount);

  // 이미 슈퍼챗 펫이 있는지 확인
  const existingPet = gameState.pets.find(p => p.createdBy === username && p.isSuperchat);

  const rarityOrder = ['common', 'rare', 'epic', 'legendary', 'mythic'];
  const rarityEmoji = {
    common: '⚪',
    rare: '🟢',
    epic: '🔵',
    legendary: '🟣',
    mythic: '🟡'
  };

  if (existingPet) {
    // 이미 펫이 있으면 업그레이드!
    const currentRarityIndex = rarityOrder.indexOf(existingPet.rarity);
    const newRarityIndex = rarityOrder.indexOf(rarity);

    // 더 높은 등급이면 등급 업그레이드
    if (newRarityIndex > currentRarityIndex) {
      const oldRarity = existingPet.rarity;
      existingPet.rarity = rarity;
      existingPet.color = petType.color;

      // 펫 다시 렌더링
      const petEl = document.getElementById(`pet-${existingPet.id}`);
      if (petEl) {
        petEl.className = `pet ${existingPet.state} rarity-${rarity} superchat-pet`;
        if (existingPet.direction === 'left') petEl.classList.add('flipped');
      }

      // 등급업 이펙트
      for (let i = 0; i < 15; i++) {
        setTimeout(() => {
          createEffect(
            existingPet.x + randomRange(-50, 50),
            existingPet.y + randomRange(-50, 30),
            '⬆️',
            'effect party'
          );
        }, i * 80);
      }

      showPetBubble(existingPet, '🎊', 3000);
      addLog(`💎 <strong>${safeUsername}</strong>님 ₩${amount.toLocaleString()} 추가 후원!<br>→ ${rarityEmoji[oldRarity]} → ${rarityEmoji[rarity]} 등급 업그레이드!`, 'superchat');
    } else {
      // 같거나 낮은 등급이면 점수 보너스
      const bonusScore = Math.floor(amount / 10);
      existingPet.totalScore = (existingPet.totalScore || 0) + bonusScore;
      existingPet.exp += Math.floor(amount / 50);

      // 레벨업 체크
      while (existingPet.exp >= existingPet.maxExp) {
        existingPet.exp -= existingPet.maxExp;
        levelUp(existingPet);
      }

      // 점수 획득 이펙트
      createEffect(existingPet.x, existingPet.y - 30, `+${bonusScore}점!`, 'effect exp-gain');
      showPetBubble(existingPet, '💰', 2000);

      // 황금 먹이 보너스
      for (let i = 0; i < Math.min(3, Math.floor(amount / 2000)); i++) {
        setTimeout(() => spawnFood('golden', username), i * 300);
      }

      addLog(`💰 <strong>${safeUsername}</strong>님 ₩${amount.toLocaleString()} 추가 후원!<br>→ +${bonusScore}점 보너스!`, 'superchat');
    }

    existingPet.superchatAmount = (existingPet.superchatAmount || 0) + amount;
    existingPet.happiness = 100;
    existingPet.hunger = 100;

  } else {
    // 새 펫 생성
    createPet(username, rarity, petType, true, true, amount);

    if (amount >= CONFIG.SUPERCHAT_TIERS.LEGENDARY) {
      spawnFood('golden', username);
    }

    addLog(`💰 <strong>${safeUsername}</strong>님이 ₩${amount.toLocaleString()} 후원!<br>→ ${rarityEmoji[rarity]} ${escapeHtml(petType.name)} 알 획득!`, 'superchat');
  }

  // 🎊 후원 축하 이벤트!
  triggerSuperchatEvent(username, amount, rarity);

  // 금액에 따른 특별 효과
  if (amount >= CONFIG.SUPERCHAT_TIERS.MYTHIC) {
    createHeartFountain();
  }
  if (amount >= 50000) {
    gameState.pets.forEach(pet => {
      pet.happiness = 100;
      showPetBubble(pet, '🥳', 3000);
    });
    handleEvent('party');
  }

  gameState.stats.totalSuperchats++;
  gameState.stats.totalSuperchatAmount += amount;
  updateRanking();
  saveGame();
});

// ============================================
// 관리자 명령 수신
// ============================================

// 관리자: 설정 업데이트
socket.on('settings-updated', (settings) => {
  console.log('👑 설정 업데이트:', settings);
  if (settings.petTimeout) {
    gameState.settings.petTimeout = settings.petTimeout * 60 * 1000;
  }
});

// 관리자: 펫 먹이주기
socket.on('admin-feed-pet', (data) => {
  const pet = gameState.pets.find(p => p.id === data.petId);
  if (pet) {
    pet.hunger = 100;
    pet.happiness = Math.min(100, pet.happiness + 20);
    pet.exp += 30;
    if (pet.exp >= pet.maxExp) {
      levelUp(pet);
    }
    showPetBubble(pet, '😋', 2000);
    createEffect(pet.x, pet.y, '🍖', 'effect');
    addLog(`👑 관리자가 ${pet.createdBy}의 ${pet.name}에게 먹이를 주었습니다!`, 'chat');
    updatePet(pet);
    saveGame();
  }
});

// 관리자: 펫 제거
socket.on('admin-remove-pet', (data) => {
  const pet = gameState.pets.find(p => p.id === data.petId);
  if (pet && !pet.isDefault) {
    createEffect(pet.x, pet.y, '👋', 'effect');
    addLog(`👑 관리자가 ${pet.createdBy}의 ${pet.name}을(를) 제거했습니다`, 'chat');
    removePetById(data.petId);
    updateStats();
    updateRanking();
    saveGame();
  }
});

// 관리자: 전체 초기화
socket.on('admin-reset-pets', () => {
  // 기본 펫 제외하고 모두 삭제
  const petsToRemove = gameState.pets.filter(p => !p.isDefault);
  petsToRemove.forEach(pet => {
    const petEl = document.getElementById(`pet-${pet.id}`);
    if (petEl) petEl.remove();
  });
  gameState.pets = gameState.pets.filter(p => p.isDefault);
  gameState.foods.forEach(food => {
    const foodEl = document.getElementById(`food-${food.id}`);
    if (foodEl) foodEl.remove();
  });
  gameState.foods = [];
  addLog('👑 관리자가 모든 펫을 초기화했습니다!', 'chat');
  updateStats();
  updateRanking();
  saveGame();
});

// 후원 축하 이벤트
function triggerSuperchatEvent(username, amount, rarity) {
  // 축하 배너 표시
  showEventBanner(`💰 ${username}님 ₩${amount.toLocaleString()} 후원!`, 'superchat');

  // 모든 펫이 간단히 반응 (금액에 따라 리액션 강도 조절)
  gameState.pets.forEach((pet, i) => {
    setTimeout(() => {
      // 기본 리액션
      const reactions = amount >= 5000 ? ['😍', '🥰', '💖', '✨'] : ['👀', '😊', '💕'];
      showPetBubble(pet, reactions[Math.floor(Math.random() * reactions.length)], 1500);

      // 작은 점프/바운스
      const petEl = document.getElementById(`pet-${pet.id}`);
      if (petEl) {
        petEl.classList.add('mini-bounce');
        setTimeout(() => petEl.classList.remove('mini-bounce'), 400);
      }
    }, i * 80);
  });

  // 금액에 따른 이펙트 강도 (간소화)
  const effectCount = Math.min(15, Math.floor(amount / 1000) + 5);
  const celebEmojis = amount >= 5000
    ? ['💎', '✨', '🌟', '👑']
    : ['✨', '🌟', '💕'];

  for (let i = 0; i < effectCount; i++) {
    setTimeout(() => {
      const x = randomRange(50, farmWidth - 50);
      const y = randomRange(30, farmHeight - 100);
      createEffect(x, y, celebEmojis[Math.floor(Math.random() * celebEmojis.length)], 'effect party');
    }, i * 80);
  }

  // 등급별 특별 효과 (전설/신화만)
  if (rarity === 'legendary' || rarity === 'mythic') {
    const flash = document.createElement('div');
    flash.className = 'screen-flash ' + rarity;
    document.getElementById('farm').appendChild(flash);
    setTimeout(() => flash.remove(), 1000);
  }
}

// 이벤트 배너 표시
function showEventBanner(message, type) {
  const banner = document.createElement('div');
  banner.className = `event-banner ${type}`;
  banner.innerHTML = message;
  document.getElementById('farm').appendChild(banner);
  setTimeout(() => {
    banner.classList.add('fade-out');
    setTimeout(() => banner.remove(), 500);
  }, 3000);
}

socket.on('new-chat', (data) => {
  // 입력값 검증
  const username = validateUsername(data.username);
  const message = validateMessage(data.message);
  const safeUsername = escapeHtml(username);
  const safeMessage = escapeHtml(message);

  // 채팅한 유저의 펫 타이머 리셋
  refreshPetTimer(username);

  const result = handleChatMessage({ username, message });

  if (result) {
    addLog(`💬 <strong>${safeUsername}</strong>: "${safeMessage}"<br>→ ${result} 효과 발동!`, 'chat');
  }
});

// ============================================
// 초기화
// ============================================

console.log('🐾 힐링 펫 팜 게임 시작!');

// 환경 효과 초기화
initEnvironment();

// 저장된 게임 불러오기
const loaded = loadGame();

if (!loaded) {
  addLog('🎮 힐링 펫 팜에 오신 것을 환영합니다!', 'chat');
}

// 기본 펫 초기화
initDefaultPets();

// 배고픔 시스템 시작
startHungerSystem();

// 펫 타임아웃 시스템 시작 (5분 후 자동 삭제)
startPetTimeoutSystem();

// 자동 저장 (5분마다)
intervalManager.set('autoSave', saveGame, CONFIG.AUTO_SAVE_INTERVAL);

// 플레이 타임 카운터
intervalManager.set('playTime', () => {
  gameState.stats.playTime++;
}, 1000);

// 통계 업데이트
intervalManager.set('updateStats', updateStats, 1000);

// 랭킹 업데이트
intervalManager.set('updateRanking', updateRanking, 2000);

// 오디오 상태 로그
console.log('🔊 오디오 상태 확인:');
console.log('  - soundSystem.audioContext:', soundSystem.audioContext ? 'OK' : 'NULL');
if (soundSystem.audioContext) {
  console.log('  - audioContext.state:', soundSystem.audioContext.state);
}
console.log('  - soundEnabled:', gameState.settings.soundEnabled);
console.log('💡 콘솔에서 testSound() 를 실행하여 소리 테스트');

// 첫 클릭 시 오디오 활성화 (브라우저 정책 우회)
let audioActivated = false;
document.addEventListener('click', function activateAudio() {
  if (audioActivated) return;
  audioActivated = true;

  // soundSystem 활성화
  if (soundSystem.audioContext && soundSystem.audioContext.state === 'suspended') {
    soundSystem.audioContext.resume().then(() => {
      console.log('🔊 사용자 클릭으로 오디오 활성화됨');
      // 활성화 확인용 짧은 소리
      soundSystem.play('click');
    });
  }

  // BGM 자동 재생 시도
  bgmSystem.play();
}, { once: true });

// 서버로 게임 상태 동기화 (관리자 페이지용)
intervalManager.set('syncGameState', () => {
  if (socket && socket.connected) {
    socket.emit('sync-game-state', {
      pets: gameState.pets,
      stats: gameState.stats
    });
  }
}, 2000);

// 콤보 리셋
intervalManager.set('comboReset', () => {
  if (Date.now() - gameState.lastFeedTime > 5000) {
    gameState.combo = 0;
  }
}, 1000);

// ============================================
// 랭킹 시스템
// ============================================

// 이전 랭킹 HTML 저장 (깜빡임 방지)
let lastRankingHtml = '';
let lastLiveRankingHtml = '';

function updateRanking() {
  const rankingEl = document.getElementById('rankingList');
  const liveRankingEl = document.getElementById('liveRankingList');

  // 총 점수 기준 정렬 (기본 펫 제외)
  const sortedPets = [...gameState.pets]
    .filter(p => !p.isDefault)
    .sort((a, b) => {
      const scoreA = a.totalScore || 0;
      const scoreB = b.totalScore || 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      if (b.level !== a.level) return b.level - a.level;
      return b.exp - a.exp;
    })
    .slice(0, 5);

  const rankEmoji = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];

  if (sortedPets.length === 0) {
    const emptyHtml = '<div class="rank-empty">🐣 첫 번째 펫을 기다리는 중...</div>';
    const liveEmptyHtml = '<div class="live-empty">🐣 첫 번째 펫을 기다리는 중...</div>';
    if (rankingEl && lastRankingHtml !== emptyHtml) {
      rankingEl.innerHTML = emptyHtml;
      lastRankingHtml = emptyHtml;
    }
    if (liveRankingEl && lastLiveRankingHtml !== liveEmptyHtml) {
      liveRankingEl.innerHTML = liveEmptyHtml;
      lastLiveRankingHtml = liveEmptyHtml;
    }
    return;
  }

  // 사이드바 랭킹 업데이트 (변경 시에만)
  if (rankingEl) {
    const newHtml = sortedPets.map((pet, i) => {
      const score = pet.totalScore || 0;
      const multiplier = rarityMultiplier[pet.rarity] || 1;
      return `
        <div class="rank-item ${pet.isSuperchat ? 'superchat' : ''} rarity-${pet.rarity}">
          <span class="rank-pos">${rankEmoji[i]}</span>
          <span class="rank-emoji">${pet.emoji}</span>
          <div class="rank-info">
            <span class="rank-name">${pet.createdBy}</span>
            <span class="rank-details">Lv.${pet.level} · x${multiplier}</span>
          </div>
          <span class="rank-score">${score.toLocaleString()}점</span>
        </div>
      `;
    }).join('');

    if (lastRankingHtml !== newHtml) {
      rankingEl.innerHTML = newHtml;
      lastRankingHtml = newHtml;
    }
  }

  // 통합 실시간 패널 랭킹 업데이트 (변경 시에만)
  if (liveRankingEl) {
    const positionClass = ['gold', 'silver', 'bronze', '', ''];
    const newLiveHtml = sortedPets.map((pet, i) => {
      const score = pet.totalScore || 0;
      return `
        <div class="live-rank-item">
          <div class="live-rank-position ${positionClass[i]}">${rankEmoji[i]}</div>
          <div class="live-rank-emoji">${pet.emoji}</div>
          <div class="live-rank-info">
            <div class="live-rank-name">${escapeHtml(pet.createdBy || '???')}</div>
            <div class="live-rank-stats">${escapeHtml(pet.name)} · Lv.${pet.level}</div>
          </div>
          <div class="live-rank-score">${score.toLocaleString()}</div>
        </div>
      `;
    }).join('');

    if (lastLiveRankingHtml !== newLiveHtml) {
      liveRankingEl.innerHTML = newLiveHtml;
      lastLiveRankingHtml = newLiveHtml;
    }
  }

  // 펫에 등수 배지 표시
  updatePetRankBadges(sortedPets);
}

// 펫 등수 배지 업데이트
function updatePetRankBadges(rankedPets) {
  const rankEmoji = ['🥇', '🥈', '🥉'];

  // 모든 펫의 등수 배지 숨기기
  gameState.pets.forEach(pet => {
    const petEl = document.getElementById(`pet-${pet.id}`);
    if (petEl) {
      const badge = petEl.querySelector('.pet-rank-badge');
      if (badge) {
        badge.style.display = 'none';
      }
    }
  });

  // 상위 3등에게만 배지 표시
  rankedPets.slice(0, 3).forEach((pet, i) => {
    const petEl = document.getElementById(`pet-${pet.id}`);
    if (petEl) {
      const badge = petEl.querySelector('.pet-rank-badge');
      if (badge) {
        badge.textContent = rankEmoji[i];
        badge.style.display = 'block';
      }
    }
  });
}

// ============================================
// 힐링 이펙트
// ============================================

function createHealingEffect() {
  const farm = document.getElementById('farm');

  // 부드러운 빛 효과
  for (let i = 0; i < 5; i++) {
    setTimeout(() => {
      const glow = document.createElement('div');
      glow.className = 'healing-glow';
      glow.style.left = `${randomRange(10, 90)}%`;
      glow.style.top = `${randomRange(20, 80)}%`;
      farm.appendChild(glow);
      setTimeout(() => glow.remove(), 4000);
    }, i * 200);
  }
}

function createHeartFountain() {
  const farm = document.getElementById('farm');
  const centerX = farmWidth / 2;
  const centerY = farmHeight / 2;

  const hearts = ['💕', '💖', '💗', '💝', '❤️', '🧡', '💛', '💚', '💙', '💜'];

  for (let i = 0; i < 20; i++) {
    setTimeout(() => {
      const heart = document.createElement('div');
      heart.className = 'heart-fountain';
      heart.textContent = hearts[Math.floor(Math.random() * hearts.length)];
      heart.style.left = `${centerX + randomRange(-50, 50)}px`;
      heart.style.top = `${centerY}px`;
      heart.style.fontSize = `${20 + randomRange(0, 20)}px`;
      heart.style.setProperty('--drift', `${randomRange(-100, 100)}px`);
      farm.appendChild(heart);
      setTimeout(() => heart.remove(), 2000);
    }, i * 100);
  }
}

// 주기적으로 힐링 환경 효과
function startHealingAmbience() {
  // 반딧불이 (밤에만)
  intervalManager.set('fireflies', () => {
    if (gameState.weather === 'night' || gameState.timeOfDay === 'night') {
      createFireflies();
    }
  }, 5000);

  // 꽃잎 (맑은 날)
  intervalManager.set('petals', () => {
    if (gameState.weather === 'sunny' && Math.random() < 0.3) {
      createPetals();
    }
  }, 8000);

  // 연못 물결
  intervalManager.set('pondRipple', () => {
    createPondRipple();
  }, 4000);
}

function createFireflies() {
  const envContainer = document.getElementById('environmentContainer');
  if (!envContainer) return;

  for (let i = 0; i < 3; i++) {
    const firefly = document.createElement('div');
    firefly.className = 'firefly';
    firefly.style.left = `${randomRange(10, 90)}%`;
    firefly.style.top = `${randomRange(30, 70)}%`;
    firefly.style.animationDelay = `${randomRange(0, 3)}s`;
    firefly.style.animationDuration = `${6 + randomRange(0, 4)}s`;
    envContainer.appendChild(firefly);
    setTimeout(() => firefly.remove(), 10000);
  }
}

function createPetals() {
  const envContainer = document.getElementById('environmentContainer');
  if (!envContainer) return;

  const petals = ['🌸', '🌺', '💮', '🏵️'];

  for (let i = 0; i < 5; i++) {
    const petal = document.createElement('div');
    petal.className = 'petal';
    petal.textContent = petals[Math.floor(Math.random() * petals.length)];
    petal.style.left = `${randomRange(0, 100)}%`;
    petal.style.animationDelay = `${randomRange(0, 3)}s`;
    petal.style.animationDuration = `${8 + randomRange(0, 5)}s`;
    envContainer.appendChild(petal);
    setTimeout(() => petal.remove(), 15000);
  }
}

function createPondRipple() {
  const pond = document.querySelector('.pond');
  if (!pond) return;

  const ripple = document.createElement('div');
  ripple.className = 'pond-ripple';
  ripple.style.left = `${randomRange(20, 80)}%`;
  ripple.style.top = `${randomRange(30, 70)}%`;
  pond.appendChild(ripple);
  setTimeout(() => ripple.remove(), 3000);
}

// ============================================
// 프리미엄 앰비언트 효과
// ============================================

function startPremiumAmbience() {
  const farm = document.getElementById('farm');

  // 프리미엄 글로우 생성
  createPremiumGlows();

  // 빛줄기 효과
  intervalManager.set('lightRay', () => {
    if (gameState.weather === 'sunny' && Math.random() < 0.3) {
      createLightRay();
    }
  }, 3000);

  // 반짝이는 별
  createTwinkleStars();

  // 떠다니는 하트
  intervalManager.set('floatingHeart', () => {
    if (Math.random() < 0.2) {
      createFloatingHeart();
    }
  }, 4000);
}

function createPremiumGlows() {
  const farm = document.getElementById('farm');

  for (let i = 0; i < 3; i++) {
    const glow = document.createElement('div');
    glow.className = 'premium-glow';
    glow.style.left = `${20 + i * 30}%`;
    glow.style.top = `${20 + randomRange(0, 30)}%`;
    glow.style.animationDelay = `${i * 5}s`;
    farm.appendChild(glow);
  }
}

function createLightRay() {
  const farm = document.getElementById('farm');

  const ray = document.createElement('div');
  ray.className = 'light-ray';
  ray.style.left = `${randomRange(10, 90)}%`;
  ray.style.animationDuration = `${6 + randomRange(0, 4)}s`;
  farm.appendChild(ray);

  setTimeout(() => ray.remove(), 10000);
}

function createTwinkleStars() {
  const envContainer = document.getElementById('environmentContainer');
  if (!envContainer) return;

  for (let i = 0; i < 8; i++) {
    const star = document.createElement('div');
    star.className = 'twinkle-star';
    star.textContent = '✦';
    star.style.left = `${randomRange(5, 95)}%`;
    star.style.top = `${randomRange(5, 25)}%`;
    star.style.animationDelay = `${randomRange(0, 3)}s`;
    star.style.animationDuration = `${2 + randomRange(0, 2)}s`;
    envContainer.appendChild(star);
  }
}

function createFloatingHeart() {
  const farm = document.getElementById('farm');

  const hearts = ['💗', '💕', '💖', '🩷', '🤍'];
  const heart = document.createElement('div');
  heart.className = 'floating-heart';
  heart.textContent = hearts[Math.floor(Math.random() * hearts.length)];
  heart.style.left = `${randomRange(10, 90)}%`;
  heart.style.bottom = '50px';
  heart.style.animationDelay = `${randomRange(0, 2)}s`;
  heart.style.animationDuration = `${10 + randomRange(0, 5)}s`;
  farm.appendChild(heart);

  setTimeout(() => heart.remove(), 15000);
}

// 힐링 앰비언스 시작
startHealingAmbience();

// 프리미엄 앰비언스 시작
startPremiumAmbience();

// ============================================
// 기본 펫 시스템 (항상 존재하는 펫들)
// ============================================

function initDefaultPets() {
  // 이미 기본 펫이 있으면 스킵
  if (gameState.defaultPets.length > 0) return;

  defaultPetData.forEach((data, i) => {
    const x = 150 + i * 200;
    const y = randomRange(250, 400);

    const pet = {
      id: `default-${i}`,
      name: data.name,
      emoji: data.emoji,
      color: data.color || '#FFD93D',
      rarity: data.rarity,
      level: 1,
      exp: 0,
      maxExp: 60,
      happiness: 100,
      hunger: 100,
      x: x,
      y: y,
      targetX: null,
      targetY: null,
      state: 'idle',
      direction: 'right',
      bubble: null,
      bubbleTimer: null,
      lastFed: Date.now(),
      createdAt: Date.now(),
      createdBy: '농장주인',
      isDefault: true,
      isSuperchat: false,
      superchatAmount: 0,
      totalScore: 0
    };

    gameState.defaultPets.push(pet);
    gameState.pets.push(pet);
    renderPet(pet);
    petAI(pet);
  });

  addLog('🏠 농장의 기본 펫들이 반갑게 인사합니다!', 'chat');
}

// ============================================
// 펫 타임아웃 시스템 (시청자 펫 자동 삭제)
// ============================================

function startPetTimeoutSystem() {
  intervalManager.set('petTimeout', () => {
    const now = Date.now();
    const timeout = gameState.settings.petTimeout;

    // 삭제할 펫 찾기 (기본 펫과 슈퍼챗 펫 제외)
    const petsToRemove = gameState.pets.filter(pet => {
      if (pet.isDefault) return false; // 기본 펫은 삭제 안함
      if (pet.isSuperchat) return false; // 슈퍼챗 펫은 삭제 안함

      const timeSinceLastFed = now - pet.lastFed;
      return timeSinceLastFed > timeout;
    });

    petsToRemove.forEach(pet => {
      // 떠나는 이펙트
      createEffect(pet.x, pet.y, '👋', 'effect');
      showPetBubble(pet, '😢', 1000);

      setTimeout(() => {
        addLog(`💨 ${pet.createdBy}의 ${pet.name}이(가) 농장을 떠났습니다...`, 'chat');
        removePetById(pet.id);
        updateStats();
        updateRanking();
      }, 1000);
    });
  }, 30000); // 30초마다 체크
}

// 펫 상호작용 시 타이머 리셋
function refreshPetTimer(username) {
  const pet = gameState.pets.find(p => p.createdBy === username && !p.isDefault);
  if (pet) {
    pet.lastFed = Date.now();
  }
}

// ============================================
// 명령어 도움말
// ============================================

const commandHelp = {
  food: {
    title: '🍽️ 먹이 명령어',
    commands: [
      { cmd: '밥, 먹이, feed', desc: '🥕 당근 드롭' },
      { cmd: '좋아요, ❤️, 하트', desc: '🍎 사과 드롭' },
      { cmd: '간식, snack', desc: '🍪 쿠키 드롭' },
      { cmd: '고기, meat', desc: '🍖 고기 드롭' },
      { cmd: '케이크, cake', desc: '🍰 케이크 드롭' },
      { cmd: '두쫀쿠, 쫀쿠', desc: '🟤 두쫀쿠 드롭' }
    ]
  },
  interaction: {
    title: '💕 상호작용 명령어',
    commands: [
      { cmd: '쓰다듬, 귀여워', desc: '모든 펫 쓰다듬기' },
      { cmd: '점프, jump', desc: '모든 펫 점프' },
      { cmd: '춤, dance', desc: '모든 펫 춤추기' },
      { cmd: '잠, sleep', desc: '모든 펫 재우기' },
      { cmd: '일어나, wake', desc: '모든 펫 깨우기' }
    ]
  },
  weather: {
    title: '🌤️ 날씨 명령어',
    commands: [
      { cmd: '비, rain', desc: '🌧️ 비 내리기' },
      { cmd: '눈, snow', desc: '❄️ 눈 내리기' },
      { cmd: '밤, night', desc: '🌙 밤 되기' },
      { cmd: '맑음, sunny', desc: '☀️ 맑아지기' },
      { cmd: '무지개, rainbow', desc: '🌈 무지개 나타남' }
    ]
  },
  event: {
    title: '🎉 이벤트 명령어',
    commands: [
      { cmd: '파티, party', desc: '🎊 파티 시작' },
      { cmd: '불꽃, firework', desc: '🎆 불꽃놀이' },
      { cmd: '꽃, flower', desc: '🌸 꽃비' },
      { cmd: '풍선, balloon', desc: '🎈 풍선' },
      { cmd: '선물, gift', desc: '🌟 황금먹이 5개' }
    ]
  }
};

function showCommandHelp() {
  const modal = document.getElementById('commandHelpModal');
  if (modal) {
    modal.style.display = 'flex';
    return;
  }

  // 모달 생성
  const helpModal = document.createElement('div');
  helpModal.id = 'commandHelpModal';
  helpModal.className = 'help-modal';
  helpModal.innerHTML = `
    <div class="help-content">
      <div class="help-header">
        <h2>📖 명령어 도움말</h2>
        <button class="help-close" onclick="closeCommandHelp()">✕</button>
      </div>
      <div class="help-body">
        ${Object.values(commandHelp).map(category => `
          <div class="help-category">
            <h3>${category.title}</h3>
            <div class="help-commands">
              ${category.commands.map(cmd => `
                <div class="help-cmd">
                  <span class="cmd-text">${cmd.cmd}</span>
                  <span class="cmd-desc">${cmd.desc}</span>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
        <div class="help-category">
          <h3>💰 후원 보상</h3>
          <div class="help-commands">
            <div class="help-cmd"><span class="cmd-text">~1,000원</span><span class="cmd-desc">⚪ 커먼 펫</span></div>
            <div class="help-cmd"><span class="cmd-text">1,000~5,000원</span><span class="cmd-desc">🟢 레어 펫</span></div>
            <div class="help-cmd"><span class="cmd-text">5,000~10,000원</span><span class="cmd-desc">🔵 에픽 펫 + 황금먹이</span></div>
            <div class="help-cmd"><span class="cmd-text">10,000~50,000원</span><span class="cmd-desc">🟣 레전더리 펫 + 하트분수</span></div>
            <div class="help-cmd"><span class="cmd-text">50,000원+</span><span class="cmd-desc">🟡 미식 펫 + 전체파티</span></div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(helpModal);
}

function closeCommandHelp() {
  const modal = document.getElementById('commandHelpModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// 전역으로 노출
window.showCommandHelp = showCommandHelp;
window.closeCommandHelp = closeCommandHelp;

// ============================================
// 설정 & 펫 초기화
// ============================================

function resetPets() {
  if (!confirm('정말로 모든 펫을 초기화하시겠습니까?\n(기본 펫 제외, 저장된 데이터도 삭제됩니다)')) {
    return;
  }

  // 기본 펫 제외하고 모두 삭제
  const petsToRemove = gameState.pets.filter(p => !p.isDefault);
  petsToRemove.forEach(pet => {
    const petEl = document.getElementById(`pet-${pet.id}`);
    if (petEl) petEl.remove();
  });

  // 기본 펫만 남기기
  gameState.pets = gameState.pets.filter(p => p.isDefault);

  // 먹이도 모두 삭제
  gameState.foods.forEach(food => {
    const foodEl = document.getElementById(`food-${food.id}`);
    if (foodEl) foodEl.remove();
  });
  gameState.foods = [];

  // 통계 초기화
  gameState.stats.totalPets = gameState.pets.length;
  gameState.stats.totalPetsEver = gameState.pets.length;
  gameState.stats.totalFeedings = 0;
  gameState.stats.totalSubscribers = 0;
  gameState.stats.totalSuperchats = 0;
  gameState.stats.totalSuperchatAmount = 0;
  gameState.stats.highestPetLevel = 1;

  // localStorage 삭제
  localStorage.removeItem('healingPetFarm_save');

  // UI 업데이트
  updateStats();
  updateRanking();

  addLog('🗑️ 모든 펫이 초기화되었습니다!', 'chat');
  closeSettings();
}

function showSettings() {
  let modal = document.getElementById('settingsModal');
  if (modal) {
    modal.style.display = 'flex';
    return;
  }

  // 설정 모달 생성
  modal = document.createElement('div');
  modal.id = 'settingsModal';
  modal.className = 'settings-modal';
  modal.innerHTML = `
    <div class="settings-content">
      <div class="settings-header">
        <h2>⚙️ 설정</h2>
        <button class="settings-close" onclick="closeSettings()">✕</button>
      </div>
      <div class="settings-body">
        <div class="settings-section">
          <h3>🎮 게임 설정</h3>
          <div class="settings-item">
            <label>
              <input type="checkbox" id="settingAutoSave" ${gameState.settings.autoSave ? 'checked' : ''} onchange="toggleAutoSave()">
              자동 저장 (5분마다)
            </label>
          </div>
          <div class="settings-item">
            <label>
              <input type="checkbox" id="settingShowLog" ${gameState.settings.showEventLog ? 'checked' : ''} onchange="toggleEventLog()">
              이벤트 로그 표시
            </label>
          </div>
        </div>

        <div class="settings-section">
          <h3>🎵 사운드 설정</h3>
          <div class="settings-item">
            <label>
              <input type="checkbox" id="settingBGM" ${bgmSystem.isPlaying ? 'checked' : ''} onchange="toggleBGMSetting()">
              힐링 배경음악
            </label>
          </div>
          <div class="settings-item volume-control">
            <label>볼륨</label>
            <input type="range" id="settingVolume" min="0" max="100" value="${bgmSystem.volume * 100}" onchange="setBGMVolume(this.value)">
            <span id="volumeValue">${Math.round(bgmSystem.volume * 100)}%</span>
          </div>
        </div>

        <div class="settings-section danger-zone">
          <h3>⚠️ 위험 구역</h3>
          <div class="settings-item">
            <button class="danger-btn" onclick="resetPets()">
              🗑️ 모든 펫 초기화
            </button>
            <p class="danger-desc">기본 펫을 제외한 모든 펫과 저장 데이터가 삭제됩니다.</p>
          </div>
        </div>

        <div class="settings-section">
          <h3>📊 현재 통계</h3>
          <div class="stats-grid">
            <div class="stat-item">
              <span class="stat-label">총 펫 수</span>
              <span class="stat-value">${gameState.pets.length}마리</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">총 구독자</span>
              <span class="stat-value">${gameState.stats.totalSubscribers}명</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">총 후원</span>
              <span class="stat-value">${gameState.stats.totalSuperchats}회</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">후원 금액</span>
              <span class="stat-value">₩${gameState.stats.totalSuperchatAmount.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // 모달 외부 클릭시 닫기
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeSettings();
    }
  });
}

function closeSettings() {
  const modal = document.getElementById('settingsModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

function toggleAutoSave() {
  gameState.settings.autoSave = document.getElementById('settingAutoSave').checked;
  addLog(gameState.settings.autoSave ? '💾 자동 저장 활성화' : '💾 자동 저장 비활성화', 'chat');
}

function toggleEventLog() {
  gameState.settings.showEventLog = document.getElementById('settingShowLog').checked;
  const logPanel = document.querySelector('.event-log');
  if (logPanel) {
    logPanel.style.display = gameState.settings.showEventLog ? 'block' : 'none';
  }
}

function toggleBGMSetting() {
  const isPlaying = bgmSystem.toggle();
  document.getElementById('settingBGM').checked = isPlaying;
}

function setBGMVolume(value) {
  const vol = parseInt(value) / 100;
  bgmSystem.setVolume(vol);
  document.getElementById('volumeValue').textContent = `${Math.round(vol * 100)}%`;
}

// ============================================
// 힐링 배경음악 시스템
// ============================================

const bgmSystem = {
  isPlaying: false,
  volume: 0.3,
  audioElement: null,

  // 로컬 BGM 파일 (캐시 방지)
  bgmUrl: '/audio/bgm.mp3?v=' + Date.now(),

  init() {
    // 오디오 요소 생성
    this.audioElement = document.createElement('audio');
    this.audioElement.loop = true;
    this.audioElement.volume = this.volume;
    this.audioElement.src = this.bgmUrl;
    this.audioElement.preload = 'auto';

    // 로드 이벤트
    this.audioElement.addEventListener('canplaythrough', () => {
      console.log('🎵 BGM 로드 완료');
    });

    this.audioElement.addEventListener('error', (e) => {
      console.error('🎵 BGM 로드 실패:', e);
    });

    console.log('🎵 BGM 시스템 초기화됨');
  },

  play() {
    if (this.isPlaying) return;
    if (!this.audioElement) return;

    this.audioElement.play().then(() => {
      this.isPlaying = true;
      console.log('🎵 BGM 재생 시작');
      addLog('🎵 힐링 배경음악 시작', 'chat');
    }).catch(e => {
      console.error('🎵 BGM 재생 실패:', e.message);
    });
  },

  pause() {
    if (!this.audioElement) return;
    this.audioElement.pause();
    this.isPlaying = false;
    console.log('🎵 BGM 일시정지');
  },

  stop() {
    if (!this.audioElement) return;
    this.audioElement.pause();
    this.audioElement.currentTime = 0;
    this.isPlaying = false;
    addLog('🔇 배경음악 정지', 'chat');
  },

  toggle() {
    if (this.isPlaying) {
      this.stop();
    } else {
      this.play();
    }
    return this.isPlaying;
  },

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.audioElement) {
      this.audioElement.volume = this.volume;
    }
  }
};

// BGM 시스템 초기화
bgmSystem.init();

// 효과음 시스템 초기화
soundSystem.init();

// 전역으로 노출
window.bgmSystem = bgmSystem;
window.soundSystem = soundSystem;
window.toggleBGM = () => bgmSystem.toggle();

// 소리 테스트 함수
window.testSound = function() {
  console.log('=== 소리 테스트 ===');
  console.log('soundEnabled:', gameState.settings.soundEnabled);

  // 강제로 soundEnabled 켜기
  gameState.settings.soundEnabled = true;

  console.log('eat 사운드 재생 시도...');
  soundSystem.play('eat');
};

// Web Audio API 직접 테스트 (가장 확실한 방법)
window.beep = function() {
  console.log('=== Web Audio API 비프 테스트 ===');

  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();

    // suspended 상태 처리
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = 440;

    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.3);

    console.log('✅ 비프음 재생됨 (440Hz, 0.3초)');
    console.log('AudioContext 상태:', ctx.state);
  } catch (e) {
    console.error('❌ Web Audio API 실패:', e);
  }
};

// 사운드 시스템 상태 확인
window.checkAudio = function() {
  console.log('=== 오디오 시스템 상태 ===');
  console.log('1. soundEnabled:', gameState.settings.soundEnabled);
  console.log('2. soundVolume:', gameState.settings.soundVolume);
  console.log('3. soundSystem.initialized:', soundSystem.initialized);
  console.log('4. 등록된 사운드:', Object.keys(soundSystem.sounds).length, '개');
  console.log('');
  if (!gameState.settings.soundEnabled) {
    console.log('⚠️ 소리가 비활성화되어 있습니다!');
    console.log('💡 활성화하려면: enableSound()');
  } else {
    console.log('✅ 소리 활성화됨');
    console.log('💡 테스트하려면: testSound()');
  }
};

// 소리 활성화 함수
window.enableSound = function() {
  gameState.settings.soundEnabled = true;
  saveGame(true);
  console.log('✅ 소리 활성화됨!');
  console.log('💡 테스트하려면: testSound()');
};

// 소리 비활성화 함수
window.disableSound = function() {
  gameState.settings.soundEnabled = false;
  saveGame(true);
  console.log('🔇 소리 비활성화됨');
};

// 전역으로 노출
window.showSettings = showSettings;
window.closeSettings = closeSettings;
window.resetPets = resetPets;
window.toggleAutoSave = toggleAutoSave;
window.toggleEventLog = toggleEventLog;
window.toggleBGMSetting = toggleBGMSetting;
window.setBGMVolume = setBGMVolume;

// ============================================
// 페이지 종료 시 정리
// ============================================

window.addEventListener('beforeunload', () => {
  // 최종 저장 (먼저 실행)
  saveGame(true);

  // 모든 interval 정리
  intervalManager.clearAll();

  // 사운드 시스템 정리
  // BGM 정리
  if (bgmSystem.audioElement) {
    bgmSystem.stop();
  }
});

// 시스템 노출
window.intervalManager = intervalManager;
window.soundSystem = soundSystem;
window.evolutionSystem = evolutionSystem;

// 디버그 함수
window.debugPets = function() {
  console.log('=== 펫 상태 디버그 ===');
  console.log('총 펫 수:', gameState.pets.length);
  console.log('총 음식 수:', gameState.foods.length);
  gameState.pets.forEach(pet => {
    console.log(`${pet.name}: state=${pet.state}, pos=(${Math.round(pet.x)},${Math.round(pet.y)}), hunger=${Math.round(pet.hunger)}, targetFoodId=${pet.targetFoodId || 'null'}`);
  });
  gameState.foods.forEach(food => {
    console.log(`Food ${food.id}: pos=(${Math.round(food.x)},${Math.round(food.y)}), falling=${food.falling}`);
  });
  console.log('=== 디버그 끝 ===');
};

window.forceIdle = function() {
  console.log('모든 펫을 idle 상태로 강제 변경');
  gameState.pets.forEach(pet => {
    pet.state = 'idle';
    pet.targetX = null;
    pet.targetY = null;
    pet.targetFoodId = null;
    pet.eatingStartTime = null;
  });
};

// 수동 저장 함수
window.forceSave = function() {
  saveGame(true);
  console.log('✅ 수동 저장 완료');
};

// 저장 데이터 확인 함수
window.checkSave = function() {
  try {
    const saved = localStorage.getItem('healingPetFarm_save');
    if (saved) {
      const data = JSON.parse(saved);
      console.log('=== 저장 데이터 ===');
      console.log('버전:', data.version);
      console.log('저장 시간:', new Date(data.lastSaved).toLocaleString());
      console.log('펫 수:', data.pets ? data.pets.length : 0);
      console.log('통계:', data.stats);
      if (data.pets) {
        data.pets.forEach(pet => {
          console.log(`  - ${pet.name} (${pet.emoji}) Lv.${pet.level}`);
        });
      }
    } else {
      console.log('❌ 저장된 데이터가 없습니다.');
    }
  } catch (e) {
    console.error('저장 데이터 확인 실패:', e);
  }
};
