'use strict';

// KROK 1: LOGOWANIE ANONIMOWE
firebase.auth().signInAnonymously()
  .then((userCredential) => {
    // Pomyślnie zalogowano użytkownika
    const user = userCredential.user;
    console.log('Zalogowano anonimowo! UID użytkownika:', user.uid);

    // KROK 2: URUCHOMIENIE LOGIKI GRY PO ZALOGOWANIU
    // Cała dotychczasowa logika gry jest teraz tutaj
    
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
      guessesRef.push({
          guessedNumber: number,
          timestamp: Date.now(),
          userId: user.uid // Dobrą praktyką jest zapisywanie ID użytkownika
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
      
      guessesRef.on('child_added', snapshot => {
        const newGuess = snapshot.val();
        const guessNumber = newGuess.guessedNumber;
        
        const listItem = document.createElement('li');
        listItem.textContent = `Podano liczbę: ${guessNumber}`;
        guessesList.prepend(listItem);
      });
    }
    
    // Uruchomienie nasłuchiwania na dane
    listenForGuesses();
    
    document.querySelector('.check').addEventListener('click', function () {
      const guess = Number(document.querySelector('.guess').value);
    
      if (!guess) {
        displayMessage('⛔️ Nie wpisano liczby!');
      } else if (guess === secretNumber) {
        displayMessage('🎉 Poprawna liczba!');
        document.querySelector('.number').textContent = secretNumber;
        document.querySelector('body').style.backgroundColor = '#60b347';
        document.querySelector('.number').style.width = '30rem';
    
        if (score > highscore) {
          highscore = score;
          document.querySelector('.highscore').textContent = highscore;
        }
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

  })
  .catch((error) => {
    // Obsługa błędów logowania
    console.error("Błąd logowania anonimowego:", error.code, error.message);
  });
