const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const classButtons = document.querySelectorAll('.classes button');
const predictBtn = document.getElementById('predictBtn');
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const gallery = document.getElementById('gallery');
const status = document.getElementById('status');
const predictionEl = document.getElementById('prediction');
const feedbackDiv = document.getElementById('feedback');
const chooseCorrect = document.getElementById('chooseCorrect');
const yesBtn = document.getElementById('yesBtn');
const noBtn = document.getElementById('noBtn');
const clearBtn = document.getElementById('clearBtn');

const firebaseConfig = {
    apiKey: "AIzaSyDgnmnrBiqwFuFcEDpKsG_7hP2c8C4t30E",
    authDomain: "guess-5d206.firebaseapp.com",
    projectId: "guess-5d206",
    storageBucket: "guess-5d206.firebasestorage.app",
    messagingSenderId: "88077227103",
    appId: "1:88077227103:web:4eae99db4fb7e1fcbcb7ea",
    measurementId: "G-V620WE8CYB"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

async function testFirestoreConnection() {
    try {
        const testDocRef = db.collection("test").doc("connection");
        await testDocRef.set({
            status: "ok"
        });
        console.log("Połączenie z Firestore działa. Testowy dokument zapisany.");

        const doc = await testDocRef.get();
        if (doc.exists) {
            console.log("Testowy dokument odczytany:", doc.data());
        }
    } catch (e) {
        console.error("Test połączenia nieudany:", e);
    }
}

let currentStream = null;
let samples = {
    "KOŁO": 0,
    "KRZYŻYK": 0,
    "TRÓJKĄT": 0
};
let classifier;
let net;
let lastPrediction = null;

async function loadModel() {
    predictionEl.textContent = "Ładowanie modelu MobileNet...";
    net = await mobilenet.load();
    classifier = knnClassifier.create();
    predictionEl.textContent = "Model gotowy ✅ Dodaj próbki.";
}

async function startCamera() {
    stopCamera();
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: true
        });
        currentStream = stream;
        video.srcObject = stream;
        await video.play();
        startBtn.disabled = true;
        stopBtn.disabled = false;
        classButtons.forEach(btn => btn.disabled = false);
        predictBtn.disabled = false;
    } catch (err) {
        alert("Błąd kamery: " + err.message);
    }
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
    // ... Twój istniejący kod
    classifier.addExample(logits, label);
    samples[label]++;
    updateStatus();
    await saveClassifier(); // Nowa linia
    await saveSamples(); // Nowa linijka
}

async function predict() {
    if (classifier.getNumClasses() === 0) {
        predictionEl.textContent = "Dodaj próbki!";
        return;
    }
    const logits = net.infer(video, true);
    const result = await classifier.predictClass(logits);
    lastPrediction = result.label;
    predictionEl.textContent = `Zgadywanie: ${result.label} (${(result.confidences[result.label]*100).toFixed(1)}%)`;
    feedbackDiv.style.display = "flex";
}

function updateStatus() {
    status.textContent =
        `KOŁO: ${samples["KOŁO"]} | KRZYŻYK: ${samples["KRZYŻYK"]} | TRÓJKĄT: ${samples["TRÓJKĄT"]}`;
}

// Feedback
yesBtn.addEventListener('click', () => {
    feedbackDiv.style.display = "none";
    chooseCorrect.style.display = "none";
});
noBtn.addEventListener('click', () => {
    chooseCorrect.style.display = "flex";
});
chooseCorrect.querySelectorAll("button").forEach(btn => {
    btn.addEventListener('click', async () => {
        if (!lastPrediction) return;
        const logits = net.infer(video, true);
        classifier.addExample(logits, btn.dataset.true);
        samples[btn.dataset.true]++;
        updateStatus();
        saveData();
        feedbackDiv.style.display = "none";
        chooseCorrect.style.display = "none";
        predictionEl.textContent = `Poprawiono: ${btn.dataset.true}`;
        await saveClassifier(); 
        await saveSamples(); 
    });
});

// Nowa funkcja do zapisywania próbek klasyfikatora
async function saveClassifier() {
    const dataset = classifier.getDataset();
    if (Object.keys(dataset).length === 0) {
        console.warn("Brak danych do zapisania. Zapisanie pustego zbioru.");
        return;
    }
    const samplesToSave = {};
    for (const className in dataset) {
        const tensors = dataset[className].map(tensor => {
            const arr = Array.from(tensor.dataSync());
            return {
                data: arr,
                shape: tensor.shape,
                dtype: tensor.dtype
            };
        });
        samplesToSave[className] = tensors;
    }

    try {
        await db.collection("training_data").doc("shapes_classifier").set({
            samples: samplesToSave
        });
        console.log("Dane klasyfikatora zapisane w Firestore.");
    } catch (e) {
        console.error("Błąd podczas zapisu klasyfikatora: ", e);
    }
}

// Nowa funkcja do zapisu licznika próbek i galerii
async function saveSamples() {
    try {
        await db.collection("sample_counts").doc("counts").set(samples);
        console.log("Liczniki próbek zapisane w Firestore.");
    } catch (e) {
        console.error("Błąd podczas zapisu liczników: ", e);
    }
}

// Nowa funkcja do odczytywania próbek klasyfikatora
async function loadClassifier() {
    const docRef = db.collection("training_data").doc("shapes_classifier");
    const doc = await docRef.get();

    if (doc.exists) {
        const data = doc.data().samples;
        const dataset = {};
        for (const className in data) {
            dataset[className] = data[className].map(item => {
                return tf.tensor(item.data, item.shape, item.dtype);
            });
        }
        classifier.setDataset(dataset);
        console.log("Dane klasyfikatora załadowane z Firestore.");
    } else {
        console.log("Brak danych klasyfikatora w Firestore.");
    }
}

// Nowa funkcja do odczytywania liczników
async function loadSamples() {
    const docRef = db.collection("sample_counts").doc("counts");
    const doc = await docRef.get();

    if (doc.exists) {
        const data = doc.data();
        samples = data;
        updateStatus();
        console.log("Liczniki próbek załadowane z Firestore.");
    } else {
        console.log("Brak liczników w Firestore.");
    }
}

clearBtn.addEventListener("click", async () => {
    classifier = knnClassifier.create();
    samples = {
        "KOŁO": 0,
        "KRZYŻYK": 0,
        "TRÓJKĄT": 0
    };
    gallery.innerHTML = "";
    updateStatus();

    try {
        await db.collection("training_data").doc("shapes_classifier").delete(); // Nowa linia
        await db.collection("sample_counts").doc("counts").delete(); // Nowa linijka
        console.log("Dane usunięte z bazy Firestore.");
    } catch (e) {
        console.error("Błąd podczas usuwania danych: ", e);
    }

    predictionEl.textContent = "Brak predykcji";
});

startBtn.addEventListener('click', startCamera);
stopBtn.addEventListener('click', stopCamera);
classButtons.forEach(btn => btn.addEventListener('click', () => takeSnapshot(btn.dataset.class)));
predictBtn.addEventListener('click', predict);

loadClassifier();
loadSamples();
loadModel();