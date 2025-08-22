import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// UWAGA: wklej poniżej swój poprawny kod konfiguracyjny
const firebaseConfig = {
  apiKey: "AIzaSyDgnmnrBiqwFuFcEDpKsG_7hP2c8C4t30E",
  authDomain: "guess-5d206.firebaseapp.com",
  projectId: "guess-5d206",
  storageBucket: "guess-5d206.firebasestorage.app",
  messagingSenderId: "88077227103",
  appId: "1:88077227103:web:90dc97a026d18ea5bcb7ea",
  measurementId: "G-M71PNFJ215"
};

// Pamiętaj, aby powyższe wartości zastąpić swoimi.

// Zaczynamy test połączenia.
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Ta funkcja próbuje utworzyć dokument o nazwie 'testowy-dokument' w kolekcji 'testowa-kolekcja'.
// Jeśli się uda, oznacza to, że połączenie działa poprawnie.
async function testConnection() {
  try {
    const testDocRef = doc(db, "testowa-kolekcja", "testowy-dokument");
    await setDoc(testDocRef, {
      status: "Połączenie działa",
      timestamp: new Date().toISOString()
    });
    console.log("Sukces! 🔥 Połączenie z bazą danych Firestore działa poprawnie. Sprawdź, czy dokument 'testowy-dokument' pojawił się w konsoli Firebase.");
  } catch (error) {
    console.error("Błąd połączenia z bazą danych:", error);
  }
}

testConnection();


