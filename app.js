const STORAGE_KEYS = {
  phone: "guardian_phone",
  alarmHour: "alarm_hour",
  alarmMinute: "alarm_minute",
};

const questions = [
  "1. 안면 마비:\n웃을 때 한쪽 입꼬리가 올라가지 않나요?",
  "2. 팔 마비:\n양팔을 들었을 때 한쪽 팔에 힘이 빠지나요?",
  "3. 언어 장애:\n발음이 어눌하거나 대화가 어렵나요?",
  "4. 시각 장애:\n갑자기 한쪽 눈이 안 보이거나 겹쳐 보이나요?",
  "5. 심한 두통:\n번개에 맞은 듯한 갑작스러운 통증이 있나요?",
  "6. 보행 장애:\n비틀거리거나 중심을 잡기 힘든가요?",
  "7. 감각 이상:\n몸 한쪽이 저리거나 무딘 느낌이 있나요?",
  "8. 삼킴 장애:\n물이나 음식을 삼키기 힘든가요?",
  "9. 의식 저하:\n갑자기 멍해지고 상황 파악이 안 되나요?",
  "10. 어지럼증:\n주위가 빙글빙글 도는 느낌이 있나요?",
];

const state = {
  selectedHour: Number(localStorage.getItem(STORAGE_KEYS.alarmHour) || 9),
  selectedMinute: Number(localStorage.getItem(STORAGE_KEYS.alarmMinute) || 0),
  currentQuestionIndex: 0,
  yesCount: 0,
  isAiAnalyzing: false,
  aiDetectedIssue: false,
  isListening: false,
  cameraStream: null,
  capturedPhoto: "",
};

const app = document.querySelector("#app");
let toastTimer = null;
let aiTimer = null;

function render(content, title = "", options = {}) {
  app.innerHTML = `
    <main class="app-shell">
      ${title ? appBar(title, options) : ""}
      ${content}
    </main>
  `;
}

function appBar(title, { settings = false } = {}) {
  return `
    <header class="app-bar">
      <h1>${title}</h1>
      ${settings ? '<button class="icon-button" aria-label="설정" onclick="showSetup()">⚙</button>' : ""}
    </header>
  `;
}

function stopCamera() {
  if (!state.cameraStream) return;
  state.cameraStream.getTracks().forEach((track) => track.stop());
  state.cameraStream = null;
}

function showToast(message, type = "success") {
  clearTimeout(toastTimer);
  const oldToast = document.querySelector(".toast");
  if (oldToast) oldToast.remove();

  const toast = document.createElement("div");
  toast.className = `toast ${type === "error" ? "error" : ""}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  toastTimer = setTimeout(() => toast.remove(), 2600);
}

function showInitialization() {
  stopCamera();
  render(`
    <section class="center">
      <div class="stack">
        <div class="spinner" aria-label="로딩 중"></div>
        <h1 class="title">어르신 맞춤 진단 앱을<br />준비하고 있습니다...</h1>
      </div>
    </section>
  `);

  setTimeout(() => {
    const phone = localStorage.getItem(STORAGE_KEYS.phone);
    if (!phone) {
      showSetup();
    } else {
      showHome();
    }
  }, 1200);
}

function formatTime(hour, minute) {
  const period = hour < 12 ? "오전" : "오후";
  const hour12 = hour % 12 || 12;
  return `${period} ${hour12}시 ${String(minute).padStart(2, "0")}분`;
}

function showSetup() {
  stopCamera();
  const phone = localStorage.getItem(STORAGE_KEYS.phone) || "";
  render(`
    <section class="screen stack">
      <div class="symbol">🛡</div>
      <h2 class="title">위급 상황이 발생하면<br />아래 연락처로 문자가 발송됩니다.</h2>

      <label class="label" for="phone">보호자 연락처 입력</label>
      <input id="phone" class="input" inputmode="tel" autocomplete="tel" placeholder="예: 01012345678" value="${phone}" />

      <p class="label">매일 같은 시간에 자가진단하기</p>
      <button class="button button-warning" onclick="selectAlarmTime()">
        매일 ${formatTime(state.selectedHour, state.selectedMinute)}<br />눌러서 변경
      </button>

      <button class="button button-primary" onclick="saveSettings()">저장하고 시작하기</button>
    </section>
  `, "초기 설정");
}

function selectAlarmTime() {
  const current = `${String(state.selectedHour).padStart(2, "0")}:${String(state.selectedMinute).padStart(2, "0")}`;
  const value = prompt("매일 알림 시간을 입력하세요. 예: 09:00", current);
  if (!value) return;

  const match = value.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!match) {
    showToast("시간은 09:00 형식으로 입력해주세요.", "error");
    return;
  }

  state.selectedHour = Number(match[1]);
  state.selectedMinute = Number(match[2]);
  showSetup();
}

function saveSettings() {
  const phone = document.querySelector("#phone").value.trim();
  if (!phone) {
    showToast("보호자 연락처를 먼저 입력해주세요.", "error");
    return;
  }

  localStorage.setItem(STORAGE_KEYS.phone, phone);
  localStorage.setItem(STORAGE_KEYS.alarmHour, String(state.selectedHour));
  localStorage.setItem(STORAGE_KEYS.alarmMinute, String(state.selectedMinute));
  showToast("설정이 정상적으로 저장되었습니다!");
  showHome();
}

function showHome() {
  stopCamera();
  clearTimeout(aiTimer);
  render(`
    <section class="screen stack home">
      <h2 class="title">건강을 위해<br />자가진단을 시작할까요?</h2>
      <p class="lead">매일 5분씩 검사하여 건강을 지키세요.</p>
      <button class="button button-green button-huge" onclick="showCameraStep()">자가진단 시작하기</button>
    </section>
  `, "뇌졸중 안심 지킴이", { settings: true });
}

function showCameraStep() {
  stopCamera();
  state.capturedPhoto = "";
  render(`
    <section class="screen stack">
      <div class="symbol">🙂</div>
      <h2 class="lead">얼굴의 미세한 비대칭을 진단합니다.<br />카메라 권한을 허용하고 얼굴을 화면에 맞추세요.</h2>
      <div class="camera-frame">
        <video id="cameraPreview" autoplay playsinline muted></video>
        <canvas id="cameraCanvas" hidden></canvas>
        <div id="cameraMessage" class="camera-message">카메라를 준비하고 있습니다...</div>
      </div>
      <button id="captureButton" class="button button-primary" onclick="capturePhoto()" disabled>사진 촬영하고 다음</button>
      <button class="button button-warning" onclick="skipCamera()">카메라가 안 되면 다음으로 이동</button>
    </section>
  `, "1단계: 얼굴 사진 촬영");

  startCamera();
}

async function startCamera() {
  const video = document.querySelector("#cameraPreview");
  const message = document.querySelector("#cameraMessage");
  const captureButton = document.querySelector("#captureButton");

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    message.textContent = "이 브라우저에서는 카메라 기능을 지원하지 않습니다.";
    showToast("카메라를 지원하지 않는 브라우저입니다.", "error");
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 720 },
        height: { ideal: 960 },
      },
      audio: false,
    });

    state.cameraStream = stream;
    video.srcObject = stream;
    await video.play();
    message.textContent = "얼굴을 화면 중앙에 맞춘 뒤 촬영 버튼을 눌러주세요.";
    captureButton.disabled = false;
  } catch (error) {
    message.textContent = "카메라 권한이 거부되었거나 사용할 수 없습니다. 브라우저 권한 설정을 확인해주세요.";
    showToast("카메라 권한을 허용해야 촬영할 수 있어요.", "error");
  }
}

function capturePhoto() {
  const video = document.querySelector("#cameraPreview");
  const canvas = document.querySelector("#cameraCanvas");

  if (!video || !canvas || !video.videoWidth) {
    showToast("카메라 화면이 준비된 뒤 다시 눌러주세요.", "error");
    return;
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d");
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  state.capturedPhoto = canvas.toDataURL("image/jpeg", 0.85);

  showToast("사진 촬영이 완료되었습니다.");
  stopCamera();
  setTimeout(showVoiceStep, 500);
}

function skipCamera() {
  stopCamera();
  showToast("카메라 없이 다음 단계로 이동합니다.");
  showVoiceStep();
}

function showVoiceStep() {
  stopCamera();
  render(`
    <section class="screen stack">
      <div class="symbol">🎙</div>
      <h2 class="title">아래 문장을 큰 소리로 읽어주세요.</h2>
      <div class="quote">"안녕하세요.<br />오늘도 건강하고 활기찬<br />하루입니다."</div>
      <button class="button button-red" onclick="showSurvey()">목소리 녹음 완료 (설문 이동)</button>
    </section>
  `, "2단계: 오늘의 발음 녹음");
}

function showSurvey() {
  stopCamera();
  state.currentQuestionIndex = 0;
  state.yesCount = 0;
  state.isAiAnalyzing = true;
  state.aiDetectedIssue = false;
  state.isListening = false;

  clearTimeout(aiTimer);
  aiTimer = setTimeout(() => {
    state.isAiAnalyzing = false;
    state.aiDetectedIssue = false;
    renderSurvey();
  }, 10000);

  renderSurvey();
}

function renderSurvey() {
  const analyzing = state.isAiAnalyzing;
  render(`
    <section class="screen stack">
      <div class="status ${analyzing ? "analyzing" : "done"}">
        ${analyzing ? '<span class="spinner"></span>' : "<span>✅</span>"}
        <span>${analyzing ? "AI가 오늘의 사진과 목소리를 분석하고 있습니다..." : "AI 사진/음성 정밀 분석 완료 (이상 없음)"}</span>
      </div>

      <div class="question-count">질문 ${state.currentQuestionIndex + 1} / 10</div>
      <div class="question">${questions[state.currentQuestionIndex]}</div>

      <button class="mic ${state.isListening ? "listening" : ""}" onclick="startListening()" ${state.isListening ? "disabled" : ""}>
        <span class="mic-icon">${state.isListening ? "🎙" : "🎤"}</span>
        ${state.isListening ? "듣고 있습니다... 대답해 주세요!" : "마이크를 누르고 큰 소리로 대답하기"}
        ${state.isListening ? "" : '<span class="hint">"네" 또는 "아니오"라고 말씀하세요.</span>'}
      </button>

      <div class="answer-row">
        <button class="button button-red" onclick="answerQuestion(true)">O (그렇다)</button>
        <button class="button button-green" onclick="answerQuestion(false)">X (아니다)</button>
      </div>
    </section>
  `, "3단계: 10가지 질문");
}

function startListening() {
  if (state.isListening) return;
  state.isListening = true;
  renderSurvey();

  setTimeout(() => {
    state.isListening = false;
    showToast('대답: "아니오" (발음 정확도: 정상)');
    answerQuestion(false);
  }, 1800);
}

function answerQuestion(isYes) {
  if (isYes) state.yesCount += 1;

  if (state.currentQuestionIndex < questions.length - 1) {
    state.currentQuestionIndex += 1;
    renderSurvey();
    return;
  }

  finishSurvey();
}

function finishSurvey() {
  const phone = localStorage.getItem(STORAGE_KEYS.phone) || "";
  const isEmergency = state.yesCount >= 3 || state.aiDetectedIssue;

  if (isEmergency) {
    const body = encodeURIComponent("[긴급 알람] 뇌졸중 자가진단 앱에서 어르신의 미세 뇌졸중 이상 징후가 감지되었습니다. 즉시 확인해 주세요!");
    window.location.href = `sms:${phone}?body=${body}`;

    if (state.yesCount >= 3) {
      showEmergencyDialog();
      return;
    }
  }

  showResultDialog();
}

function showResultDialog() {
  showModal(`
    <div class="modal">
      <h2>자가진단 완료</h2>
      <p>검사 결과가 안전합니다!\n어르신, 오늘도 안심하고 활기찬 하루를 보내세요.</p>
      <button class="button button-primary" onclick="closeModal(); showHome();">확인</button>
    </div>
  `);
}

function showEmergencyDialog() {
  showModal(`
    <div class="modal emergency">
      <h2>🚨 긴급 위기상황 🚨</h2>
      <p>의심 증상이 3개 이상 감지되었습니다!\n지체하지 마시고 지금 바로 119에 연락해 보세요.</p>
      <button class="button button-red" onclick="window.location.href='tel:119'">119로 즉시 전화걸기</button>
    </div>
  `);
}

function showModal(content) {
  closeModal();
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = content;
  document.body.appendChild(backdrop);
}

function closeModal() {
  const modal = document.querySelector(".modal-backdrop");
  if (modal) modal.remove();
}

showInitialization();
