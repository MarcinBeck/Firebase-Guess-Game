import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getDatabase, ref, push, onValue, query, orderByChild, limitToFirst } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";

//
// ❗ WAŻNE: Wklej tutaj swoją konfigurację Firebase i dodaj databaseURL!
//
const firebaseConfig = {
  apiKey: "AIzaSyDgnmnrBiqwFuFcEDpKsG_7hP2c8C4t30E",
  authDomain: "guess-5d206.firebaseapp.com",
  projectId: "guess-5d206",
  storageBucket: "guess-5d206.firebasestorage.app",
  messagingSenderId: "88077227103",
  appId: "1:88077227103:web:90dc97a026d18ea5bcb7ea",
  measurementId: "G-M71PNFJ215",
  databaseURL: "https://guess-5d206-default-rtdb.europe-west1.firebasedatabase.app/" // Ten adres znajdziesz w konsoli Realtime Database
};

// Inicjalizacja Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// Logowanie anonimowe przy starcie aplikacji
signInAnonymously(auth)
  .then(() => {
    console.log("Zalogowano anonimowo.");
  })
  .catch((error) => {
    console.error("Błąd logowania anonimowego:", error);
  });

// Zmienne gry
let randomNumber;
let guesses = document.querySelector('.guesses');
let lastResult = document.querySelector('.lastResult');
let lowOrHi = document.querySelector('.lowOrHi');
let guessSubmit = document.querySelector('.guessSubmit');
let guessField = document.querySelector('.guessField');
let guessCount;
let resetButton;

function setupNewGame() {
    guessCount = 1;
    const resetParas = document.querySelectorAll('.resultParas p');
    for (let i = 0; i < resetParas.length; i++) {
        resetParas[i].textContent = '';
    }

    if (resetButton) {
        resetButton.parentNode.removeChild(resetButton);
        resetButton = null;
    }

    guessField.disabled = false;
    guessSubmit.disabled = false;
    guessField.value = '';
    guessField.focus();

    lastResult.style.backgroundColor = 'white';

    randomNumber = Math.floor(Math.random() * 100) + 1;
    console.log(`Wylosowana liczba (dla testów): ${randomNumber}`);
}

function checkGuess() {
    let userGuess = Number(guessField.value);
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
        lastResult.textContent = '!!!KONIEC GRY!!!';
        lowOrHi.textContent = `Prawidłowa liczba to: ${randomNumber}`;
        setGameOver(false);
    } else {
        lastResult.textContent = 'Źle!';
        lastResult.style.backgroundColor = 'red';
        if (userGuess < randomNumber) {
            lowOrHi.textContent = 'Ostatni typ był za niski!';
        } else if (userGuess > randomNumber) {
            lowOrHi.textContent = 'Ostatni typ był za wysoki!';
        }
    }

    guessCount++;
    guessField.value = '';
    guessField.focus();
}

guessSubmit.addEventListener('click', checkGuess);

function setGameOver(isWin) {
    guessField.disabled = true;
    guessSubmit.disabled = true;
    
    // Zapisz wynik tylko jeśli gracz wygrał
    if (isWin) {
        const playerName = prompt("Wygrałeś! Podaj swoje imię do tabeli wyników:", "Gracz");
        if (playerName) {
            updateLeaderboard(playerName, guessCount - 1);
        }
    }
    
    resetButton = document.querySelector('.newGameButton');
    resetButton.style.display = 'block';
    resetButton.addEventListener('click', setupNewGame);
}

// Funkcje Firebase
function updateLeaderboard(name, score) {
    const leaderboardRef = ref(db, 'leaderboard');
    const newEntry = {
        playerName: name,
        score: score,
        timestamp: Date.now()
    };
    push(leaderboardRef, newEntry);
}

function displayLeaderboard() {
    const leaderboardRef = query(ref(db, 'leaderboard'), orderByChild('score'), limitToFirst(10));
    
    onValue(leaderboardRef, (snapshot) => {
        const leaderboardList = document.getElementById('leaderboard');
        leaderboardList.innerHTML = ''; // Wyczyść listę przed aktualizacją
        
        if (snapshot.exists()) {
            const scores = [];
            snapshot.forEach((childSnapshot) => {
                scores.push(childSnapshot.val());
            });
            
            // onValue z orderByChild zwraca posortowane dane, więc nie trzeba dodatkowo sortować
            scores.forEach((entry) => {
                const listItem = document.createElement('li');
                listItem.textContent = `${entry.playerName}: ${entry.score} prób`;
                leaderboardList.appendChild(listItem);
            });
        } else {
            leaderboardList.innerHTML = '<li>Brak wyników</li>';
        }
    }, (error) => {
        console.error("Błąd odczytu z bazy danych:", error);
    });
}

// Start gry i wyświetlenie tabeli wyników
setupNewGame();
displayLeaderboard();






