'use strict';

// --- ELEMENTY UI ---
const totalSamplesEl = document.getElementById('total-samples');
const manualSamplesEl = document.getElementById('manual-samples'); // Nowy
const correctionSamplesEl = document.getElementById('correction-samples'); // Nowy
const totalPredictionsEl = document.getElementById('total-predictions');
const modelAccuracyEl = document.getElementById('model-accuracy');
let samplesChart, accuracyChart; // Zmienne do przechowywania instancji wykresów

const database = firebase.database();

firebase.auth().onAuthStateChanged(user => {
    if (user) {
        listenForStats(user.uid);
    } else {
        statsContainer.innerHTML = `
            <h1>Statystyki</h1>
            <p>Aby zobaczyć statystyki, musisz być zalogowany.</p>
            <p style="margin-top: 4rem; text-align: center;"><a href="index.html">Wróć do aplikacji</a></p>
        `;
    }
});

function listenForStats(uid) {
    const samplesRef = database.ref(`training_samples/${uid}`);
    const predictionsRef = database.ref(`prediction_attempts/${uid}`).orderByChild('timestamp');

    samplesRef.on('value', snapshot => {
        const samples = [];
        snapshot.forEach(child => { samples.push(child.val()); });
        updateSamplesSummary(samples);
        updateSamplesChart(samples);
    });

    predictionsRef.on('value', snapshot => {
        const predictions = [];
        snapshot.forEach(child => { predictions.push(child.val()); });
        updatePredictionsSummary(predictions);
        updateAccuracyChart(predictions);
    });
}

function updateSamplesSummary(samples) {
    totalSamplesEl.textContent = samples.length;

    // NOWA LOGIKA: Zliczanie próbek według źródła
    const manualSamples = samples.filter(s => s.source === 'manual').length;
    const correctionSamples = samples.filter(s => s.source === 'correction').length;
    manualSamplesEl.textContent = manualSamples;
    correctionSamplesEl.textContent = correctionSamples;
}

function updatePredictionsSummary(predictions) {
    totalPredictionsEl.textContent = predictions.length;
    const correctPredictions = predictions.filter(p => p.wasCorrect).length;
    const accuracy = (predictions.length > 0) ? (correctPredictions / predictions.length * 100) : 0;
    modelAccuracyEl.textContent = `${accuracy.toFixed(1)}%`;
}

function updateSamplesChart(samples) {
    const classNames = ["KOŁO", "KWADRAT", "TRÓJKĄT"];
    const counts = classNames.reduce((acc, name) => ({ ...acc, [name]: 0 }), {});
    samples.forEach(sample => {
        if (counts[sample.symbol] !== undefined) {
            counts[sample.symbol]++;
        }
    });

    if (samplesChart) samplesChart.destroy(); // Zniszcz stary wykres przed narysowaniem nowego

    samplesChart = new Chart(samplesChartCtx, {
        type: 'bar',
        data: {
            labels: classNames,
            datasets: [{
                label: 'Liczba próbek',
                data: Object.values(counts),
                backgroundColor: ['#38bdf8', '#facc15', '#4ade80'],
            }]
        },
        options: {
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
    });
}

function updateAccuracyChart(predictions) {
    if (predictions.length === 0) return;
    
    let correctCount = 0;
    const accuracyOverTime = predictions.map((p, index) => {
        if (p.wasCorrect) correctCount++;
        return {
            x: index + 1,
            y: (correctCount / (index + 1)) * 100
        };
    });

    if (accuracyChart) accuracyChart.destroy();

    accuracyChart = new Chart(accuracyChartCtx, {
        type: 'line',
        data: {
            datasets: [{
                label: 'Skuteczność modelu (%)',
                data: accuracyOverTime,
                borderColor: '#f472b6',
                tension: 0.1,
                fill: false
            }]
        },
        options: {
            scales: {
                x: { title: { display: true, text: 'Numer próby odgadnięcia' } },
                y: { beginAtZero: true, max: 100, title: { display: true, text: 'Skuteczność (%)' } }
            }
        }
    });
}
