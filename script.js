'use strict';

// --- ELEMENTY UI ---
const loader = document.getElementById('loader');
const loaderStatus = document.getElementById('loader-status');
const header = document.querySelector('header');
const mainContent = document.querySelector('main');
// ... reszta selektorów bez zmian
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

// ZMIANA: Funkcje ładujące aktualizują teraz status w loaderze
async function loadClassificationModels() {
  loaderStatus.textContent = "Ładowanie modelu klasyfikacji (MobileNet)...";
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
  loaderStatus.textContent = "Ładowanie modelu detekcji twarzy (BlazeFace)...";
  try {
    blazeFaceModel = await blazeface.load();
    return true;
  } catch (e) {
    status.textContent = "Błąd ładowania modelu detekcji twarzy.";
    return false;
  }
}

async function runDetectionLoop() { /* ... bez zmian ... */ }
function startCamera() { /* ... bez zmian ... */ }
function stopCamera() { /* ... bez zmian ... */ }

// --- LOGIKA FEEDBACKU ---

function clearFeedbackUI() { /* ... bez zmian ... */ }
function resetPredictionUI() { /* ... bez zmian ... */ }
function handleCorrectPrediction(predictedSymbol) { /* ... bez zmian ... */ }
async function handleIncorrectPrediction(predictedSymbol, correctSymbol, logits) { /* ... bez zmian ... */ }
function showCorrectionUI(predictedSymbol, logits) { /* ... bez zmian ... */ }
function showFeedbackUI(result, logits) { /* ... bez zmian ... */ }

// --- GŁÓWNE FUNKCJE APLIKACJI ---

async function takeSnapshot(label) { /* ... bez zmian ... */ }
async function predict() { /* ... bez zmian ... */ }
function updateStatus() { /* ... bez zmian ... */ }

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
    // ZMIANA: Logika ukrywania loadera i pokazywania aplikacji
    loader.classList.add('fade-out');
    header.classList.remove('content-hidden');
    mainContent.classList.remove('content-hidden');
    
    // Usuń loader z DOM po zakończeniu animacji, aby nie przeszkadzał
    loader.addEventListener('transitionend', () => {
        loader.style.display = 'none';
    });

    status.textContent = "Modele gotowe. Zaloguj się, aby rozpocząć.";
    firebase.auth().onAuthStateChanged(user => {
      if (user) { handleLoggedInState(user); } else { handleLoggedOutState(); }
    });
  } else {
      loaderStatus.textContent = "Błąd krytyczny. Nie udało się załadować modeli AI. Odśwież stronę.";
  }
}

// Skopiuj całą resztę kodu poniżej bez zmian (pełne treści funkcji)
// ...
