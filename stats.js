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
    const historyTableBody = document.getElementById('history-table-body');
    const pageInfoEl = document.getElementById('page-info');
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');

    let fullTimeline = [];
    let currentPage = 1;
    const ITEMS_PER_PAGE = 50;

    let accuracyChart;

    let currentSort = { column: 'timestamp', direction: 'desc' }; // Domyślne sortowanie

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

    // Używamy .on() aby dane aktualizowały się w czasie rzeczywistym
    samplesRef.on('value', samplesSnapshot => {
        predictionsRef.on('value', predictionsSnapshot => {
            const samples = [];
            samplesSnapshot.forEach(child => { samples.push({ id: child.key, ...child.val() }); });

            const predictions = [];
            predictionsSnapshot.forEach(child => { predictions.push({ id: child.key, ...child.val() }); });

            // Zapisujemy połączone dane do zmiennej globalnej, sortując od najnowszych
            fullTimeline = [
                ...samples.map(s => ({ ...s, type: 'sample' })),
                ...predictions.map(p => ({ ...p, type: 'prediction' }))
            ].sort((a, b) => b.timestamp - a.timestamp);

            updateSamplesSummary(samples);
            updatePredictionsSummary(predictions);
            updateAccuracyChart(samples, predictions);
            sortTimeline();
            renderTable(); // Wywołaj renderowanie tabeli
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

// --- NOWA LOGIKA TABELI I PAGINACJI ---

function renderTable() {
    historyTableBody.innerHTML = ''; // Wyczyść starą zawartość

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const pageItems = fullTimeline.slice(startIndex, endIndex);

    pageItems.forEach((event, index) => {
        const lp = startIndex + index + 1;
        const date = new Date(event.timestamp).toLocaleString('pl-PL');

        let type, shape, correction;

        if (event.type === 'sample') {
            type = event.source === 'manual' ? 'Dodanie próbki' : 'Korekta (nauka)';
            shape = event.symbol;
            correction = '---';
        } else { // prediction
            type = 'Zgadywanie';
            shape = event.predictedSymbol;
            if (event.wasCorrect) {
                correction = '✅ Poprawne';
            } else {
                correction = `❌ Błędne (był to: ${event.correctSymbol})`;
            }
        }

        const row = `
            <tr>
                <td>${lp}</td>
                <td>${date}</td>
                <td>${type}</td>
                <td>${shape}</td>
                <td>${correction}</td>
            </tr>
        `;
        historyTableBody.innerHTML += row;
    });

    updatePaginationControls();
}

function updatePaginationControls() {
    const totalPages = Math.ceil(fullTimeline.length / ITEMS_PER_PAGE);
    pageInfoEl.textContent = `Strona ${currentPage} / ${totalPages || 1}`;

    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages;
}

prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        renderTable();
    }
});

nextPageBtn.addEventListener('click', () => {
    const totalPages = Math.ceil(fullTimeline.length / ITEMS_PER_PAGE);
    if (currentPage < totalPages) {
        currentPage++;
        renderTable();
    }
});

    // Nasłuchuj na kliknięcia w nagłówek tabeli
document.querySelector('.history-table thead').addEventListener('click', (e) => {
    const header = e.target.closest('th');
    if (!header || !header.classList.contains('sortable')) return;

    const sortColumn = header.dataset.sort;

    if (currentSort.column === sortColumn) {
        // Jeśli kliknięto tę samą kolumnę, odwróć kierunek
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        // Jeśli nowa kolumna, ustaw domyślny kierunek
        currentSort.column = sortColumn;
        currentSort.direction = 'asc';
    }

    currentPage = 1; // Zresetuj paginację
    sortTimeline();
    renderTable();
});

function sortTimeline() {
    const { column, direction } = currentSort;
    const dir = direction === 'asc' ? 1 : -1;

    fullTimeline.sort((a, b) => {
        let valA, valB;

        // Mapowanie kolumn na dane
        if (column === 'lp') {
            valA = fullTimeline.indexOf(a);
            valB = fullTimeline.indexOf(b);
        } else if (column === 'timestamp') {
            valA = a.timestamp;
            valB = b.timestamp;
        } else if (column === 'type') {
            valA = a.type;
            valB = b.type;
        } else if (column === 'shape') {
            valA = a.symbol || a.predictedSymbol;
            valB = b.symbol || b.predictedSymbol;
        }

        if (valA < valB) return -1 * dir;
        if (valA > valB) return 1 * dir;
        return 0;
    });

    updateSortIndicators();
}

function updateSortIndicators() {
    document.querySelectorAll('.history-table th.sortable').forEach(th => {
        // Usuń istniejące strzałki
        const existingArrow = th.querySelector('.sort-arrow');
        if (existingArrow) existingArrow.remove();

        // Dodaj strzałkę do aktywnej kolumny
        if (th.dataset.sort === currentSort.column) {
            const arrow = document.createElement('span');
            arrow.className = 'sort-arrow';
            arrow.textContent = currentSort.direction === 'asc' ? '▲' : '▼';
            th.appendChild(arrow);
        }
    });
}

    
});
