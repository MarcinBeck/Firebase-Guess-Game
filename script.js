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

// --- ZMIENNE GLOBALNE ---
let currentUser = null;
let currentStream = null;
let classifier;
let net;
const classNames = ["KOŁO", "KWADRAT", "TRÓJKĄT"];

// --- FUNKCJE AI i KAMERY ---

// Funkcja do serializacji (zapisu) tensora do formatu JSON
const tensorToJSON = (tensor) => Array.from(tensor.dataSync());

// Główna funkcja ładująca modele AI
async function loadModels() {
  status.textContent = "Ładowanie modelu MobileNet...";
  try {
    net = await mobilenet.load();
    classifier = knnClassifier.create();
    status.textContent = "Modele gotowe. Zaloguj się, aby zacząć.";
  } catch (e) {
    status.textContent = "Błąd ładowania modeli AI.";
    console.error(e);
  }
}

function startCamera() {
  stopCamera();
  navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
      currentStream = stream;
      video.srcObject = stream;
      video.play();
      startBtn.disabled = true;
      stopBtn.disabled = false;
      classButtons.forEach(btn => btn.disabled = false);
      predictBtn.disabled = false;
    }).catch(err => alert("Błąd kamery: " + err.message));
}

function stopCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
    currentStream = null;
  }
  startBtn.disabled = false;
  stopBtn.disabled = true;
  classButtons.forEach(btn => btn.disabled = true);
  predictBtn.disabled = true;
}

async function takeSnapshot(label) {
  const ctx = canvas.getContext('2d');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const img = document.createElement('img');
  img.src = canvas.toDataURL('image/png');
  gallery.appendChild(img);

  const logits = net.infer(canvas, true);
  classifier.addExample(logits, label);
  
  await saveModel(); // Zapisz model w Firebase po dodaniu próbki
  updateStatus();
}

async function predict() {
  if (classifier.getNumClasses() === 0) {
    predictionEl.textContent = "Najpierw dodaj próbki!";
    return;
  }
  const logits = net.infer(video, true);
  const result = await classifier.predictClass(logits);
  predictionEl.textContent = `Wynik: ${result.label} (pewność ${(result.confidences[result.label] * 100).toFixed(1)}%)`;
}

function updateStatus() {
  const counts = classifier.getClassExampleCount();
  status.textContent = classNames.map(name => `${name}: ${counts[name] || 0}`).join(' | ');
}

// --- LOGIKA FIREBASE ---

// Funkcja zapisująca model AI w bazie danych
async function saveModel() {
  if (!currentUser) return;
  
  const dataset = classifier.getClassifierDataset();
  const serializedDataset = {};
  for (const key of Object.keys(dataset)) {
    serializedDataset[key] = tensorToJSON(dataset[key]);
  }
  
  const modelPath = `models/${currentUser.uid}`;
  await database.ref(modelPath).set(serializedDataset);
  console.log("Model został zapisany w Firebase.");
}

// Funkcja wczytująca model AI z bazy danych
async function loadModelFromFirebase() {
  if (!currentUser) return;

  const modelPath = `models/${currentUser.uid}`;
  const snapshot = await database.ref(modelPath).once('value');
  const serializedDataset = snapshot.val();

  if (serializedDataset) {
    const dataset = {};
    for (const key of Object.keys(serializedDataset)) {
        const data = serializedDataset[key];
        const shape = [data.length / 1024, 1024]; // MobileNet logits shape
        dataset[key] = tf.tensor2d(data, shape);
    }
    classifier.setClassifierDataset(dataset);
    console.log("Model został wczytany z Firebase.");
  } else {
    console.log("Nie znaleziono zapisanego modelu dla tego użytkownika.");
  }
  updateStatus();
}


// --- ZARZĄDZANIE STANEM LOGOWANIA ---

function handleLoggedOutState() {
  currentUser = null;
  stopCamera();
  authContainer.innerHTML = '<button id="login-btn">Zaloguj jako Gość</button>';
  status.textContent = "Zaloguj się, aby rozpocząć.";
  predictionEl.textContent = "";
  gallery.innerHTML = "";
  classifier.clearAllClasses();

  document.getElementById('login-btn').addEventListener('click', () => {
    firebase.auth().signInAnonymously();
  });
}

async function handleLoggedInState(user) {
  currentUser = user;
  authContainer.innerHTML = `<span class="welcome-message">Witaj, Gościu!</span><button id="logout-btn" class="logout-btn">Wyloguj</button>`;
  document.getElementById('logout-btn').addEventListener('click', () => firebase.auth().signOut());
  
  status.textContent = "Wczytywanie zapisanego modelu...";
  await loadModelFromFirebase();
}

// --- INICJALIZACJA APLIKACJI ---

// Główny "słuchacz" stanu autentykacji
firebase.auth().onAuthStateChanged(user => {
  if (user) {
    handleLoggedInState(user);
  } else {
    handleLoggedOutState();
  }
});

// Event Listeners dla przycisków
startBtn.addEventListener('click', startCamera);
stopBtn.addEventListener('click', stopCamera);
classButtons.forEach(btn => {
  btn.addEventListener('click', () => takeSnapshot(btn.dataset.class));
});
predictBtn.addEventListener('click', predict);

// Start!
loadModels();
