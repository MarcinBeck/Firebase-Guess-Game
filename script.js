// Importy Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getDatabase, ref, push, onValue, query, orderByChild, limitToFirst } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";

//
// ❗ WAŻNE: Wklej tutaj swoją konfigurację Firebase.
//
const firebaseConfig = {
  apiKey: "AIzaSyDgnmnrBiqwFuFcEDpKsG_7hP2c8C4t30E",
  authDomain: "guess-5d206.firebaseapp.com",
  projectId: "guess-5d206",
  storageBucket: "guess-5d206.firebasestorage.app",
  messagingSenderId: "88077227103",
  appId: "1:88077227103:web:90dc97a026d18ea5bcb7ea",
  measurementId: "G-M71PNFJ215",
    // ✅ POPRAWIONY ADRES URL - MUSI BYĆ "CZYSTY", BEZ ŚCIEŻKI NA KOŃCU
    databaseURL: "https://guess-5d206-default-rtdb.europe-west1.firebasedatabase.app/"
};

// Inicjalizacja Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// Zmienne DOM (przeniesione na górę)
const guesses = document.querySelector('.guesses');
const lastResult = document.querySelector('.lastResult');
const lowOrHi = document.querySelector('.lowOrHi');
const guessSubmit = document.querySelector('.guessSubmit');
const guessField = document.querySelector('.guessField');
const newGameButton = document.querySelector('.newGameButton');
const leaderboardList = document.getElementById('leaderboard');

// Zmienne gry
let randomNumber;
let guessCount;

// --- GŁÓWNA LOGIKA APLIKACJI ---

// Logowanie anonimowe i uruchomienie gry
signInAnonymously(auth)
    .then(() => {
        console.log("Połączenie z Firebase i autentykacja pomyślne.");
        // ✅ URUCHOMIENIE GRY DOPIERO PO NAWIĄZANIU POŁĄCZENIA
        setupNewGame();
        displayLeaderboard();
    })
    .catch((error) => {
        console.error("Błąd krytyczny Firebase (logowanie lub połączenie):", error);
        alert("Nie udało się połączyć z bazą danych. Sprawdź konfigurację w pliku script.js.");
    });

// --- FUNKCJE GRY ---

function setupNewGame() {
    guessCount = 1;
    guesses.textContent = '';
    lastResult.textContent = '';
    lowOrHi.textContent = '';
    
    newGameButton.style.display = 'none';
    
    guessField.disabled = false;
    guessSubmit.disabled = false;
    guessField.value = '';
    guessField.focus();
    lastResult.style.backgroundColor = 'white';
    randomNumber = Math.floor(Math.random() * 100) + 1;
}

function checkGuess() {
    const userGuess = Number(guessField.value);
    if (isNaN(userGuess) || userGuess < 1 || userGuess > 100) {
        lowOrHi.textContent = 'Proszę wpisać liczbę od 1 do 100.';
        return;
    }

    if (guessCount === 1) {
        guesses.textContent = 'Poprzednie typy: ';
    }
    guesses.textContent += userGuess + ' ';

    if (userGuess === randomNumber) {
        lastResult.textContent = 'Gratulacje! Zgadłeś!';
        lastResult.style.backgroundColor = 'green';
        lowOrHi.textContent = '';
        setGameOver(true);
    } else if (guessCount === 10) {
        lastResult.textContent = 'KONIEC GRY!';
        lowOrHi.textContent = `Prawidłowa liczba to: ${randomNumber}`;
        setGameOver(false);
    } else {
        lastResult.textContent = 'Źle!';
        lastResult.style.backgroundColor = 'red';
        lowOrHi.textContent = userGuess < randomNumber ? 'Ostatni typ był za niski!' : 'Ostatni typ był za wysoki!';
    }
    guessCount++;
    guessField.value = '';
    guessField.focus();
}

function setGameOver(isWin) {
    guessField.disabled = true;
    guessSubmit.disabled = true;
    newGameButton.style.display = 'block';
    
    if (isWin) {
        const score = guessCount - 1;
        // Używamy setTimeout, aby uniknąć problemów z blokowaniem interfejsu
        setTimeout(() => {
            const playerName = prompt(`Wygrałeś w ${score} próbach! Podaj swoje imię:`, "Gracz");
            if (playerName && playerName.trim() !== '') {
                updateLeaderboard(playerName.trim(), score);
            }
        }, 100);
    }
}

// --- FUNKCJE BAZY DANYCH ---

function updateLeaderboard(name, score) {
    const leaderboardRef = ref(db, 'leaderboard');
    push(leaderboardRef, {
        playerName: name,
        score: score
    });
}

function displayLeaderboard() {
    const leaderboardRef = query(ref(db, 'leaderboard'), orderByChild('score'), limitToFirst(10));
    
    onValue(leaderboardRef, (snapshot) => {
        leaderboardList.innerHTML = '';
        if (snapshot.exists()) {
            const scores = [];
            snapshot.forEach((child) => scores.push(child.val()));
            
            scores.forEach((entry) => {
                const listItem = document.createElement('li');
                listItem.textContent = `${entry.playerName}: ${entry.score} prób`;
                leaderboardList.appendChild(listItem);
            });
        } else {
            leaderboardList.innerHTML = '<li>Brak wyników</li>';
        }
    });
}

// --- NASŁUCHIWANIE ZDARZEŃ ---
guessSubmit.addEventListener('click', checkGuess);
guessField.addEventListener('keyup', (event) => {
    if (event.key === 'Enter') checkGuess();
});
newGameButton.addEventListener('click', setupNewGame);
