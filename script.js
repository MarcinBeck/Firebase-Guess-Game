'use strict';

// --- ELEMENTY UI ---
const authContainer = document.getElementById('auth-container');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const overlayCtx = overlay.getContext('2d');

// --- ZMIENNE GLOBALNE ---
let currentUser = null;
let currentStream = null;
let blazeFaceModel;
let faceDetectionTimeoutId = null;

// --- FUNKCJE AI i KAMERY ---

async function loadFaceDetectorModel() {
  console.log("Ładowanie modelu BlazeFace...");
  try {
    blazeFaceModel = await blazeface.load();
    console.log("Model BlazeFace załadowany.");
    return true;
  } catch (e) {
    console.error("Błąd ładowania modelu BlazeFace:", e);
    return false;
  }
}

async function detectFacesLoop() {
  if (blazeFaceModel && !video.paused && !video.ended) {
    const predictions = await blazeFaceModel.estimateFaces(video, false);
    
    overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
    
    predictions.forEach(prediction => {
        const start = prediction.topLeft;
        const end = prediction.bottomRight;
        const size = [end[0] - start[0], end[1] - start[1]];

        overlayCtx.strokeStyle = '#38bdf8';
        overlayCtx.lineWidth = 4;
        overlayCtx.strokeRect(start[0], start[1], size[0], size[1]);
    });

    faceDetectionTimeoutId = setTimeout(detectFacesLoop, 200);
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
              detectFacesLoop();
          }
      }, 200);

      startBtn.disabled = true;
      stopBtn.disabled = false;
    }).catch(err => alert("Błąd kamery: ".concat(err.message)));
}

function stopCamera() {
  if (faceDetectionTimeoutId) {
    clearTimeout(faceDetectionTimeoutId);
    faceDetectionTimeoutId = null;
  }
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
    currentStream = null;
  }
  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);

  startBtn.disabled = false;
  stopBtn.disabled = true;
}

// --- ZARZĄDZANIE STANEM LOGOWANIA ---
function handleLoggedOutState() {
  currentUser = null;
  stopCamera();
  authContainer.innerHTML = '<button id="login-btn">Zaloguj jako Gość</button>';
  
  document.getElementById('login-btn').addEventListener('click', () => {
    firebase.auth().signInAnonymously();
  });
}

function handleLoggedInState(user) {
  currentUser = user;
  authContainer.innerHTML = `<span class="welcome-message">Witaj, Gościu!</span><button id="logout-btn" class="logout-btn">Wyloguj</button>`;
  document.getElementById('logout-btn').addEventListener('click', () => firebase.auth().signOut());
}

// --- INICJALIZACJA APLIKACJI ---
async function main() {
  console.log("Start aplikacji...");
  const faceDetectorModelLoaded = await loadFaceDetectorModel();

  if (faceDetectorModelLoaded) {
    console.log("Model gotowy. Ustawiam nasłuchiwanie na stan logowania...");
    firebase.auth().onAuthStateChanged(user => {
      if (user) {
        console.log("Użytkownik zalogowany.");
        handleLoggedInState(user);
      } else {
        console.log("Użytkownik wylogowany.");
        handleLoggedOutState();
      }
    });
  } else {
      alert("Błąd krytyczny: Nie udało się załadować modelu AI.");
  }
}

// Event Listeners
startBtn.addEventListener('click', startCamera);
stopBtn.addEventListener('click', stopCamera);

// Start!
main();
