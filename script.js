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
let faceDetector;
let isDetectingFaces = false;

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
    console.error("Błąd MobileNet/KNN:", e);
    return false;
  }
}

async function loadFaceDetectorModel() {
  status.textContent = "Ładowanie modelu detekcji twarzy...";
  try {
    const model = faceDetection.SupportedModels.MediaPipeFaceDetector;
    const detectorConfig = { runtime: 'tfjs' };
    faceDetector = await faceDetection.createDetector(model, detectorConfig);
    console.log("Model detekcji twarzy załadowany.");
    return true;
  } catch (e) {
    console.error("Błąd ładowania modelu detekcji twarzy:", e);
    status.textContent = "Błąd ładowania modelu detekcji twarzy.";
    return false;
  }
}

async function detectFacesLoop() {
  if (!isDetectingFaces || !faceDetector) return;

  const faces = await faceDetector.estimateFaces(video, { flipHorizontal: false });
  // LOG DIAGNOSTYCZNY: Sprawdzamy, czy model cokolwiek wykrywa
  console.log(`Wykryto twarzy: ${faces.length}`);
  
  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
  
  faces.forEach(face => {
    // LOG DIAGNOSTYCZNY: Sprawdzamy, czy pętla rysowania jest wykonywana
    console.log("Rysuję ramkę dla wykrytej twarzy.");
    overlayCtx.strokeStyle = '#38bdf8';
    overlayCtx.lineWidth = 4;
    overlayCtx.strokeRect(face.box.xMin, face.box.yMin, face.box.width, face.box.height);

    overlayCtx.fillStyle = '#38bdf8';
    face.keypoints.forEach(keypoint => {
      overlayCtx.beginPath();
      overlayCtx.arc(keypoint.x, keypoint.y, 5, 0, 2 * Math.PI);
      overlayCtx.fill();
    });
  });

  requestAnimationFrame(detectFacesLoop);
}

function startCamera() {
  stopCamera();
  navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
      currentStream = stream;
      video.srcObject = stream;
      video.play();

      video.addEventListener('loadeddata', () => {
        // LOG DIAGNOSTYCZNY: Sprawdzamy, czy wideo jest gotowe i jakie ma wymiary
        console.log('EVENT "loadeddata": Wideo gotowe. Wymiary:', video.videoWidth, 'x', video.videoHeight);
        overlay.width = video.videoWidth;
        overlay.height = video.videoHeight;
        
        isDetectingFaces = true;
        console.log('URUCHAMIAM PĘTLĘ DETEKCJI TWARZY...');
        detectFacesLoop();
      });

      startBtn.disabled = true;
      stopBtn.disabled = false;
      classButtons.forEach(btn => btn.disabled = false);
      predictBtn.disabled = false;
    }).catch(err => alert("Błąd kamery: ".concat(err.message)));
}

function stopCamera() {
  isDetectingFaces = false;
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

// Logika Firebase (bez zmian)
async function saveModel() {
  if (!currentUser || !classifier) return;
  
  const dataset = classifier.getClassifierDataset();
  const modelPath = `models/${currentUser.uid}`;

  if (Object.keys(dataset).length === 0) {
      await database.ref(modelPath).remove();
      return;
  };

  const serializedDataset = {};
  for (const key of Object.keys(dataset)) {
    serializedDataset[key] = tensorToJSON(dataset[key]);
  }
  
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
    if(classifier) {
        classifier.setClassifierDataset(dataset);
    }
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

// Logika logowania (bez zmian)
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

// INICJALIZACJA APLIKACJI
async function main() {
  const classificationModelsLoaded = await loadClassificationModels();
  const faceDetectorModelLoaded = await loadFaceDetectorModel();

  if (classificationModelsLoaded && faceDetectorModelLoaded) {
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
