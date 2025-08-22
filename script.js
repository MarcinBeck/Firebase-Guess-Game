import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDgnmnrBiqwFuFcEDpKsG_7hP2c8C4t30E",
  authDomain: "guess-5d206.firebaseapp.com",
  projectId: "guess-5d206",
  storageBucket: "guess-5d206.firebasestorage.app",
  messagingSenderId: "88077227103",
  appId: "1:88077227103:web:4eae99db4fb7e1fcbcb7ea",
  measurementId: "G-V620WE8CYB"
};

// Zastąp "TWOJ_API_KEY" i pozostałe wartości swoimi danymi z konsoli Firebase
// (jeśli nadal masz projekt guess-5d206, użyj jego danych, jeśli go usunąłeś, użyj danych nowego projektu)

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Funkcja testująca połączenie
async function testConnection() {
    try {
        await setDoc(doc(db, "test", "connection-status"), {
            status: "ok",
            timestamp: new Date().toISOString()
        });
        console.log("Połączenie z Firestore działa. Dokument został pomyślnie zapisany.");
    } catch (e) {
        console.error("Błąd połączenia z Firestore:", e);
    }
}

// Wywołaj funkcję testową
testConnection();

// WAŻNE: Cały Twój właściwy kod (z klasyfikatorem) tymczasowo usuń
// Wklej to w jego miejsce


