/**
 * Padova Travel Mini App — Enhanced JavaScript
 * Handles station search, autocomplete suggestions, recent searches, and Telegram Web App integration
 */

(function () {
  'use strict';

  // ==========================================================================
  // Constants & Configuration
  // ==========================================================================

  const CONFIG = {
    minSearchLength: 3,
    debounceMs: 150,
    maxSuggestions: 10,
    maxRecentSearches: 5,
    recentStorageKey: 'padova_travel_recent_searches',
    stationsCacheKey: 'padova_travel_stations_cache',
    stationsCacheTTL: 24 * 60 * 60 * 1000 // 24 hours
  };

  // ==========================================================================
  // State
  // ==========================================================================

  let stazioni = [];
  let stationsLoaded = false;
  let activeDropdown = null;
  let tg = null;

  // DOM Elements
  const elements = {
    partenza: null,
    arrivo: null,
    partenzaDropdown: null,
    arrivoDropdown: null,
    partenzaClear: null,
    arrivoClear: null,
    suggestionsSection: null,
    suggestionsList: null,
    suggestionsEmpty: null,
    recentSection: null,
    recentList: null,
    searchForm: null,
    submitBtn: null,
    searchStatus: null
  };

  // ==========================================================================
  // Telegram Web App Initialization
  // ==========================================================================

  function initTelegramWebApp() {
    tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      // Set theme colors to match our design
      tg.setHeaderColor && tg.setHeaderColor('#c82333');
      tg.setBackgroundColor && tg.setBackgroundColor('#ffffff');
    }
  }

  // ==========================================================================
  // Station Data Loading
  // ==========================================================================

  async function loadStations() {
    try {
      // Try cache first
      const cached = getCachedStations();
      if (cached) {
        stazioni = cached;
        stationsLoaded = true;
        return;
      }

      const response = await fetch('stazioni.txt', { cache: 'force-cache' });
      if (!response.ok) throw new Error('Failed to load stations');

      const text = await response.text();
      stazioni = text
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      // Cache for future loads
      cacheStations(stazioni);
      stationsLoaded = true;
    } catch (error) {
      console.error('Errore nel caricamento delle stazioni:', error);
      showSearchStatus('Impossibile caricare le stazioni. Riprova più tardi.', 'error');
    }
  }

  function getCachedStations() {
    try {
      const cached = localStorage.getItem(CONFIG.stationsCacheKey);
      if (!cached) return null;

      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp > CONFIG.stationsCacheTTL) {
        localStorage.removeItem(CONFIG.stationsCacheKey);
        return null;
      }
      return data;
    } catch {
      return null;
    }
  }

  function cacheStations(data) {
    try {
      localStorage.setItem(CONFIG.stationsCacheKey, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch {
      // Ignore cache errors
    }
  }

  // ==========================================================================
  // Search & Filter Logic
  // ==========================================================================

  function filterStations(query) {
    const normalized = query.toLowerCase().trim();
    if (normalized.length < CONFIG.minSearchLength) return [];

    return stazioni
      .filter(s => s.toLowerCase().startsWith(normalized))
      .slice(0, CONFIG.maxSuggestions);
  }

  function debounce(fn, delay) {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    };
  }

  // ==========================================================================
  // Dropdown Rendering
  // ==========================================================================

  function createDropdownItem(station, type) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'suggestion-item';
    item.role = 'option';
    item.setAttribute('data-station', station);
    item.setAttribute('data-type', type);

    const iconSvg = type === 'partenza'
      ? '<svg class="suggestion-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>'
      : '<svg class="suggestion-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';

    item.innerHTML = `
      ${iconSvg}
      <span class="suggestion-name">${escapeHtml(station)}</span>
      <span class="suggestion-type">${type === 'partenza' ? 'Partenza' : 'Arrivo'}</span>
    `;

    item.addEventListener('click', () => selectStation(station, type));
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectStation(station, type);
      }
    });

    return item;
  }

  function renderDropdown(inputEl, dropdownEl, stations, type) {
    dropdownEl.innerHTML = '';

    if (stations.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'dropdown-empty';
      empty.textContent = `Nessuna stazione trovata per "${inputEl.value}"`;
      dropdownEl.appendChild(empty);
    } else {
      const fragment = document.createDocumentFragment();
      stations.forEach(station => {
        fragment.appendChild(createDropdownItem(station, type));
      });
      dropdownEl.appendChild(fragment);
    }

    dropdownEl.hidden = false;
    activeDropdown = dropdownEl;
  }

  function hideDropdown(dropdownEl) {
    if (dropdownEl) {
      dropdownEl.hidden = true;
      dropdownEl.innerHTML = '';
    }
    if (activeDropdown === dropdownEl) {
      activeDropdown = null;
    }
  }

  function hideAllDropdowns() {
    hideDropdown(elements.partenzaDropdown);
    hideDropdown(elements.arrivoDropdown);
  }

  // ==========================================================================
  // Station Selection
  // ==========================================================================

  function selectStation(station, type) {
    const inputEl = type === 'partenza' ? elements.partenza : elements.arrivo;
    const dropdownEl = type === 'partenza' ? elements.partenzaDropdown : elements.arrivoDropdown;
    const clearBtn = type === 'partenza' ? elements.partenzaClear : elements.arrivoClear;

    inputEl.value = station;
    inputEl.classList.add('has-value');
    clearBtn.hidden = false;
    hideDropdown(dropdownEl);
    inputEl.focus();
    validateForm();
    updateCombinations();
  }

  // ==========================================================================
  // Input Event Handlers
  // ==========================================================================

  const handleInput = debounce((inputEl, dropdownEl, clearBtn, type) => {
    const query = inputEl.value.trim();

    if (query.length >= CONFIG.minSearchLength && stationsLoaded) {
      const results = filterStations(query);
      renderDropdown(inputEl, dropdownEl, results, type);
    } else {
      hideDropdown(dropdownEl);
    }

    // Toggle clear button
    const hasValue = query.length > 0;
    inputEl.classList.toggle('has-value', hasValue);
    clearBtn.hidden = !hasValue;
    validateForm();
    updateCombinations();
  }, CONFIG.debounceMs);

  function handleClear(inputEl, dropdownEl, clearBtn) {
    inputEl.value = '';
    inputEl.classList.remove('has-value');
    clearBtn.hidden = true;
    hideDropdown(dropdownEl);
    inputEl.focus();
    validateForm();
    updateCombinations();
  }

  function handleFocus(inputEl, dropdownEl, type) {
    const query = inputEl.value.trim();
    if (query.length >= CONFIG.minSearchLength && stationsLoaded) {
      const results = filterStations(query);
      renderDropdown(inputEl, dropdownEl, results, type);
    }
  }

  function handleBlur(inputEl, dropdownEl) {
    // Delay hiding to allow click on dropdown items
    setTimeout(() => {
      if (activeDropdown === dropdownEl && !dropdownEl.matches(':hover')) {
        hideDropdown(dropdownEl);
      }
    }, 200);
  }

  function handleKeydown(e, inputEl, dropdownEl, type) {
    if (!dropdownEl || dropdownEl.hidden) return;

    const items = dropdownEl.querySelectorAll('.suggestion-item:not(.dropdown-empty)');
    if (items.length === 0) return;

    let currentIndex = Array.from(items).findIndex(item => item === document.activeElement);

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        currentIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
        items[currentIndex].focus();
        break;
      case 'ArrowUp':
        e.preventDefault();
        currentIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
        items[currentIndex].focus();
        break;
      case 'Escape':
        hideDropdown(dropdownEl);
        inputEl.focus();
        break;
      case 'Tab':
        hideDropdown(dropdownEl);
        break;
    }
  }

  // ==========================================================================
  // Form Validation
  // ==========================================================================

  function validateForm() {
    const partenzaValid = elements.partenza.value.trim().length >= CONFIG.minSearchLength;
    const arrivoValid = elements.arrivo.value.trim().length === 0 || elements.arrivo.value.trim().length >= CONFIG.minSearchLength;
    const isValid = partenzaValid && arrivoValid;

    elements.submitBtn.disabled = !isValid;
    elements.submitBtn.setAttribute('aria-disabled', !isValid);
  }

  // ==========================================================================
  // Search Status Display
  // ==========================================================================

  function showSearchStatus(message, type = 'info') {
    elements.searchStatus.textContent = message;
    elements.searchStatus.className = 'search-status ' + type;
    elements.searchStatus.hidden = false;

    if (type !== 'loading') {
      setTimeout(() => {
        elements.searchStatus.hidden = true;
      }, 4000);
    }
  }

  // ==========================================================================
  // Recent Searches Management
  // ==========================================================================

  function getRecentSearches() {
    try {
      const stored = localStorage.getItem(CONFIG.recentStorageKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  function saveRecentSearch(partenza, arrivo) {
    if (!partenza || !arrivo) return;

    const recent = getRecentSearches();
    const newEntry = {
      partenza,
      arrivo,
      timestamp: Date.now()
    };

    // Remove existing entry with same route
    const filtered = recent.filter(r => !(r.partenza === partenza && r.arrivo === arrivo));

    // Add to front
    filtered.unshift(newEntry);

    // Limit size
    const limited = filtered.slice(0, CONFIG.maxRecentSearches);

    try {
      localStorage.setItem(CONFIG.recentStorageKey, JSON.stringify(limited));
    } catch {
      // Ignore storage errors
    }

    renderRecentSearches();
  }

  function formatRelativeTime(timestamp) {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Ora';
    if (minutes < 60) return `${minutes}m fa`;
    if (hours < 24) return `${hours}h fa`;
    if (days < 7) return `${days}g fa`;
    return new Date(timestamp).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
  }

  function createRecentItem(entry) {
    const item = document.createElement('a');
    item.href = '#';
    item.className = 'recent-item';
    item.setAttribute('data-partenza', entry.partenza);
    item.setAttribute('data-arrivo', entry.arrivo);

    item.innerHTML = `
      <div class="recent-route">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" style="width:18px;height:18px;color:var(--text-muted);flex-shrink:0">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
        <span>${escapeHtml(entry.partenza)} → ${escapeHtml(entry.arrivo)}</span>
      </div>
      <span class="recent-time">${formatRelativeTime(entry.timestamp)}</span>
      <button class="recent-action" type="button" aria-label="Ripeti ricerca">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" style="width:16px;height:16px">
          <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
        </svg>
      </button>
    `;

    item.addEventListener('click', (e) => {
      e.preventDefault();
      if (e.target.closest('.recent-action')) return;
      selectRecentSearch(entry.partenza, entry.arrivo);
    });

    item.querySelector('.recent-action').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      selectRecentSearch(entry.partenza, entry.arrivo);
    });

    return item;
  }

  function selectRecentSearch(partenza, arrivo) {
    elements.partenza.value = partenza;
    elements.partenza.classList.add('has-value');
    elements.partenzaClear.hidden = false;

    elements.arrivo.value = arrivo;
    elements.arrivo.classList.add('has-value');
    elements.arrivoClear.hidden = false;

    hideAllDropdowns();
    validateForm();

    // Scroll to form
    elements.searchForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function renderRecentSearches() {
    const recent = getRecentSearches();
    elements.recentList.innerHTML = '';

    if (recent.length === 0) {
      elements.recentSection.hidden = true;
      return;
    }

    const fragment = document.createDocumentFragment();
    recent.forEach(entry => {
      fragment.appendChild(createRecentItem(entry));
    });
    elements.recentList.appendChild(fragment);
    elements.recentSection.hidden = false;
  }

  // ==========================================================================
  // Suggestion Cards (Combinations)
  // ==========================================================================

  function updateCombinations() {
    const partenzaQuery = elements.partenza.value.trim();
    const arrivoQuery = elements.arrivo.value.trim();
    generateCombinations(partenzaQuery, arrivoQuery);
  }

  function generateCombinations(partenzaQuery, arrivoQuery) {
    elements.suggestionsList.innerHTML = '';

    const partenzaLower = partenzaQuery.toLowerCase().trim();
    const arrivoLower = arrivoQuery.toLowerCase().trim();

    if (partenzaLower.length < CONFIG.minSearchLength) {
      elements.suggestionsSection.hidden = true;
      return;
    }

    const possibiliPartenze = stazioni.filter(s => s.toLowerCase().startsWith(partenzaLower));
    const possibiliArrivi = arrivoLower.length >= CONFIG.minSearchLength
      ? stazioni.filter(s => s.toLowerCase().startsWith(arrivoLower))
      : [];

    if (possibiliPartenze.length === 0) {
      elements.suggestionsSection.hidden = true;
      return;
    }

    const fragment = document.createDocumentFragment();
    let count = 0;

    if (possibiliArrivi.length > 0) {
      // Case A: Both departure and arrival have matches
      for (const dep of possibiliPartenze) {
        for (const arr of possibiliArrivi) {
          if (dep === arr) continue;
          if (count >= 15) break;
          fragment.appendChild(createCombinationCard(dep, arr));
          count++;
        }
        if (count >= 15) break;
      }
    } else {
      // Case B: Only departure has matches
      for (const dep of possibiliPartenze.slice(0, 10)) {
        fragment.appendChild(createCombinationCard(dep, null));
        count++;
      }
    }

    elements.suggestionsList.appendChild(fragment);
    elements.suggestionsEmpty.hidden = count > 0;
    elements.suggestionsSection.hidden = false;
  }

  function createCombinationCard(dep, arr) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'suggestion-card';

    const hasArrival = arr !== null;

    card.innerHTML = `
      <svg class="card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="M5 17V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10"/>
        <path d="M3 17h18"/>
        <path d="M7 17v-3a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v3"/>
      </svg>
      <div class="card-route">
        <div class="card-departure">
          <svg class="card-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
          <span>${escapeHtml(dep)}</span>
        </div>
        ${hasArrival ? `
        <div class="card-arrival">
          <svg class="card-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
          <span>${escapeHtml(arr)}</span>
        </div>
        ` : ''}
      </div>
      <button class="card-action" type="button" aria-label="${hasArrival ? 'Cerca questo viaggio' : 'Usa come partenza'}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          ${hasArrival
            ? '<path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>'
            : '<path d="M5 12h14M12 5l7 7-7 7"/>'}
        </svg>
      </button>
    `;

    const actionBtn = card.querySelector('.card-action');
    actionBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (hasArrival) {
        sendDataToBot(dep, arr);
      } else {
        elements.partenza.value = dep;
        elements.partenza.classList.add('has-value');
        elements.partenzaClear.hidden = false;
        hideAllDropdowns();
        validateForm();
        elements.arrivo.focus();
      }
    });

    card.addEventListener('click', () => {
      if (hasArrival) {
        sendDataToBot(dep, arr);
      }
    });

    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (hasArrival) {
          sendDataToBot(dep, arr);
        }
      }
    });

    return card;
  }

  // ==========================================================================
  // Telegram Bot Communication
  // ==========================================================================

  function sendDataToBot(partenza, arrivo) {
    if (!partenza || !arrivo) return;

    // Save to recent searches
    saveRecentSearch(partenza, arrivo);

    if (tg) {
      const data = { partenza, arrivo };
      tg.sendData(JSON.stringify(data));
      tg.close();
    } else {
      // Fallback for testing outside Telegram
      console.log('Dati da inviare al bot:', data);
      showSearchStatus('Dati inviati al bot!', 'success');
    }
  }

  // ==========================================================================
  // Form Submission
  // ==========================================================================

  function handleSubmit(e) {
    e.preventDefault();

    const partenza = elements.partenza.value.trim();
    const arrivo = elements.arrivo.value.trim();

    if (!partenza || partenza.length < CONFIG.minSearchLength) {
      elements.partenza.focus();
      showSearchStatus('Inserisci almeno 3 caratteri per la partenza', 'error');
      return;
    }

    if (arrivo && arrivo.length < CONFIG.minSearchLength) {
      elements.arrivo.focus();
      showSearchStatus('L\'arrivo deve avere almeno 3 caratteri', 'error');
      return;
    }

    sendDataToBot(partenza, arrivo);
  }

  // ==========================================================================
  // Utility Functions
  // ==========================================================================

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function cacheElements() {
    elements.partenza = document.getElementById('partenza');
    elements.arrivo = document.getElementById('arrivo');
    elements.partenzaDropdown = document.getElementById('partenza-suggestions');
    elements.arrivoDropdown = document.getElementById('arrivo-suggestions');
    elements.partenzaClear = elements.partenza?.nextElementSibling;
    elements.arrivoClear = elements.arrivo?.nextElementSibling;
    elements.suggestionsSection = document.getElementById('suggestionsSection');
    elements.suggestionsList = document.getElementById('suggestions');
    elements.suggestionsEmpty = document.querySelector('.suggestions-empty');
    elements.recentSection = document.getElementById('recentSection');
    elements.recentList = document.getElementById('recentList');
    elements.searchForm = document.getElementById('searchForm');
    elements.submitBtn = document.getElementById('cerca');
    elements.searchStatus = document.getElementById('searchStatus');
  }

  function bindEvents() {
    // Partenza input
    elements.partenza.addEventListener('input', () =>
      handleInput(elements.partenza, elements.partenzaDropdown, elements.partenzaClear, 'partenza')
    );
    elements.partenza.addEventListener('focus', () =>
      handleFocus(elements.partenza, elements.partenzaDropdown, 'partenza')
    );
    elements.partenza.addEventListener('blur', () =>
      handleBlur(elements.partenza, elements.partenzaDropdown)
    );
    elements.partenza.addEventListener('keydown', (e) =>
      handleKeydown(e, elements.partenza, elements.partenzaDropdown, 'partenza')
    );

    // Arrivo input
    elements.arrivo.addEventListener('input', () =>
      handleInput(elements.arrivo, elements.arrivoDropdown, elements.arrivoClear, 'arrivo')
    );
    elements.arrivo.addEventListener('focus', () =>
      handleFocus(elements.arrivo, elements.arrivoDropdown, 'arrivo')
    );
    elements.arrivo.addEventListener('blur', () =>
      handleBlur(elements.arrivo, elements.arrivoDropdown)
    );
    elements.arrivo.addEventListener('keydown', (e) =>
      handleKeydown(e, elements.arrivo, elements.arrivoDropdown, 'arrivo')
    );

    // Clear buttons
    elements.partenzaClear.addEventListener('click', () =>
      handleClear(elements.partenza, elements.partenzaDropdown, elements.partenzaClear)
    );
    elements.arrivoClear.addEventListener('click', () =>
      handleClear(elements.arrivo, elements.arrivoDropdown, elements.arrivoClear)
    );

    // Form submit
    elements.searchForm.addEventListener('submit', handleSubmit);

    // Close dropdowns on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.form-field')) {
        hideAllDropdowns();
      }
    });

    // Handle Telegram Web App theme changes
    if (tg && tg.onEvent) {
      tg.onEvent('themeChanged', () => {
        // Force reflow to apply new theme colors
        document.body.style.display = 'none';
        document.body.offsetHeight; // trigger reflow
        document.body.style.display = '';
      });
    }
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  async function init() {
    initTelegramWebApp();
    cacheElements();
    bindEvents();
    renderRecentSearches();
    await loadStations();

    // Enable form once stations are loaded
    validateForm();
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();