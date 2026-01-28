const tg = window.Telegram.WebApp;
tg.expand();

// Seleziona il form (sostituisci 'myForm' con l'ID del tuo form)
const form = document.getElementById("myForm");
const output = document.getElementById("output");

form.addEventListener("submit", (e) => {
  e.preventDefault(); // Previene il refresh della pagina

  try {
    output.innerText = "Caricamento...";

    // Raccogli i dati del form
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    const jsonData = JSON.stringify(data);

    console.log("Invio dati:", jsonData);

    // Invia i dati al bot Telegram
    tg.sendData(jsonData);

    // Dopo aver inviato i dati, è pratica comune chiudere la Mini App.
    // Il bot può quindi inviare un messaggio di conferma nella chat.
    // tg.close();
  } catch (error) {
    console.error("Errore durante l'invio del form:", error);
    output.innerText = "Si è verificato un errore. Riprova.";
  }
});
