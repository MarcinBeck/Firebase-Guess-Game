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

// --- ZMIENNE GLOBALNE ---
let currentUser = null;
let currentStream = null;
let classifier;
let net;
const classNames = ["KOŁO", "KWADRAT", "TRÓJKĄT"];
let faceDetectionInterval = null;

// --- FUNKCJE AI i KAMERY ---

const tensorToJSON = (tensor) => Array.from(tensor.dataSync());

async function loadModels() {
  status.textContent = "Inicjalizacja backendu AI...";
  try {
    await tf.setBackend('cpu');
    console.log("Backend AI został ustawiony na CPU.");
  } catch (e) {
    console.error("Nie udało się ustawić backendu AI.", e);
    status.textContent = "Błąd krytyczny inicjalizacji AI.";
    return false;
  }

  status.textContent = "Ładowanie modelu MobileNet...";
  try {
    net = await mobilenet.load();
    classifier = knnClassifier.create();
    return true;
  } catch (e) {
    status.textContent = "Błąd krytyczny ładowania modeli AI.";
    console.error(e);
    return false;
  }
}

async function loadFaceApiModels() {
  status.textContent = "Ładowanie modeli do analizy twarzy...";
  try {
    const MODEL_URL = './models';
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL);
    await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
    console.log("Modele face-api załadowane.");
    return true;
  } catch(e) {
    console.error("Błąd ładowania modeli face-api:", e);
    status.textContent = "Błąd ładowania modeli do analizy twarzy.";
    return false;
  }
}

function startCamera() {
  stopCamera();
  navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
      currentStream = stream;
      video.srcObject = stream;
      // KLUCZOWA POPRAWKA - UPEWNIAMY SIĘ, ŻE WIDEO JEST URUCHOMIONE
      video.play();

      video.addEventListener('play', () => {
        const displaySize = { width: video.clientWidth, height: video.clientHeight };
        faceapi.matchDimensions(overlay, displaySize);
        
        faceDetectionInterval = setInterval(async () => {
          if (!video.paused && !video.ended) {
            const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceExpressions();
            
            overlay.getContext('2d').clearRect(0, 0, overlay.width, overlay.height);

            if (detections && detections.length > 0) {
              const resizedDetections = faceapi.resizeResults(detections, displaySize);
              faceapi.draw.drawDetections(overlay, resizedDetections);
              faceapi.draw.drawFaceExpressions(overlay, resizedDetections);
            }
          }
        }, 200);
      });

      startBtn.disabled = true;
      stopBtn.disabled = false;
      classButtons.forEach(btn => btn.disabled = false);
      predictBtn.disabled = false;
    }).catch(err => alert("Błąd kamery: ".concat(err.message)));
}

function stopCamera() {
  if (faceDetectionInterval) {
    clearInterval(faceDetectionInterval);
    faceDetectionInterval = null;
  }
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
    currentStream = null;
  }
  if (overlay) {
    overlay.getContext('2d').clearRect(0, 0, overlay.width, overlay.height);
  }

  startBtn.disabled = false;
  stopBtn.disabled = true;
  classButtons.forEach(btn => btn.disabled = true);
  predictBtn.disabled = true;
}

async function takeSnapshot(label) {
  if (!net || !classifier) return;
  const ctx = canvas.getContext('2d');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const img = document.createElement('img');
  img.src = canvas.toDataURL('image/png');
  gallery.appendChild(img);

  const logits = net.infer(canvas, true);
  classifier.addExample(logits, label);
  
  await saveModel();
  updateStatus();
}

async function predict() {
  if (!net || !classifier) return;
  if (classifier.getNumClasses() === 0) {
    predictionEl.textContent = "Najpierw dodaj próbki!";
    return;
  }
  const logits = net.infer(video, true);
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

  if (Object.keys(dataset).length === 0) {
      await database.ref(modelPath).remove();
      console.log("Model lokalny jest pusty, usunięto wpis w Firebase.");
      return;
  };

  const serializedDataset = {};
  for (const key of Object.keys(dataset)) {
    serializedDataset[key] = tensorToJSON(dataset[key]);
  }
  
  await database.ref(modelPath).set(serializedDataset);
  console.log("Model został zapisany w Firebase.");
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
    if(classifier) {
        classifier.setClassifierDataset(dataset);
        console.log("Model został wczytany z Firebase.");
    }
  } else {
    console.log("Nie znaleziono zapisanego modelu dla tego użytkownika.");
  }
  updateStatus();
}

async function clearData() {
    if (!confirm("Czy na pewno chcesz usunąć wszystkie zebrane próbki z bazy danych?")) {
        return;
    }
    
    try {
      if (currentUser) {
        const modelPath = `models/${currentUser.uid}`;
        await database.ref(modelPath).remove();
        console.log("Dane z Firebase zostały usunięte.");
      }
      if (classifier) {
          classifier.clearAllClasses();
      }
      gallery.innerHTML = "";
      predictionEl.textContent = "Wyczyszczono dane. Zacznij naukę od nowa.";
      updateStatus();
    } catch (error) {
      console.error("Błąd podczas czyszczenia danych:", error);
      alert("Wystąpił błąd podczas czyszczenia danych.");
    }
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

  document.getElementById('login-btn').addEventListener('click', () => {
    firebase.auth().signInAnonymously();
  });
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
  const modelsLoaded = await loadModels();
  const faceApiModelsLoaded = await loadFaceApiModels();

  if (modelsLoaded && faceApiModelsLoaded) {
    status.textContent = "Modele gotowe. Zaloguj się, aby rozpocząć.";
    firebase.auth().onAuthStateChanged(user => {
      if (user) {
        handleLoggedInState(user);
      } else {
        handleLoggedOutState();
      }
    });
  } else {
      status.textContent = "Błąd krytyczny. Nie udało się załadować wszystkich modeli AI.";
  }
}

// Event Listeners
startBtn.addEventListener('click', startCamera);
stopBtn.addEventListener('click', stopCamera);
clearBtn.addEventListener('click', clearData);
classButtons.forEach(btn => {
  btn.addEventListener('click', () => takeSnapshot(btn.dataset.class));
});
predictBtn.addEventListener('click', predict);

// Start!
main();
