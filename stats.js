'use strict';

const firebaseConfig = { /* ... bez zmian ... */ };
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// --- ELEMENTY UI ---
const totalSamplesEl = document.getElementById('total-samples');
// ... (reszta selektorów bez zmian)
const accuracyChartCtx = document.getElementById('accuracyChart').getContext('2d');
// NOWE SELEKTORY
const historyTableBody = document.getElementById('history-table-body');
const pageInfoEl = document.getElementById('page-info');
const prevPageBtn = document.getElementById('prev-page');
const nextPageBtn = document.getElementById('next-page');


let accuracyChart;
// NOWE ZMIENNE GLOBALNE
let fullTimeline = [];
let currentPage = 1;
const ITEMS_PER_PAGE = 50;

firebase.auth().onAuthStateChanged(user => { /* ... bez zmian ... */ });

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

            // Zapisujemy połączone dane do zmiennej globalnej
            fullTimeline = [
                ...samples.map(s => ({ ...s, type: 'sample' })),
                ...predictions.map(p => ({ ...p, type: 'prediction' }))
            ].sort((a, b) => b.timestamp - a.timestamp); // Sortuj malejąco

            updateSamplesSummary(samples);
            updatePredictionsSummary(predictions);
            updateAccuracyChart(samples, predictions);
            renderTable(); // Wywołaj renderowanie tabeli
        });
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
            type = event.source === 'manual' ? 'Dodanie próbki' : 'Korekta';
            shape = event.symbol;
            correction = '---';
        } else { // prediction
            type = 'Zgadywanie';
            shape = event.predictedSymbol;
            if (event.wasCorrect) {
                correction = '✅ Poprawne';
            } else {
                correction = `❌ Błędne (poprawny: ${event.correctSymbol})`;
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
    pageInfoEl.textContent = `Strona ${currentPage} / ${totalPages}`;

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


// ... reszta funkcji (updateSamplesSummary, updatePredictionsSummary, updateAccuracyChart) bez zmian ...
