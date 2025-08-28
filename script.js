'use strict';

// --- ELEMENTY UI ---
const loader = document.getElementById('loader');
const loaderStatus = document.getElementById('loader-status');
const header = document.querySelector('header');
const mainContent = document.querySelector('main');
const authContainer = document.getElementById('auth-container');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const classButtons = document.querySelectorAll('.classes button');
const predictBtn = document.getElementById('predictBtn');
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const gallery = document.getElementById('gallery');
const status = document.getElementById('status');
const predictionEl = document.getElementById('prediction');
const clearBtn = document.getElementById('clearBtn');
const overlay = document.getElementById('overlay');
const overlayCtx = overlay.getContext('2d');
const feedbackContainer = document.getElementById('feedback-container');

// --- ZMIENNE GLOBALNE ---
let currentUser = null;
let currentStream = null;
let classifier;
let net;
const classNames = ["KOŁO", "KWADRAT", "TRÓJKĄT"];
let blazeFaceModel;
let detectionIntervalId = null;
let lastDetectedFace = null;
let lastLogits = null;

// --- FUNKCJE AI i KAMERY ---

const tensorToJSON = (tensor) => Array.from(tensor.dataSync());

async function loadClassificationModels() {
  loaderStatus.textContent = "Ładowanie modelu klasyfikacji (MobileNet)...";
  try {
    net = await mobilenet.load();
    classifier = knnClassifier.create();
    return true;
  } catch (e) {
    // POPRAWKA: Komunikat o błędzie na loaderze
    loaderStatus.textContent = "Błąd krytyczny ładowania modeli klasyfikacji.";
    console.error("Błąd MobileNet/KNN:", e);
    return false;
  }
}

async function loadFaceDetectorModel() {
  loaderStatus.textContent = "Ładowanie modelu detekcji twarzy (BlazeFace)...";
  try {
    blazeFaceModel = await blazeface.load();
    return true;
  } catch (e) {
    // POPRAWKA: Komunikat o błędzie na loaderze
    loaderStatus.textContent = "Błąd ładowania modelu detekcji twarzy.";
    console.error("Błąd ładowania modelu BlazeFace:", e);
    return false;
  }
}

async function runDetectionLoop() {
  if (blazeFaceModel && !video.paused && !video.ended) {
    const faces = await blazeFaceModel.estimateFaces(video, false);
    overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
    if (faces.length > 0) {
      lastDetectedFace = faces[0];
      if (feedbackContainer.innerHTML === '') {
        classButtons.forEach(btn => btn.disabled = false);
        predictBtn.disabled = false;
      }
      const start = lastDetectedFace.topLeft;
      const end = lastDetectedFace.bottomRight;
      const size = [end[0] - start[0], end[1] - start[1]];
      overlayCtx.strokeStyle = '#38bdf8';
      overlayCtx.lineWidth = 4;
      overlayCtx.strokeRect(start[0], start[1], size[0], size[1]);
    } else {
      lastDetectedFace = null;
      classButtons.forEach(btn => btn.disabled = true);
      predictBtn.disabled = true;
    }
    detectionIntervalId = setTimeout(runDetectionLoop, 200);
  }
}

function startCamera() {
  stopCamera();
  navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
      currentStream = stream;
      video.srcObject = stream;
      video.play();
      const readyCheckInterval = setInterval(() => {
          if (video.readyState >= 3) {
              clearInterval(readyCheckInterval);
              overlay.width = video.videoWidth;
              overlay.height = video.videoHeight;
              runDetectionLoop();
          }
      }, 200);
      startBtn.disabled = true;
      stopBtn.disabled = false;
    }).catch(err => alert("Błąd kamery: ".concat(err.message)));
}

function stopCamera() {
  if (detectionIntervalId) { clearTimeout(detectionIntervalId); detectionIntervalId = null; }
  if (currentStream) { currentStream.getTracks().forEach(track => track.stop()); currentStream = null; }
  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
  startBtn.disabled = false;
  stopBtn.disabled = true;
  classButtons.forEach(btn => btn.disabled = true);
  predictBtn.disabled = true;
}

// --- LOGIKA FEEDBACKU ---

function clearFeedbackUI() { feedbackContainer.innerHTML = ''; }
function resetPredictionUI() {
    clearFeedbackUI();
    predictionEl.textContent = '';
    if (lastDetectedFace) {
        predictBtn.disabled = false;
        classButtons.forEach(btn => btn.disabled = false);
    }
}
function handleCorrectPrediction(predictedSymbol) {
    logPredictionAttempt(predictedSymbol, true);
    predictionEl.textContent = 'Dziękuję za potwierdzenie!';
    setTimeout(resetPredictionUI, 2000);
}
async function handleIncorrectPrediction(predictedSymbol, correctSymbol, logits) {
    logPredictionAttempt(predictedSymbol, false, correctSymbol);
    classifier.addExample(logits, correctSymbol);
    await saveModel();
    updateStatus();
    logTrainingSample(correctSymbol, 'correction');
    predictionEl.textContent = `Dziękuję! Zapamiętam, że to był ${correctSymbol}.`;
    setTimeout(resetPredictionUI, 2000);
}
function showCorrectionUI(predictedSymbol, logits) {
    clearFeedbackUI();
    feedbackContainer.innerHTML = `
        <p class="feedback-prompt">W takim razie, co to było?</p>
        <div class="feedback-actions">
            ${classNames.map(name => `<button data-correct-symbol="${name}">${name}</button>`).join('')}
        </div>
    `;
    document.querySelectorAll('[data-correct-symbol]').forEach(btn => {
        btn.onclick = () => { handleIncorrectPrediction(predictedSymbol, btn.dataset.correctSymbol, logits); };
    });
}
function showFeedbackUI(result, logits) {
    feedbackContainer.innerHTML = `
        <p class="feedback-prompt">Czy to poprawna odpowiedź?</p>
        <div class="feedback-actions">
            <button id="yesBtn">✅ Tak</button>
            <button id="noBtn">❌ Nie</button>
        </div>
    `;
    document.getElementById('yesBtn').onclick = () => handleCorrectPrediction(result.label);
    document.getElementById('noBtn').onclick = () => showCorrectionUI(result.label, logits);
}

// --- GŁÓWNE FUNKCJE APLIKACJI ---

async function takeSnapshot(label) {
  if (!net || !classifier || !lastDetectedFace) { alert("Najpierw pokaż twarz do kamery!"); return; }
  const faceBox = lastDetectedFace;
  const cropStartX = faceBox.topLeft[0];
  const cropStartY = faceBox.bottomRight[1];
  const cropWidth = (faceBox.bottomRight[0] - faceBox.topLeft[0]);
  const cropHeight = cropWidth;
  const ctx = canvas.getContext('2d');
  canvas.width = 150;
  canvas.height = 150;
  ctx.drawImage(video, cropStartX, cropStartY, cropWidth, cropHeight, 0, 0, 150, 150);
  const img = document.createElement('img');
  img.src = canvas.toDataURL('image/png');
  gallery.appendChild(img);
  const logits = net.infer(canvas, true);
  classifier.addExample(logits, label);
  await saveModel();
  updateStatus();
  logTrainingSample(label, 'manual');
}
async function predict() {
  if (!net || !classifier || !lastDetectedFace) return;
  if (classifier.getNumClasses() < classNames.length) { predictionEl.textContent = `Najpierw dodaj próbki dla wszystkich ${classNames.length} symboli!`; return; }
  predictBtn.disabled = true;
  classButtons.forEach(btn => btn.disabled = true);
  const faceBox = lastDetectedFace;
  const cropStartX = faceBox.topLeft[0];
  const cropStartY = faceBox.bottomRight[1];
  const cropWidth = (faceBox.bottomRight[0] - faceBox.topLeft[0]);
  const cropHeight = cropWidth;
  const ctx = canvas.getContext('2d');
  canvas.width = 150;
  canvas.height = 150;
  ctx.drawImage(video, cropStartX, cropStartY, cropWidth, cropHeight, 0, 0, 150, 150);
  const logits = net.infer(canvas, true);
  const result = await classifier.predictClass(logits);
  predictionEl.textContent = `Model zgaduje: ${result.label} (pewność ${(result.confidences[result.label] * 100).toFixed(1)}%)`;
  showFeedbackUI(result, logits);
}
function updateStatus() {
  if (classifier) {
    const counts = classifier.getClassExampleCount();
    status.textContent = classNames.map(name => `${name}: ${counts[name] || 0}`).join(' | ');
  }
}

// --- LOGIKA FIREBASE ---
async function saveModel() { /* ... bez zmian ... */ }
async function loadModelFromFirebase() { /* ... bez zmian ... */ }
async function clearData() { /* ... bez zmian ... */ }
function logTrainingSample(symbol, source) { /* ... bez zmian ... */ }
function logPredictionAttempt(predictedSymbol, wasCorrect, correctSymbol = null) { /* ... bez zmian ... */ }

// --- ZARZĄDZANIE STANEM LOGOWANIA ---
function handleLoggedOutState() { /* ... bez zmian ... */ }
async function handleLoggedInState(user) { /* ... bez zmian ... */ }

// --- INICJALIZACJA APLIKACJI ---
async function main() {
  const faceDetectorModelLoaded = await loadFaceDetectorModel();
  const classificationModelsLoaded = await loadClassificationModels();
  if (classificationModelsLoaded && faceDetectorModelLoaded) {
    loader.classList.add('fade-out');
    header.classList.remove('content-hidden');
    mainContent.classList.remove('content-hidden');
    loader.addEventListener('transitionend', () => { loader.style.display = 'none'; });
    status.textContent = "Modele gotowe. Zaloguj się, aby rozpocząć.";
    firebase.auth().onAuthStateChanged(user => {
      if (user) { handleLoggedInState(user); } else { handleLoggedOutState(); }
    });
  } else {
      loaderStatus.textContent = "Błąd krytyczny. Nie udało się załadować modeli AI. Odśwież stronę.";
  }
}

// Reszta kodu pozostaje bez zmian, ale wklejam dla kompletności
// Event Listeners
const againBtn = document.getElementById('againBtn');
if (againBtn) { againBtn.addEventListener('click', () => console.log("'Jeszcze raz' clicked")); }
startBtn.addEventListener('click', startCamera);
stopBtn.addEventListener('click', stopCamera);
clearBtn.addEventListener('click', clearData);
classButtons.forEach(btn => {
  btn.addEventListener('click', () => takeSnapshot(btn.dataset.class));
});
predictBtn.addEventListener('click', predict);

// Start!
main();
