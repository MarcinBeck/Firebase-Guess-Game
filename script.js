// Inicjalizujemy referencję do naszej bazy danych
const database = firebase.database();

// Pobieramy elementy z HTML-a, żeby móc z nimi pracować
const valueInputElement = document.getElementById('valueInput');
const saveButtonElement = document.getElementById('saveButton');
const dataContainerElement = document.getElementById('dataContainer');

// --- 1. LOGIKA ZAPISYWANIA DANYCH ---
// Ta funkcja uruchomi się po kliknięciu przycisku "Zapisz"
saveButtonElement.addEventListener('click', function() {
    const textToSave = valueInputElement.value;

    // Sprawdzamy, czy użytkownik cokolwiek wpisał
    if (textToSave) {
        // Używamy .ref('wpisy') żeby stworzyć "folder" na nasze dane
        // Używamy .push() żeby dodać nowy wpis z unikalnym ID
        database.ref('wpisy').push(textToSave)
            .then(function() {
                console.log("Dane zapisane pomyślnie!");
                // Czyścimy pole do wpisywania po udanym zapisie
                valueInputElement.value = '';
            })
            .catch(function(error) {
                console.error("Wystąpił błąd podczas zapisu:", error);
            });
    }
});

// --- 2. LOGIKA ODCZYTYWANIA DANYCH ---
// Tworzymy referencję do naszego "folderu" z danymi
const wpisyRef = database.ref('wpisy');

// Używamy .on('value', ...) żeby nasłuchiwać na zmiany
// Ta funkcja uruchomi się raz przy starcie i za każdym razem, gdy dane się zmienią
wpisyRef.on('value', function(snapshot) {
    // Czyścimy starą listę przed wyświetleniem nowej
    dataContainerElement.innerHTML = '';

    const data = snapshot.val(); // Pobieramy wszystkie dane jako obiekt

    // Sprawdzamy, czy w ogóle są jakieś dane
    if (data) {
        // Przechodzimy przez każdy wpis w obiekcie
        for (const key in data) {
            const value = data[key];

            // Tworzymy nowy element listy (<li>) dla każdego wpisu
            const listItem = document.createElement('li');
            listItem.textContent = value;

            // Dodajemy stworzony element do naszej listy na stronie
            dataContainerElement.appendChild(listItem);
        }
    } else {
        dataContainerElement.innerHTML = '<li>Brak danych w bazie.</li>';
    }
});
