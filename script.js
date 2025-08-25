'use strict';

// Inicjalizacja Firebase Realtime Database
const database = firebase.database();

// Referencja do kolekcji 'guesses' w bazie danych
const guessesRef = database.ref('guesses');

let secretNumber = Math.trunc(Math.random() * 20) + 1;
let score = 20;
let highscore = 0;

const displayMessage = function (message) {
  document.querySelector('.message').textContent = message;
};

// Funkcja do zapisu liczby w Firebase
function saveGuess(number) {
  // .push() tworzy unikalny klucz dla każdego nowego zapisu
  guessesRef.push({
      guessedNumber: number,
      timestamp: Date.now()
    })
    .then(() => {
      console.log('Liczba została pomyślnie zapisana w Firebase!');
    })
    .catch(error => {
      console.error('Błąd zapisu do Firebase:', error);
    });
}

// Funkcja do odczytu i wyświetlania danych z Firebase
function listenForGuesses() {
  const guessesList = document.getElementById('guesses-list');
  
  // Listener, który reaguje na każdy nowy wpis ('child_added') w kolekcji 'guesses'
  guessesRef.on('child_added', snapshot => {
    const newGuess = snapshot.val();
    const guessNumber = newGuess.guessedNumber;
    
    // Tworzymy nowy element <li> i dodajemy go na początek listy
    const listItem = document.createElement('li');
    listItem.textContent = `Podano liczbę: ${guessNumber}`;
    guessesList.prepend(listItem); // prepend() dodaje na górze listy
  });
}

// Uruchomienie nasłuchiwania na dane przy starcie aplikacji
listenForGuesses();

document.querySelector('.check').addEventListener('click', function () {
  const guess = Number(document.querySelector('.guess').value);
  console.log(guess, typeof guess);

  // Gdy nie ma liczby
  if (!guess) {
    displayMessage('⛔️ Nie wpisano liczby!');

    // Gdy gracz wygra
  } else if (guess === secretNumber) {
    displayMessage('🎉 Poprawna liczba!');
    document.querySelector('.number').textContent = secretNumber;
    document.querySelector('body').style.backgroundColor = '#60b347';
    document.querySelector('.number').style.width = '30rem';

    if (score > highscore) {
      highscore = score;
      document.querySelector('.highscore').textContent = highscore;
    }

    // Gdy liczba jest inna niż sekretna
  } else if (guess !== secretNumber) {
    if (score > 1) {
      displayMessage(guess > secretNumber ? '📈 Za wysoko!' : '📉 Za nisko!');
      score--;
      document.querySelector('.score').textContent = score;
    } else {
      displayMessage('💥 Przegrałeś grę!');
      document.querySelector('.score').textContent = 0;
    }
  }

  // Zapisz próbę do Firebase, jeśli podano jakąś liczbę
  if (guess) {
    saveGuess(guess);
  }
});

document.querySelector('.again').addEventListener('click', function () {
  score = 20;
  secretNumber = Math.trunc(Math.random() * 20) + 1;

  displayMessage('Zacznij zgadywać...');
  document.querySelector('.score').textContent = score;
  document.querySelector('.number').textContent = '?';
  document.querySelector('.guess').value = '';

  document.querySelector('body').style.backgroundColor = '#222';
  document.querySelector('.number').style.width = '15rem';
});
