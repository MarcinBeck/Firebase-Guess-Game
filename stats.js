'use strict';

window.addEventListener('DOMContentLoaded', () => {

    // --- ELEMENTY UI ---
    const totalSamplesEl = document.getElementById('total-samples');
    const manualSamplesEl = document.getElementById('manual-samples');
    const correctionSamplesEl = document.getElementById('correction-samples');
    const totalPredictionsEl = document.getElementById('total-predictions');
    const modelAccuracyEl = document.getElementById('model-accuracy');
    const statsContainer = document.querySelector('.stats-container');
    const accuracyChartCtx = document.getElementById('accuracyChart').getContext('2d');

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

        // Używamy .on() zamiast .once(), aby dane aktualizowały się w czasie rzeczywistym
        samplesRef.on('value', samplesSnapshot => {
            predictionsRef.on('value', predictionsSnapshot => {
                const samples = [];
                samplesSnapshot.forEach(child => { samples.push({ id: child.key, ...child.val() }); });

                const predictions = [];
                predictionsSnapshot.forEach(child => { predictions.push({ id: child.key, ...child.val() }); });

                updateSamplesSummary(samples);
                updatePredictionsSummary(predictions);
                updateAccuracyChart(samples, predictions);
            });
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

    function updateAccuracyChart(samples, predictions) {
        if (predictions.length === 0) {
            if (accuracyChart) accuracyChart.destroy();
            return;
        };

        const timeline = [
            ...samples.map(s => ({ ...s, type: 'sample' })),
            ...predictions.map(p => ({ ...p, type: 'prediction' }))
        ].sort((a, b) => a.timestamp - b.timestamp);

        const intervalSize = 5;
        let sampleCount = 0;
        
        const predictionsByInterval = {};

        timeline.forEach(event => {
            if (event.type === 'sample') {
                sampleCount++;
            }
            if (event.type === 'prediction') {
                const intervalIndex = Math.floor((sampleCount -1 < 0 ? 0 : sampleCount - 1) / intervalSize);
                if (!predictionsByInterval[intervalIndex]) {
                    predictionsByInterval[intervalIndex] = [];
                }
                predictionsByInterval[intervalIndex].push(event);
            }
        });

        const maxInterval = Math.floor((sampleCount -1 < 0 ? 0 : sampleCount - 1) / intervalSize);
        const chartLabels = [];
        const chartData = [];

        for (let i = 0; i <= maxInterval; i++) {
            const label = `${i * intervalSize} - ${i * intervalSize + intervalSize - 1}`;
            chartLabels.push(label);

            if (predictionsByInterval[i] && predictionsByInterval[i].length > 0) {
                const intervalPredictions = predictionsByInterval[i];
                const correct = intervalPredictions.filter(p => p.wasCorrect).length;
                const accuracy = (correct / intervalPredictions.length) * 100;
                chartData.push(accuracy);
            } else {
                chartData.push(NaN); 
            }
        }
        
        if (accuracyChart) accuracyChart.destroy();

        accuracyChart = new Chart(accuracyChartCtx, {
            type: 'line',
            data: {
                labels: chartLabels,
                datasets: [
                {
                    label: 'Skuteczność w przedziale',
                    data: chartData,
                    borderColor: '#38bdf8',
                    tension: 0.1,
                    spanGaps: false,
                },
                {
                    label: 'Poziom losowy (33.3%)',
                    data: Array(chartLabels.length).fill(33.3),
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
});
