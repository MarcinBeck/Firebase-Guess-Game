'use strict';

// --- ELEMENTY UI ---
const totalSamplesEl = document.getElementById('total-samples');
const manualSamplesEl = document.getElementById('manual-samples');
const correctionSamplesEl = document.getElementById('correction-samples');
const totalPredictionsEl = document.getElementById('total-predictions');
const modelAccuracyEl = document.getElementById('model-accuracy');
const statsContainer = document.querySelector('.stats-container');
// USUNIĘTO: const samplesChartCtx
const accuracyChartCtx = document.getElementById('accuracyChart').getContext('2d');

// USUNIĘTO: let samplesChart
let accuracyChart;

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
    const predictionsRef = database.ref(`prediction_attempts/${uid}`);

    Promise.all([
        samplesRef.once('value'),
        predictionsRef.once('value')
    ]).then(([samplesSnapshot, predictionsSnapshot]) => {
        const samples = [];
        samplesSnapshot.forEach(child => { samples.push({ id: child.key, ...child.val() }); });

        const predictions = [];
        predictionsSnapshot.forEach(child => { predictions.push({ id: child.key, ...child.val() }); });

        updateSamplesSummary(samples);
        updatePredictionsSummary(predictions);
        // USUNIĘTO: wywołanie updateSamplesChart(samples);
        updateAccuracyChart(samples, predictions);
    });
}


function updateSamplesSummary(samples) {
    totalSamplesEl.textContent = samples.length;
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

// USUNIĘTO: Cała funkcja updateSamplesChart została usunięta.

function updateAccuracyChart(samples, predictions) {
    if (predictions.length === 0) {
        if (accuracyChart) accuracyChart.destroy();
        return;
    };

    const timeline = [
        ...samples.map(s => ({ ...s, type: 'sample' })),
        ...predictions.map(p => ({ ...p, type: 'prediction' }))
    ].sort((a, b) => a.timestamp - b.timestamp);

    let sampleCount = 0;
    const intervalSize = 5;
    const accuracyData = [];
    let intervalPredictions = [];

    timeline.forEach(event => {
        if (event.type === 'sample') {
            sampleCount++;
        }
        if (event.type === 'prediction') {
            intervalPredictions.push(event);
        }

        if (sampleCount > 0 && sampleCount % intervalSize === 0) {
            if (intervalPredictions.length > 0) {
                const correct = intervalPredictions.filter(p => p.wasCorrect).length;
                const total = intervalPredictions.length;
                const accuracy = (correct / total) * 100;
                
                const label = `${sampleCount - intervalSize}-${sampleCount - 1}`;
                accuracyData.push({ x: label, y: accuracy });
            }
            intervalPredictions = [];
        }
    });

    if (intervalPredictions.length > 0) {
        const correct = intervalPredictions.filter(p => p.wasCorrect).length;
        const total = intervalPredictions.length;
        const accuracy = (correct / total) * 100;
        const startInterval = Math.floor(sampleCount / intervalSize) * intervalSize;
        const label = `${startInterval}-teraz`;
        accuracyData.push({ x: label, y: accuracy });
    }
    
    if (accuracyChart) accuracyChart.destroy();

    accuracyChart = new Chart(accuracyChartCtx, {
        type: 'line',
        data: {
            datasets: [
            {
                label: 'Skuteczność w przedziale',
                data: accuracyData,
                borderColor: '#38bdf8',
                tension: 0.1,
                fill: false
            },
            {
                label: 'Poziom losowy (33.3%)',
                data: accuracyData.map(d => ({ x: d.x, y: 33.3 })),
                borderColor: '#f472b6',
                borderDash: [5, 5],
                fill: false,
                pointRadius: 0
            }]
        },
        options: {
            scales: {
                x: { title: { display: true, text: 'Liczba zebranych próbek (w przedziałach)' } },
                y: { beginAtZero: true, max: 100, title: { display: true, text: 'Skuteczność (%)' } }
            }
        }
    });
}
