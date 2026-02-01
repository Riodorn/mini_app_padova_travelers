document.addEventListener('DOMContentLoaded', () => {
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();

    const stazionePartenza = document.getElementById('partenza');
    const stazioneArrivo = document.getElementById('arrivo');
    const suggestionsContainer = document.getElementById('suggestions');
    let stazioni = [];
    let searchTimeout;

    // Carica le stazioni dal file
    fetch('stazioni.txt')
        .then(response => response.text())
        .then(text => {
            stazioni = text.split('\n').filter(s => s.trim() !== ''); // Pulisce da righe vuote
        })
        .catch(error => console.error('Errore nel caricamento delle stazioni:', error));

    function sendDataToBot(partenza, arrivo) {
        if (partenza && arrivo) {
            const data = { partenza, arrivo };
            tg.sendData(JSON.stringify(data));
            tg.close();
        }
    }

    function generateSuggestions(query) {
      suggestionsContainer.innerHTML = '';
      const partenza_utente = stazionePartenza.value.trim().toLowerCase();
      const arrivo_utente = stazioneArrivo.value.trim().toLowerCase();

      // Ora controlliamo solo che la PARTENZA abbia almeno 3 caratteri
      if (partenza_utente.length < 3) {
          return;
      }

      const possibiliPartenze = stazioni.filter(s => s.toLowerCase().startsWith(partenza_utente));
      // Filtriamo gli arrivi solo se l'utente ha scritto almeno 3 caratteri, altrimenti lista vuota
      const possibiliArrivi = arrivo_utente.length >= 3 
          ? stazioni.filter(s => s.toLowerCase().startsWith(arrivo_utente)) 
          : [];

      // Se non trovo nessuna stazione di partenza, esco
      if (possibiliPartenze.length === 0) {
          return;
      }

      const fragment = document.createDocumentFragment();

      // CASO A: Abbiamo stazioni di arrivo compatibili (mostriamo combinazioni)
      if (possibiliArrivi.length > 0) {
          possibiliPartenze.forEach(dep => {
              possibiliArrivi.forEach(arr => {
                  if (dep === arr) return;

                  const suggestionItem = document.createElement('a');
                  suggestionItem.href = '#';
                  suggestionItem.className = 'list-group-item list-group-item-action';
                  suggestionItem.textContent = `${dep} → ${arr}`;
                  
                  suggestionItem.addEventListener('click', (e) => {
                      e.preventDefault();
                      sendDataToBot(dep, arr);
                  });
                  fragment.appendChild(suggestionItem);
              });
          });
      } 
      // CASO B: L'arrivo è vuoto o non ha match (mostriamo solo Partenza →)
      else {
          possibiliPartenze.forEach(dep => {
              const suggestionItem = document.createElement('a');
              suggestionItem.href = '#';
              suggestionItem.className = 'list-group-item list-group-item-action';
              suggestionItem.textContent = `${dep} →`; // Solo partenza con freccia
              
              suggestionItem.addEventListener('click', (e) => {
                  e.preventDefault();
                  // Qui decidi cosa fare: magari scrivi la stazione nel campo partenza
                  stazionePartenza.value = dep;
                  suggestionsContainer.innerHTML = ''; 
              });
              fragment.appendChild(suggestionItem);
          });
      }

      suggestionsContainer.appendChild(fragment);
    }

    stazionePartenza.addEventListener('input', () => {
        const query = stazionePartenza.value;
        // Usa un timeout per non eseguire la ricerca ad ogni singolo carattere digitato
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            generateSuggestions(query);
        }, 150); // Un piccolo ritardo per migliorare le performance
    });

    stazioneArrivo.addEventListener('input', () => {
        const query = stazioneArrivo.value;
        // Usa un timeout per non eseguire la ricerca ad ogni singolo carattere digitato
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            generateSuggestions(query);
        }, 150); // Un piccolo ritardo per migliorare le performance
    });

    // // Chiudi i suggerimenti se si clicca altrove
    // document.addEventListener('click', (e) => {
    //     // Assicurati che il click non sia sull'input o sulla lista dei suggerimenti
    //     if (!suggestionsContainer.contains(e.target) && e.target !== stazionePartenza) {
    //         suggestionsContainer.innerHTML = '';
    //     }
    // });
});
