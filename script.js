import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getFirestore, collection, doc, setDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

// Twoja konfiguracja Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDgnmnrBiqwFuFcEDpKsG_7hP2c8C4t30E",
  authDomain: "guess-5d206.firebaseapp.com",
  projectId: "guess-5d206",
  storageBucket: "guess-5d206.firebasestorage.app",
  messagingSenderId: "88077227103",
  appId: "1:88077227103:web:90dc97a026d18ea5bcb7ea",
  measurementId: "G-M71PNFJ215"
};

// Inicjalizacja Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Funkcja testująca połączenie
async function testConnection() {
    try {
        // KROK 1: Zaloguj użytkownika anonimowo
        const userCredential = await signInAnonymously(auth);
        console.log("Zalogowano anonimowo, UID:", userCredential.user.uid);

        // KROK 2: Po udanym logowaniu zapisz dane do Firestore
        await setDoc(doc(db, "testowa-kolekcja", "testowy-dokument"), {
            test: "to jest testowy dokument"
        });
        
        console.log("Połączenie udane, dokument dodano! 🎉");
    } catch (error) {
        console.error("Błąd połączenia: ", error);
    }
}

// Uruchom test połączenia
testConnection();
