'use strict';

// --- ELEMENTY UI ---
const totalSamplesEl = document.getElementById('total-samples');
const totalPredictionsEl = document.getElementById('total-predictions');
const modelAccuracyEl = document.getElementById('model-accuracy');
const statsContainer = document.querySelector('.stats-container');

const database = firebase.database();

// Główny listener sprawdzający, czy użytkownik jest zalogowany
firebase.auth().onAuthStateChanged(user => {
    if (user) {
        // Użytkownik jest zalogowany, możemy pobrać jego dane
        console.log("Użytkownik zalogowany na stronie statystyk, UID:", user.uid);
        listenForStats(user.uid);
    } else {
        // Użytkownik jest wylogowany
        console.log("Użytkownik niezalogowany na stronie statystyk.");
        statsContainer.innerHTML = `
            <h1>Statystyki</h1>
            <p>Aby zobaczyć statystyki, musisz być zalogowany.</p>
            <p style="margin-top: 4rem; text-align: center;">
                <a href="index.html">Wróć do aplikacji, aby się zalogować</a>
            </p>
        `;
    }
});

function listenForStats(uid) {
    const samplesRef = database.ref(`training_samples/${uid}`);
    const predictionsRef = database.ref(`prediction_attempts/${uid}`);

    // Nasłuchuj na zmiany w próbkach treningowych
    samplesRef.on('value', snapshot => {
        const totalSamples = snapshot.numChildren();
        totalSamplesEl.textContent = totalSamples;
        console.log(`Zaktualizowano liczbę próbek: ${totalSamples}`);
    });

    // Nasłuchuj na zmiany w próbach predykcji
    predictionsRef.on('value', snapshot => {
        const totalPredictions = snapshot.numChildren();
        totalPredictionsEl.textContent = totalPredictions;

        let correctPredictions = 0;
        // Przejdź przez wszystkie próby, aby policzyć poprawne
        snapshot.forEach(childSnapshot => {
            const attempt = childSnapshot.val();
            if (attempt.wasCorrect === true) {
                correctPredictions++;
            }
        });

        const accuracy = (totalPredictions > 0) ? (correctPredictions / totalPredictions * 100) : 0;
        modelAccuracyEl.textContent = `${accuracy.toFixed(1)}%`;
        console.log(`Zaktualizowano liczbę predykcji: ${totalPredictions}, Skuteczność: ${accuracy.toFixed(1)}%`);
    });
}
