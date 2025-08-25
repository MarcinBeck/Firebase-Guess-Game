'use strict';

// --- ELEMENTY UI ---
const authContainer = document.getElementById('auth-container');
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

// Funkcja do zapisu liczby w bazie danych
const saveGuess = (number) => {
  if (!currentUser) return; // Zabezpieczenie, jeśli użytkownik nie jest zalogowany
  const guessesRef = database.ref('guesses');
  guessesRef.push({
    guessedNumber: number,
    timestamp: Date.now(),
    userId: currentUser.uid,
  }).then(() => {
    console.log('Liczba została pomyślnie zapisana w Firebase!');
  }).catch(error => {
    console.error('Błąd zapisu do Firebase:', error);
  });
};

// Funkcja do nasłuchiwania i wyświetlania prób
const listenForGuesses = () => {
  const guessesRef = database.ref('guesses');
  guessesList.innerHTML = ''; // Wyczyść listę przed nowym nasłuchiwaniem
  guessesRef.on('child_added', snapshot => {
    const newGuess = snapshot.val();
    const listItem = document.createElement('li');
    listItem.textContent = `Podano liczbę: ${newGuess.guessedNumber}`;
    guessesList.prepend(listItem);
  });
};

// --- ZARZĄDZANIE STANEM LOGOWANIA ---

// Funkcja wywoływana, gdy użytkownik jest wylogowany
const handleLoggedOutState = () => {
  currentUser = null;
  authContainer.innerHTML = '<button id="login-btn">Zaloguj anonimowo</button>';
  guessInput.disabled = true;
  checkButton.disabled = true;
  displayMessage('Zaloguj się, aby zagrać...');
  guessesList.innerHTML = ''; // Czyści listę prób po wylogowaniu

  document.getElementById('login-btn').addEventListener('click', () => {
    firebase.auth().signInAnonymously();
  });
};

// Funkcja wywoływana, gdy użytkownik jest zalogowany
const handleLoggedInState = (user) => {
  currentUser = user;
  authContainer.innerHTML = `
    <span class="user-uid">UID: ${user.uid.substring(0, 8)}...</span>
    <button id="logout-btn">Wyloguj</button>
  `;
  guessInput.disabled = false;
  checkButton.disabled = false;
  resetGame(); // Resetuj grę po zalogowaniu
  listenForGuesses(); // Zacznij nasłuchiwać na próby

  document.getElementById('logout-btn').addEventListener('click', () => {
    firebase.auth().signOut();
  });
};

// Główny "słuchacz" stanu autentykacji
firebase.auth().onAuthStateChanged(user => {
  if (user) {
    // Użytkownik jest zalogowany
    handleLoggedInState(user);
  } else {
    // Użytkownik jest wylogowany
    handleLoggedOutState();
  }
});

// --- LOGIKA GRY ---

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
