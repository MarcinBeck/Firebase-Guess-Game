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

// --- ZMIENNE GLOBALNE ---
let currentUser = null;
let currentStream = null;
let classifier;
let net;
const classNames = ["KOŁO", "KWADRAT", "TRÓJKĄT"];
let blazeFaceModel;
let objectDetectorModel;
let detectionIntervalId = null;
let lastDetectedCardBox = null;

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

async function loadObjectDetectorModel() {
  status.textContent = "Ładowanie modelu COCO-SSD...";
  try {
    objectDetectorModel = await cocoSsd.load();
    return true;
  } catch (e) {
    status.textContent = "Błąd ładowania modelu detekcji obiektów.";
    return false;
  }
}

async function runDetectionLoop() {
  if (!video.paused && !video.ended) {
    const objects = await objectDetectorModel.detect(video);
    const faces = await blazeFaceModel.estimateFaces(video, false);
    
    overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
    
    faces.forEach(face => {
        const start = face.topLeft;
        const end = face.bottomRight;
        const size = [end[0] - start[0], end[1] - start[1]];
        overlayCtx.strokeStyle = '#38bdf8';
        overlayCtx.lineWidth = 4;
        overlayCtx.strokeRect(start[0], start[1], size[0], size[1]);
    });

    const card = objects.find(object => ['book', 'cell phone', 'remote'].includes(object.class));
    if (card) {
        lastDetectedCardBox = card.bbox;
        classButtons.forEach(btn => btn.disabled = false);
        predictBtn.disabled = false;
        overlayCtx.strokeStyle = '#facc15';
        overlayCtx.lineWidth = 4;
        overlayCtx.strokeRect(card.bbox[0], card.bbox[1], card.bbox[2], card.bbox[3]);
        overlayCtx.fillStyle = '#facc15';
        overlayCtx.font = '16px sans-serif';
        overlayCtx.fillText(`Wykryto: ${card.class}`, card.bbox[0] + 5, card.bbox[1] + 20);
    } else {
        lastDetectedCardBox = null;
        classButtons.forEach(btn => btn.disabled = true);
        predictBtn.disabled = true;
    }

    detectionIntervalId = setTimeout(runDetectionLoop, 400);
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

async function takeSnapshot(label) {
  if (!net || !classifier || !lastDetectedCardBox) {
      alert("Najpierw pokaż kartkę do kamery!");
      return;
  }
  const [x, y, width, height] = lastDetectedCardBox;
  canvas.width = 150;
  canvas.height = 150;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, x, y, width, height, 0, 0, 150, 150);
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
  if (!net || !classifier || !lastDetectedCardBox) return;
  if (classifier.getNumClasses() === 0) {
    predictionEl.textContent = "Najpierw dodaj próbki!";
    return;
  }
  const [x, y, width, height] = lastDetectedCardBox;
  const ctx = canvas.getContext('2d');
  canvas.width = 150;
  canvas.height = 150;
  ctx.drawImage(video, x, y, width, height, 0, 0, 150, 150);
  const logits = net.infer(canvas, true);
  const result = await classifier.predictClass(logits);
  predictionEl.textContent = `Wynik: ${result.label} (pewność ${(result.confidences[result.label] * 100).toFixed(1)}%)`;
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
      if (currentUser) { await database.ref(`models/${currentUser.uid}`).remove(); }
      if (classifier) classifier.clearAllClasses();
      gallery.innerHTML = "";
      predictionEl.textContent = "Wyczyszczono dane.";
      updateStatus();
    } catch (error) { console.error("Błąd podczas czyszczenia danych:", error); }
}

// ZMIANA: Dodano logi diagnostyczne
function logTrainingSample(symbol, source) {
    console.log("--> Wywołano logTrainingSample"); // LOG 1
    if (!currentUser) {
        console.error("Błąd statystyk: Użytkownik niezalogowany w momencie logowania próbki."); // LOG 2
        return;
    }

    const sampleData = {
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        symbol: symbol,
        source: source
    };

    const samplesRef = database.ref(`training_samples/${currentUser.uid}`);
    console.log("Zapisuję do ścieżki w Firebase:", samplesRef.toString()); // LOG 3

    samplesRef.push(sampleData)
        .then(() => console.log(`--> SUKCES: Zapisano próbkę w statystykach: ${symbol}`)) // LOG 4
        .catch(error => console.error("--> BŁĄD ZAPISU DO STATYSTYK:", error)); // LOG 5
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

async function main() {
  const classificationModelsLoaded = await loadClassificationModels();
  const faceDetectorModelLoaded = await loadFaceDetectorModel();
  const objectDetectorModelLoaded = await loadObjectDetectorModel();
  if (classificationModelsLoaded && faceDetectorModelLoaded && objectDetectorModelLoaded) {
    status.textContent = "Wszystkie modele gotowe. Zaloguj się, aby rozpocząć.";
    firebase.auth().onAuthStateChanged(user => {
      if (user) { handleLoggedInState(user); } else { handleLoggedOutState(); }
    });
  } else {
      status.textContent = "Błąd krytyczny. Nie udało się załadować wszystkich modeli AI.";
  }
}

// --- EVENT LISTENERS ---
const againBtn = document.getElementById('againBtn');
if (againBtn) { againBtn.addEventListener('click', () => console.log("'Jeszcze raz' clicked")); }
startBtn.addEventListener('click', startCamera);
stopBtn.addEventListener('click', stopCamera);
clearBtn.addEventListener('click', clearData);
classButtons.forEach(btn => {
  btn.addEventListener('click', () => takeSnapshot(btn.dataset.class));
});
predictBtn.addEventListener('click', predict);

// --- START ---
main();
