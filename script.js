'use strict';

// --- ELEMENTY UI ---
const authContainer = document.getElementById('auth-container');
const mainContent = document.querySelector('main'); // Główna zawartość gry
const guessInput = document.querySelector('.guess');
const checkButton = document.querySelector('.check');
const messageDisplay = document.querySelector('.message');
const scoreDisplay = document.querySelector('.score');
const numberDisplay = document.querySelector('.number');
const bodyElement = document.querySelector('body');
const highscoreDisplay = document.querySelector('.highscore');
const againButton = document.querySelector('.again');
const guessesList = document.getElementById('guesses-list');

// --- ZMIENNE STANU GRY ---
let secretNumber, score, highscore, currentUser;
highscore = 0;
let guessesListener = null; // Przechowuje referencję do listenera Firebase

// --- FUNKCJE POMOCNICZE ---
const displayMessage = (message) => {
  messageDisplay.textContent = message;
};

const resetGame = () => {
  score = 20;
  secretNumber = Math.trunc(Math.random() * 20) + 1;
  displayMessage('Zacznij zgadywać...');
  scoreDisplay.textContent = score;
  numberDisplay.textContent = '?';
  guessInput.value = '';
  bodyElement.style.backgroundColor = '#222';
  numberDisplay.style.width = '15rem';
};

// --- LOGIKA FIREBASE ---

const saveGuess = (number) => {
  if (!currentUser) return;
  const guessesRef = database.ref('guesses');
  guessesRef.push({
    guessedNumber: number,
    timestamp: Date.now(),
    userId: currentUser.uid,
  }).catch(error => {
    console.error('Błąd zapisu do Firebase:', error);
  });
};

const listenForGuesses = () => {
  const guessesRef = database.ref('guesses');
  guessesList.innerHTML = ''; 
  // Zapisujemy referencję do listenera, aby móc go później usunąć
  guessesListener = guessesRef.on('child_added', snapshot => {
    const newGuess = snapshot.val();
    const listItem = document.createElement('li');
    listItem.textContent = `Podano liczbę: ${newGuess.guessedNumber}`;
    guessesList.prepend(listItem);
  });
};

// --- ZARZĄDZANIE STANEM LOGOWANIA (ULEPSZONE UX) ---

const handleLoggedOutState = () => {
  currentUser = null;
  mainContent.classList.add('hidden'); // Ukryj grę z animacją
  authContainer.innerHTML = '<button id="login-btn">Zaloguj jako Gość</button>';
  
  const loginButton = document.getElementById('login-btn');
  loginButton.addEventListener('click', () => {
    // UX: Pokaż stan ładowania
    loginButton.textContent = 'Logowanie...';
    loginButton.disabled = true;
    firebase.auth().signInAnonymously().catch(error => {
        // Jeśli błąd, przywróć przycisk do stanu początkowego
        console.error("Błąd logowania:", error);
        loginButton.textContent = 'Zaloguj jako Gość';
        loginButton.disabled = false;
    });
  });

  // Zatrzymaj nasłuchiwanie, gdy użytkownik jest wylogowany
  if(guessesListener) {
    database.ref('guesses').off('child_added', guessesListener);
  }
};

const handleLoggedInState = (user) => {
  currentUser = user;
  mainContent.classList.remove('hidden'); // Pokaż grę z animacją
  authContainer.innerHTML = `
    <span class="welcome-message">Witaj, Gościu!</span>
    <button id="logout-btn" class="logout-btn">Wyloguj</button>
  `;

  document.getElementById('logout-btn').addEventListener('click', () => {
    firebase.auth().signOut();
  });
  
  resetGame();
  listenForGuesses();
};

firebase.auth().onAuthStateChanged(user => {
  if (user) {
    handleLoggedInState(user);
  } else {
    handleLoggedOutState();
  }
});

// --- LOGIKA GRY (BEZ ZMIAN) ---
checkButton.addEventListener('click', () => {
  const guess = Number(guessInput.value);

  if (!guess) {
    displayMessage('⛔️ Nie wpisano liczby!');
  } else if (guess === secretNumber) {
    displayMessage('🎉 Poprawna liczba!');
    numberDisplay.textContent = secretNumber;
    bodyElement.style.backgroundColor = '#60b347';
    numberDisplay.style.width = '30rem';
    if (score > highscore) {
      highscore = score;
      highscoreDisplay.textContent = highscore;
    }
  } else if (guess !== secretNumber) {
    if (score > 1) {
      displayMessage(guess > secretNumber ? '📈 Za wysoko!' : '📉 Za nisko!');
      score--;
      scoreDisplay.textContent = score;
    } else {
      displayMessage('💥 Przegrałeś grę!');
      scoreDisplay.textContent = 0;
    }
  }
  if (guess) {
    saveGuess(guess);
  }
});

againButton.addEventListener('click', resetGame);
