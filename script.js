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
const feedbackContainer = document.getElementById('feedback-container'); // Nowy element

// --- ZMIENNE GLOBALNE ---
let currentUser = null;
let currentStream = null;
let classifier;
let net;
const classNames = ["KOŁO", "KWADRAT", "TRÓJKĄT"];
let blazeFaceModel;
let detectionIntervalId = null;
let lastDetectedFace = null;
let lastLogits = null; // Przechowujemy ostatni tensor do douczania

// --- FUNKCJE AI i KAMERY ---

const tensorToJSON = (tensor) => Array.from(tensor.dataSync());

async function loadClassificationModels() { /* ... bez zmian ... */ }
async function loadFaceDetectorModel() { /* ... bez zmian ... */ }
async function runDetectionLoop() { /* ... bez zmian ... */ }
function startCamera() { /* ... bez zmian ... */ }
function stopCamera() { /* ... bez zmian ... */ }

// --- NOWA LOGIKA FEEDBACKU ---

function clearFeedbackUI() {
    feedbackContainer.innerHTML = '';
}

function resetPredictionUI() {
    clearFeedbackUI();
    predictionEl.textContent = '';
    predictBtn.disabled = !lastDetectedFace;
}

function handleCorrectPrediction(predictedSymbol) {
    logPredictionAttempt(predictedSymbol, true);
    predictionEl.textContent = 'Dziękuję za potwierdzenie!';
    setTimeout(resetPredictionUI, 2000);
}

async function handleIncorrectPrediction(predictedSymbol, correctSymbol, logits) {
    logPredictionAttempt(predictedSymbol, false, correctSymbol);
    
    // Douczanie modelu na podstawie korekty
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

async function takeSnapshot(label) { /* ... bez zmian ... */ }

async function predict() {
    if (!net || !classifier || !lastDetectedFace) return;
    if (classifier.getNumClasses() < classNames.length) {
        predictionEl.textContent = `Najpierw dodaj próbki dla wszystkich ${classNames.length} symboli!`;
        return;
    }

    predictBtn.disabled = true; // Zablokuj przycisk, aby uniknąć wielokrotnych kliknięć

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
    
    // Pokaż nowy interfejs feedbacku
    showFeedbackUI(result, logits);
}

function updateStatus() { /* ... bez zmian ... */ }

// --- LOGIKA FIREBASE ---
async function saveModel() { /* ... bez zmian ... */ }
async function loadModelFromFirebase() { /* ... bez zmian ... */ }
async function clearData() { /* ... bez zmian ... */ }
function logTrainingSample(symbol, source) { /* ... bez zmian ... */ }

// NOWA FUNKCJA
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
function handleLoggedOutState() { /* ... bez zmian ... */ }
async function handleLoggedInState(user) { /* ... bez zmian ... */ }

// --- INICJALIZACJA APLIKACJI ---
async function main() { /* ... bez zmian ... */ }

// Event Listeners (skopiuj całą resztę kodu poniżej bez zmian)
// ...
// --- FUNKCJE AI i KAMERY (pełna treść) ---
// ...
// --- GŁÓWNE FUNKCJE APLIKACJI (pełna treść) ---
// ...
// --- LOGIKA FIREBASE (pełna treść) ---
// ...
// --- ZARZĄDZANIE STANEM LOGOWANIA (pełna treść) ---
// ...
// --- INICJALIZACJA APLIKACJI (pełna treść) ---
// ...
// --- EVENT LISTENERS (pełna treść) ---
// ...
// --- START ---
// ...
