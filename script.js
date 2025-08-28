'use strict';

// --- ELEMENTY UI ---
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
  status.textContent = "Ładowanie modelu MobileNet...";
  try {
    net = await mobilenet.load();
    classifier = knnClassifier.create();
    return true;
  } catch (e) {
    status.textContent = "Błąd krytyczny ładowania modeli klasyfikacji.";
    return false;
  }
}

async function loadFaceDetectorModel() {
  status.textContent = "Ładowanie modelu BlazeFace...";
  try {
    blazeFaceModel = await blazeface.load();
    return true;
  } catch (e) {
    status.textContent = "Błąd ładowania modelu detekcji twarzy.";
    return false;
  }
}

async function runDetectionLoop() {
  if (blazeFaceModel && !video.paused && !video.ended) {
    const faces = await blazeFaceModel.estimateFaces(video, false);
    
    overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
    
    if (faces.length > 0) {
      lastDetectedFace = faces[0];
      // Włączaj przyciski tylko, jeśli predykcja nie jest w toku
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
  if (detectionIntervalId) {
    clearTimeout(detectionIntervalId);
    detectionIntervalId = null;
  }
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
    currentStream = null;
  }
  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
  startBtn.disabled = false;
  stopBtn.disabled = true;
  classButtons.forEach(btn => btn.disabled = true);
  predictBtn.disabled = true;
}

// --- LOGIKA FEEDBACKU ---

function clearFeedbackUI() {
    feedbackContainer.innerHTML = '';
}

function resetPredictionUI() {
    clearFeedbackUI();
    predictionEl.textContent = '';
    // Włącz przyciski z powrotem, jeśli twarz jest wykryta
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
        btn.onclick = () => {
            handleIncorrectPrediction(predictedSymbol, btn.dataset.correctSymbol, logits);
        };
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
  if (!net || !classifier || !lastDetectedFace) {
      alert("Najpierw pokaż twarz do kamery!");
      return;
  }
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
  if (classifier.getNumClasses() < classNames.length) {
    predictionEl.textContent = `Najpierw dodaj próbki dla wszystkich ${classNames.length} symboli!`;
    return;
  }

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
async function saveModel() {
  if (!currentUser || !classifier) return;
  const dataset = classifier.getClassifierDataset();
  const modelPath = `models/${currentUser.uid}`;
  if (Object.keys(dataset).length === 0) { await database.ref(modelPath).remove(); return; };
  const serializedDataset = {};
  for (const key of Object.keys(dataset)) { serializedDataset[key] = tensorToJSON(dataset[key]); }
  await database.ref(modelPath).set(serializedDataset);
}

async function loadModelFromFirebase() {
  if (!currentUser || !classifier) return;
  classifier.clearAllClasses();
  gallery.innerHTML = "";
  const modelPath = `models/${currentUser.uid}`;
  const snapshot = await database.ref(modelPath).once('value');
  const serializedDataset = snapshot.val();
  if (serializedDataset) {
    const dataset = {};
    for (const key of Object.keys(serializedDataset)) {
        const data = serializedDataset[key];
        const shape = [data.length / 1024, 1024];
        dataset[key] = tf.tensor2d(data, shape);
    }
    if(classifier) classifier.setClassifierDataset(dataset);
  }
  updateStatus();
}

async function clearData() {
    if (!confirm("Czy na pewno chcesz usunąć wszystkie zebrane próbki?")) return;
    try {
      if (currentUser) {
        await database.ref(`models/${currentUser.uid}`).remove();
        await database.ref(`training_samples/${currentUser.uid}`).remove();
        await database.ref(`prediction_attempts/${currentUser.uid}`).remove();
      }
      if (classifier) classifier.clearAllClasses();
      gallery.innerHTML = "";
      predictionEl.textContent = "Wyczyszczono dane.";
      updateStatus();
    } catch (error) { console.error("Błąd podczas czyszczenia danych:", error); }
}

function logTrainingSample(symbol, source) {
    if (!currentUser) return;
    const sampleData = { timestamp: firebase.database.ServerValue.TIMESTAMP, symbol: symbol, source: source };
    database.ref(`training_samples/${currentUser.uid}`).push(sampleData);
}

function logPredictionAttempt(predictedSymbol, wasCorrect, correctSymbol = null) {
    if (!currentUser) return;
    const attemptData = {
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        predictedSymbol: predictedSymbol,
        wasCorrect: wasCorrect
    };
    if (!wasCorrect && correctSymbol) {
        attemptData.correctSymbol = correctSymbol;
    }
    database.ref(`prediction_attempts/${currentUser.uid}`).push(attemptData);
}

// --- ZARZĄDZANIE STANEM LOGOWANIA ---
function handleLoggedOutState() {
  currentUser = null;
  stopCamera();
  authContainer.innerHTML = '<button id="login-btn">Zaloguj jako Gość</button>';
  status.textContent = "Zaloguj się, aby rozpocząć.";
  predictionEl.textContent = "";
  gallery.innerHTML = "";
  clearBtn.disabled = true;
  if(classifier) classifier.clearAllClasses();
  document.getElementById('login-btn').addEventListener('click', () => { firebase.auth().signInAnonymously(); });
}

async function handleLoggedInState(user) {
  currentUser = user;
  authContainer.innerHTML = `<span class="welcome-message">Witaj, Gościu!</span><button id="logout-btn" class="logout-btn">Wyloguj</button>`;
  document.getElementById('logout-btn').addEventListener('click', () => firebase.auth().signOut());
  clearBtn.disabled = false;
  status.textContent = "Wczytywanie zapisanego modelu...";
  await loadModelFromFirebase();
}

// --- INICJALIZACJA APLIKACJI ---
async function main() {
  const faceDetectorModelLoaded = await loadFaceDetectorModel();
  const classificationModelsLoaded = await loadClassificationModels();
  if (classificationModelsLoaded && faceDetectorModelLoaded) {
    status.textContent = "Modele gotowe. Zaloguj się, aby rozpocząć.";
    firebase.auth().onAuthStateChanged(user => {
      if (user) { handleLoggedInState(user); } else { handleLoggedOutState(); }
    });
  } else {
      status.textContent = "Błąd krytyczny ładowania modeli AI.";
  }
}

// Event Listeners (bez zmian)
startBtn.addEventListener('click', startCamera);
stopBtn.addEventListener('click', stopCamera);
clearBtn.addEventListener('click', clearData);
classButtons.forEach(btn => {
  btn.addEventListener('click', () => takeSnapshot(btn.dataset.class));
});
predictBtn.addEventListener('click', predict);

// Start!
main();
