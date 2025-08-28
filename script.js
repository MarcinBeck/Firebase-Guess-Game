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
