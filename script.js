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
const clearBtn = document.getElementById('clearBtn'); // NOWY PRZYCISK

// --- ZMIENNE GLOBALNE ---
let currentUser = null;
let currentStream = null;
let classifier;
let net;
const classNames = ["KOŁO", "KWADRAT", "TRÓJKĄT"];

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
    status.textContent = "Modele gotowe. Zaloguj się, aby zacząć.";
    return true;
  } catch (e) {
    status.textContent = "Błąd krytyczny ładowania modeli AI.";
    console.error(e);
    return false;
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
  if (Object.keys(dataset).length === 0) {
      // Jeśli model jest pusty, usuwamy go z bazy
      await clearDataFromFirebase();
      return;
  };

  const serializedDataset = {};
  for (const key of Object.keys(dataset)) {
    serializedDataset[key] = tensorToJSON(dataset[key]);
  }
  
  const modelPath = `models/${currentUser.uid}`;
  await database.ref(modelPath).set(serializedDataset);
  console.log("Model został zapisany w Firebase.");
}

async function loadModelFromFirebase() {
  if (!currentUser || !classifier) return;

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

// NOWA FUNKCJA DO CZYSZCZENIA DANYCH
async function clearData() {
    if (!confirm("Czy na pewno chcesz usunąć wszystkie zebrane próbki? Ta operacja jest nieodwracalna.")) {
        return;
    }
    
    // 1. Wyczyść model w pamięci
    if (classifier) {
        classifier.clearAllClasses();
    }
    
    // 2. Wyczyść galerię
    gallery.innerHTML = "";
    
    // 3. Wyczyść dane w Firebase
    await clearDataFromFirebase();
    
    // 4. Zaktualizuj status
    updateStatus();
    predictionEl.textContent = "Wyczyszczono dane. Możesz zacząć naukę od nowa.";
    console.log("Wszystkie dane zostały usunięte.");
}

async function clearDataFromFirebase() {
    if (!currentUser) return;
    const modelPath = `models/${currentUser.uid}`;
    await database.ref(modelPath).remove();
}


// --- ZARZĄDZANIE STANEM LOGOWANIA ---
function handleLoggedOutState() {
  currentUser = null;
  stopCamera();
  authContainer.innerHTML = '<button id="login-btn">Zaloguj jako Gość</button>';
  status.textContent = "Zaloguj się, aby rozpocząć.";
  predictionEl.textContent = "";
  gallery.innerHTML = "";
  clearBtn.disabled = true; // Zablokuj przycisk czyszczenia
  if(classifier) classifier.clearAllClasses();

  document.getElementById('login-btn').addEventListener('click', () => {
    firebase.auth().signInAnonymously();
  });
}

async function handleLoggedInState(user) {
  currentUser = user;
  authContainer.innerHTML = `<span class="welcome-message">Witaj, Gościu!</span><button id="logout-btn" class="logout-btn">Wyloguj</button>`;
  document.getElementById('logout-btn').addEventListener('click', () => firebase.auth().signOut());
  
  clearBtn.disabled = false; // Odblokuj przycisk czyszczenia
  status.textContent = "Wczytywanie zapisanego modelu...";
  await loadModelFromFirebase();
}

// --- INICJALIZACJA APLIKACJI ---
async function main() {
  const modelsLoaded = await loadModels();
  if (modelsLoaded) {
    firebase.auth().onAuthStateChanged(user => {
      if (user) {
        handleLoggedInState(user);
      } else {
        handleLoggedOutState();
      }
    });
  }
}

// Event Listeners
startBtn.addEventListener('click', startCamera);
stopBtn.addEventListener('click', stopCamera);
clearBtn.addEventListener('click', clearData); // NOWY EVENT LISTENER
classButtons.forEach(btn => {
  btn.addEventListener('click', () => takeSnapshot(btn.dataset.class));
});
predictBtn.addEventListener('click', predict);

// Start!
main();
