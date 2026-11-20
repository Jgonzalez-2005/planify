// ==========================================
// ESTADO GLOBAL Y CONSTANTES
// ==========================================
// CONSTANTES
// ==========================================
const STORAGE_KEYS = {
  FAVORITES: 'planify_favorites_v1',
  TRIPS: 'planify_trips_v1'
};

const state = {
  countries: [],
  filteredCountries: [],
  selectedRegion: 'all',
  searchQuery: '',
  selectedCountry: null,
  favorites: JSON.parse(localStorage.getItem(STORAGE_KEYS.FAVORITES)) || [],
  trips: JSON.parse(localStorage.getItem(STORAGE_KEYS.TRIPS)) || []
};

const FEATURED_CODES = ['ESP', 'JPN', 'COL', 'CAN'];

const WEATHER_CODES = {
  0: 'Despejado ☀️',
  1: 'Mayormente despejado 🌤️',
  2: 'Parcialmente nublado ⛅',
  3: 'Nublado ☁️',
  45: 'Niebla 🌫️',
  48: 'Niebla con escarcha 🌫️',
  51: 'Llovizna ligera 🌦️',
  61: 'Lluvia ligera 🌧️',
  63: 'Lluvia moderada 🌧️',
  65: 'Lluvia fuerte ⛈️',
  80: 'Chubascos 🌦️',
  95: 'Tormenta eléctrica ⛈️'
};

let searchDebounceTimer = null;

// ==========================================
// INICIALIZACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupEventListeners();
  updateBadges();
  renderFavorites();
  renderTrips();
  fetchCountries();
});

// ==========================================
// NAVEGACIÓN ENTRE VISTAS
// ==========================================
function setupNavigation() {
  document.querySelectorAll('[data-nav]').forEach((trigger) => {
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      const target = trigger.getAttribute('data-nav');
      switchView(target);
      document.getElementById('nav-links').classList.remove('open');
    });
  });

  document.getElementById('menu-toggle').addEventListener('click', () => {
    const nav = document.getElementById('nav-links');
    nav.classList.toggle('open');
  });
}

function switchView(viewId) {
  document.querySelectorAll('.view-section').forEach((sec) => sec.classList.remove('active'));
  const targetSection = document.getElementById(viewId);
  if (targetSection) targetSection.classList.add('active');

  document.querySelectorAll('.nav-link').forEach((link) => {
    link.classList.toggle('active', link.getAttribute('data-nav') === viewId);
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================
// NORMALIZACIÓN Y CONSUMO DE API 1: REST COUNTRIES
// ==========================================
function normalizeCountries(data) {
  if (!Array.isArray(data)) return [];
  return data
    .filter((c) => c && (c.cca3 || c.name?.common))
    .map((c, idx) => ({
      code: c.cca3 || `IDX-${idx}`,
      name: c.translations?.spa?.common || c.name?.common || 'Sin nombre',
      officialName: c.translations?.spa?.official || c.name?.official || '',
      capital: Array.isArray(c.capital) && c.capital.length ? c.capital[0] : 'No registrada',
      region: c.region || 'Otra',
      subregion: c.subregion || 'No especificada',
      population: c.population || 0,
      languages: c.languages ? Object.values(c.languages).join(', ') : 'No especificado',
      currencies: c.currencies
        ? Object.values(c.currencies)
            .map((cur) => `${cur.name} (${cur.symbol || ''})`)
            .join(', ')
        : 'No especificada',
      flag: c.flags?.svg || c.flags?.png || '',
      latlng: Array.isArray(c.latlng) && c.latlng.length === 2 ? c.latlng : [0, 0]
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

async function fetchCountries() {
  const statusEl = document.getElementById('explore-status');
  statusEl.style.display = 'block';
  statusEl.textContent = 'Cargando destinos desde REST Countries...';

  const fields = 'cca3,name,translations,capital,region,subregion,population,languages,currencies,flags,latlng';

  try {
    const response = await fetch(`https://restcountries.com/v3.1/all?fields=${fields}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    state.countries = normalizeCountries(data);

    statusEl.style.display = 'none';
    populateCountriesDatalist();
    renderFeatured();
    applyFilters();
  } catch (error) {
    try {
      const fallbackRes = await fetch(
        'https://restcountries.com/v3.1/alpha?codes=col,esp,jpn,can,mex,arg,bra,usa,fra,ita,gbr,deu'
      );
      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json();
        state.countries = normalizeCountries(Array.isArray(fallbackData) ? fallbackData : [fallbackData]);
        statusEl.style.display = 'none';
        populateCountriesDatalist();
        renderFeatured();
        applyFilters();
        return;
      }
    } catch (_) {
      // Continúa al mensaje de error
    }

    statusEl.textContent = 'No se pudieron cargar los países. Verifica tu conexión a internet.';
    showToast('Error al conectar con REST Countries API', 'error');
  }
}

function populateCountriesDatalist() {
  const datalist = document.getElementById('countries-datalist');
  datalist.innerHTML = state.countries
    .map((c) => `<option value="${c.name} - ${c.capital}"></option>`)
    .join('');
}

// ==========================================
// RENDERIZADO DE TARJETAS Y EXPLORADOR
// ==========================================
function createCountryCardHTML(country) {
  const isFav = state.favorites.some((fav) => fav.code === country.code);
  return `
    <article class="country-card">
      <img src="${country.flag}" alt="Bandera de ${country.name}" class="country-flag" loading="lazy" />
      <div class="country-body">
        <span class="country-region">${translateRegion(country.region)}</span>
        <h3>${country.name}</h3>
        <ul class="country-meta">
          <li><strong>Capital:</strong> ${country.capital}</li>
          <li><strong>Población:</strong> ${country.population.toLocaleString('es-ES')} hab.</li>
        </ul>
        <div class="country-actions">
          <button class="btn btn-primary btn-sm" onclick="openCountryDetail('${country.code}')">
            Ver detalles
          </button>
          <button class="btn btn-outline btn-sm btn-fav ${isFav ? 'saved' : ''}" onclick="toggleFavorite('${country.code}')">
            ${isFav ? '★ Guardado' : '☆ Favorito'}
          </button>
        </div>
      </div>
    </article>
  `;
}

function renderFeatured() {
  const container = document.getElementById('featured-grid');
  const featured = state.countries.filter((c) => FEATURED_CODES.includes(c.code));
  container.innerHTML = featured.map(createCountryCardHTML).join('');
}

async function applyFilters() {
  const query = state.searchQuery.trim().toLowerCase();
  const grid = document.getElementById('countries-grid');
  const statusEl = document.getElementById('explore-status');

  let matches = state.countries.filter((c) => {
    const matchesRegion = state.selectedRegion === 'all' || c.region === state.selectedRegion;
    const matchesQuery =
      !query ||
      c.name.toLowerCase().includes(query) ||
      c.officialName.toLowerCase().includes(query) ||
      c.capital.toLowerCase().includes(query);
    return matchesRegion && matchesQuery;
  });

  if (matches.length === 0 && query.length >= 2) {
    statusEl.style.display = 'block';
    statusEl.textContent = `Buscando "${state.searchQuery}" en REST Countries...`;

    try {
      const endpoints = [
        `https://restcountries.com/v3.1/translation/${encodeURIComponent(query)}`,
        `https://restcountries.com/v3.1/name/${encodeURIComponent(query)}`
      ];

      for (const url of endpoints) {
        const res = await fetch(url);
        if (res.ok) {
          const apiData = await res.json();
          const normalizedApi = normalizeCountries(apiData);
          if (normalizedApi.length > 0) {
            matches = normalizedApi.filter(
              (c) => state.selectedRegion === 'all' || c.region === state.selectedRegion
            );
            break;
          }
        }
      }
    } catch (_) {
      // Mantiene matches vacío si no hay resultados
    }
  }

  state.filteredCountries = matches;

  if (state.filteredCountries.length === 0) {
    grid.innerHTML = '';
    statusEl.style.display = 'block';
    statusEl.textContent = 'No se encontraron destinos con esos criterios de búsqueda.';
    return;
  }

  statusEl.style.display = 'none';
  grid.innerHTML = state.filteredCountries.slice(0, 48).map(createCountryCardHTML).join('');
}

// ==========================================
// DETALLE DEL DESTINO + API 2 (NOMINATIM) + API 3 (OPEN-METEO)
// ==========================================
async function openCountryDetail(code) {
  let country = state.countries.find((c) => c.code === code);
  if (!country) {
    country = state.filteredCountries.find((c) => c.code === code);
  }
  if (!country) return;

  state.selectedCountry = country;
  const isFav = state.favorites.some((fav) => fav.code === country.code);
  const container = document.getElementById('detail-container');

  container.innerHTML = `
    <div class="detail-grid">
      <div>
        <img src="${country.flag}" alt="Bandera de ${country.name}" class="detail-flag" />
        <div class="detail-specs">
          <div class="spec-item"><strong>Capital</strong>${country.capital}</div>
          <div class="spec-item"><strong>Región</strong>${translateRegion(country.region)} (${country.subregion})</div>
          <div class="spec-item"><strong>Población</strong>${country.population.toLocaleString('es-ES')}</div>
          <div class="spec-item"><strong>Moneda</strong>${country.currencies}</div>
          <div class="spec-item"><strong>Idiomas</strong>${country.languages}</div>
          <div class="spec-item"><strong>Coordenadas base</strong>${country.latlng[0].toFixed(2)}, ${country.latlng[1].toFixed(2)}</div>
        </div>
        <div style="display:flex; gap:0.75rem; flex-wrap:wrap;">
          <button class="btn btn-outline btn-fav ${isFav ? 'saved' : ''}" id="detail-fav-btn" onclick="toggleFavorite('${country.code}')">
            ${isFav ? '★ En tus favoritos' : '☆ Agregar a favoritos'}
          </button>
          <button class="btn btn-primary" onclick="planTripTo('${country.name} - ${country.capital}')">
            + Crear itinerario aquí
          </button>
        </div>
      </div>

      <div>
        <h2>${country.name}</h2>
        <p style="color: var(--text-muted);">${country.officialName}</p>

        <div class="weather-box">
          <h3>Clima y pronóstico del destino</h3>
          <p style="font-size:0.88rem; color:var(--text-muted);">
            Consulta el clima de la capital o busca cualquier ciudad en ${country.name} (Geocodificación OpenStreetMap + Open-Meteo).
          </p>
          <form id="city-weather-form" class="city-search-row">
            <input type="text" id="city-weather-input" value="${country.capital !== 'No registrada' ? country.capital : country.name}" placeholder="Ej. Barcelona, Kioto, Medellín..." required />
            <button type="submit" class="btn btn-primary btn-sm">Consultar clima</button>
          </form>
          <div id="weather-results">Cargando datos meteorológicos...</div>
        </div>
      </div>
    </div>
  `;

  switchView('detalle');

  const cityForm = document.getElementById('city-weather-form');
  cityForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const city = document.getElementById('city-weather-input').value.trim();
    if (city) loadCityWeather(city, country.name, country.latlng);
  });

  const initialCity = country.capital !== 'No registrada' ? country.capital : country.name;
  await loadCityWeather(initialCity, country.name, country.latlng);
}

async function loadCityWeather(cityName, countryName, fallbackCoords) {
  const weatherEl = document.getElementById('weather-results');
  weatherEl.innerHTML = '<p>Obteniendo coordenadas y pronóstico...</p>';

  let lat = fallbackCoords[0];
  let lon = fallbackCoords[1];
  let resolvedPlace = `${cityName}, ${countryName}`;

  try {
    const geoUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(cityName + ', ' + countryName)}`;
    const geoRes = await fetch(geoUrl);
    if (geoRes.ok) {
      const geoData = await geoRes.json();
      if (geoData.length > 0) {
        lat = parseFloat(geoData[0].lat);
        lon = parseFloat(geoData[0].lon);
        resolvedPlace = geoData[0].display_name.split(',').slice(0, 2).join(',');
      }
    }

    const meteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}¤t=temperature_2m,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&timezone=auto&forecast_days=5`;
    const meteoRes = await fetch(meteoUrl);
    if (!meteoRes.ok) throw new Error('Error en Open-Meteo');
    const meteo = await meteoRes.json();

    const currentTemp = Math.round(meteo.current.temperature_2m);
    const windSpeed = Math.round(meteo.current.wind_speed_10m);
    const conditionText = WEATHER_CODES[meteo.current.weather_code] || 'Condición variable 🌤️';
    const rainProb = meteo.daily.precipitation_probability_max?.[0] ?? 0;

    const forecastHTML = meteo.daily.time
      .map((dateStr, idx) => {
        const dateObj = new Date(dateStr + 'T00:00:00');
        const dayName = dateObj.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
        const maxT = Math.round(meteo.daily.temperature_2m_max[idx]);
        const minT = Math.round(meteo.daily.temperature_2m_min[idx]);
        return `
          <div class="forecast-day">
            <strong style="text-transform:capitalize;">${dayName}</strong>
            <div style="font-size:1.1rem; font-weight:800; margin:0.25rem 0;">${maxT}°C</div>
            <span style="color:var(--text-muted); font-size:0.78rem;">Mín ${minT}°C</span>
          </div>
        `;
      })
      .join('');

    weatherEl.innerHTML = `
      <div class="weather-current">
        <div>
          <strong>${resolvedPlace}</strong>
          <div class="weather-temp-big">${currentTemp}°C</div>
          <span>${conditionText}</span>
        </div>
        <div style="font-size:0.9rem; color:var(--text-muted);">
          <div><strong>Viento:</strong> ${windSpeed} km/h</div>
          <div><strong>Prob. de lluvia:</strong> ${rainProb}%</div>
          <div><strong>Coords:</strong> ${lat.toFixed(2)}, ${lon.toFixed(2)}</div>
        </div>
      </div>
      <h4 style="margin-top:1rem; font-size:0.95rem;">Pronóstico próximos días</h4>
      <div class="forecast-grid">${forecastHTML}</div>
    `;
  } catch (err) {
    weatherEl.innerHTML = '<p style="color:var(--danger);">No se pudo cargar el clima en este momento.</p>';
  }
}

// ==========================================
// SISTEMA DE FAVORITOS (LOCALSTORAGE)
// ==========================================
function toggleFavorite(code) {
  const existingIndex = state.favorites.findIndex((f) => f.code === code);

  if (existingIndex > -1) {
    const removed = state.favorites[existingIndex];
    state.favorites.splice(existingIndex, 1);
    showToast(`${removed.name} eliminado de favoritos`);
  } else {
    const country =
      state.countries.find((c) => c.code === code) ||
      state.filteredCountries.find((c) => c.code === code);
    if (!country) return;
    if (!state.favorites.some((f) => f.code === code)) {
      state.favorites.push(country);
      showToast(`${country.name} guardado en favoritos`, 'success');
    }
  }

  localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(state.favorites));
  updateBadges();
  renderFeatured();
  applyFilters();
  renderFavorites();

  if (state.selectedCountry && state.selectedCountry.code === code) {
    const detailBtn = document.getElementById('detail-fav-btn');
    if (detailBtn) {
      const isFav = state.favorites.some((f) => f.code === code);
      detailBtn.classList.toggle('saved', isFav);
      detailBtn.textContent = isFav ? '★ En tus favoritos' : '☆ Agregar a favoritos';
    }
  }
}

function renderFavorites() {
  const grid = document.getElementById('favorites-grid');
  if (state.favorites.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <p>Aún no has guardado destinos favoritos.</p>
        <button class="btn btn-primary" style="margin-top:0.85rem;" onclick="switchView('explorar')">Explorar destinos</button>
      </div>
    `;
    return;
  }
  grid.innerHTML = state.favorites.map(createCountryCardHTML).join('');
}

// ==========================================
// FORMULARIO DE PLANIFICACIÓN E ITINERARIO (LOCALSTORAGE)
// ==========================================
function planTripTo(destinationLabel) {
  switchView('itinerario');
  const destInput = document.getElementById('trip-destination');
  destInput.value = destinationLabel;
  document.getElementById('trip-name').focus();
}

function validateTripForm() {
  let isValid = true;

  const fields = [
    { id: 'trip-name', errId: 'err-trip-name', msg: 'Ingresa un nombre para tu viaje.' },
    { id: 'trip-destination', errId: 'err-trip-destination', msg: 'Selecciona o escribe un destino.' },
    { id: 'trip-start', errId: 'err-trip-start', msg: 'Selecciona la fecha de inicio.' },
    { id: 'trip-end', errId: 'err-trip-end', msg: 'Selecciona la fecha de finalización.' },
    { id: 'trip-travelers', errId: 'err-trip-travelers', msg: 'Debe haber al menos 1 viajero.' },
    { id: 'trip-budget', errId: 'err-trip-budget', msg: 'Ingresa un presupuesto válido mayor a 0.' }
  ];

  fields.forEach(({ id, errId, msg }) => {
    const input = document.getElementById(id);
    const errEl = document.getElementById(errId);
    input.classList.remove('invalid');
    errEl.textContent = '';

    if (!input.value.trim()) {
      input.classList.add('invalid');
      errEl.textContent = msg;
      isValid = false;
    }
  });

  const travelers = Number(document.getElementById('trip-travelers').value);
  if (travelers < 1) {
    document.getElementById('trip-travelers').classList.add('invalid');
    document.getElementById('err-trip-travelers').textContent = 'Mínimo 1 viajero.';
    isValid = false;
  }

  const budget = Number(document.getElementById('trip-budget').value);
  if (budget <= 0) {
    document.getElementById('trip-budget').classList.add('invalid');
    document.getElementById('err-trip-budget').textContent = 'El presupuesto debe ser mayor a 0.';
    isValid = false;
  }

  const startVal = document.getElementById('trip-start').value;
  const endVal = document.getElementById('trip-end').value;
  if (startVal && endVal && new Date(endVal) < new Date(startVal)) {
    document.getElementById('trip-end').classList.add('invalid');
    document.getElementById('err-trip-end').textContent = 'La fecha final no puede ser anterior a la de inicio.';
    isValid = false;
  }

  return isValid;
}

function handleCreateTrip(e) {
  e.preventDefault();
  if (!validateTripForm()) {
    showToast('Revisa los campos marcados en el formulario', 'error');
    return;
  }

  const start = document.getElementById('trip-start').value;
  const end = document.getElementById('trip-end').value;
  const diffTime = Math.abs(new Date(end) - new Date(start));
  const totalDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);

  const newTrip = {
    id: Date.now().toString(),
    name: document.getElementById('trip-name').value.trim(),
    destination: document.getElementById('trip-destination').value.trim(),
    startDate: start,
    endDate: end,
    daysCount: Math.min(totalDays, 30),
    travelers: Number(document.getElementById('trip-travelers').value),
    budget: Number(document.getElementById('trip-budget').value),
    notes: document.getElementById('trip-notes').value.trim(),
    activities: [
      { id: 'act-1', day: 1, text: `Llegada a ${document.getElementById('trip-destination').value.trim()}` }
    ]
  };

  state.trips.unshift(newTrip);
  saveTrips();
  e.target.reset();
  document.getElementById('trip-travelers').value = 1;
  showToast('¡Plan de viaje creado exitosamente!', 'success');
}

function addActivityToTrip(e, tripId) {
  e.preventDefault();
  const form = e.target;
  const day = Number(form.querySelector('select').value);
  const input = form.querySelector('input');
  const text = input.value.trim();

  if (!text) return;

  const trip = state.trips.find((t) => t.id === tripId);
  if (!trip) return;

  trip.activities.push({
    id: Date.now().toString(),
    day,
    text
  });

  saveTrips();
  showToast('Actividad agregada al itinerario', 'success');
}

function removeActivity(tripId, activityId) {
  const trip = state.trips.find((t) => t.id === tripId);
  if (!trip) return;
  trip.activities = trip.activities.filter((a) => a.id !== activityId);
  saveTrips();
}

function deleteTrip(tripId) {
  state.trips = state.trips.filter((t) => t.id !== tripId);
  saveTrips();
  showToast('Itinerario eliminado');
}

function saveTrips() {
  localStorage.setItem(STORAGE_KEYS.TRIPS, JSON.stringify(state.trips));
  updateBadges();
  renderTrips();
}

function renderTrips() {
  const container = document.getElementById('trips-container');
  if (state.trips.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No tienes itinerarios creados todavía. Completa el formulario de la izquierda para empezar.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = state.trips
    .map((trip) => {
      const dayOptions = Array.from(
        { length: trip.daysCount },
        (_, i) => `<option value="${i + 1}">Día ${i + 1}</option>`
      ).join('');

      const grouped = {};
      trip.activities.forEach((act) => {
        if (!grouped[act.day]) grouped[act.day] = [];
        grouped[act.day].push(act);
      });

      const daysHTML = Object.keys(grouped)
        .sort((a, b) => Number(a) - Number(b))
        .map(
          (dayNum) => `
          <div class="day-group">
            <h4>Día ${dayNum}</h4>
            <ul class="activity-list">
              ${grouped[dayNum]
                .map(
                  (act) => `
                <li class="activity-item">
                  <span>• ${act.text}</span>
                  <button class="btn-icon-del" title="Eliminar actividad" onclick="removeActivity('${trip.id}', '${act.id}')">✕</button>
                </li>
              `
                )
                .join('')}
            </ul>
          </div>
        `
        )
        .join('');

      return `
        <article class="trip-card">
          <div class="trip-header">
            <div>
              <h4>${trip.name} — <span style="color:var(--primary);">${trip.destination}</span></h4>
              <div class="trip-badges">
                <span class="trip-pill">📅 ${trip.startDate} al ${trip.endDate} (${trip.daysCount} días)</span>
                <span class="trip-pill">👥 ${trip.travelers} viajero(s)</span>
                <span class="trip-pill">💰 $${trip.budget.toLocaleString('es-ES')} USD</span>
              </div>
              ${trip.notes ? `<p style="font-size:0.88rem; color:var(--text-muted); margin-top:0.5rem;">📝 ${trip.notes}</p>` : ''}
            </div>
            <button class="btn btn-outline btn-danger-outline btn-sm" onclick="deleteTrip('${trip.id}')">Eliminar</button>
          </div>

          <form class="activity-form" onsubmit="addActivityToTrip(event, '${trip.id}')">
            <select aria-label="Seleccionar día">${dayOptions}</select>
            <input type="text" placeholder="Ej. Visitar el centro histórico, museo..." required />
            <button type="submit" class="btn btn-primary btn-sm">+ Agregar actividad</button>
          </form>

          ${daysHTML || '<p style="font-size:0.88rem; color:var(--text-muted);">Agrega actividades por día para organizar tu ruta.</p>'}
        </article>
      `;
    })
    .join('');
}

// ==========================================
// EVENTOS GLOBALES Y UTILIDADES
// ==========================================
function setupEventListeners() {
  document.getElementById('hero-search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const val = document.getElementById('hero-search-input').value;
    state.searchQuery = val;
    document.getElementById('explore-search').value = val;
    switchView('explorar');
    applyFilters();
  });

  document.getElementById('explore-search').addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      applyFilters();
    }, 250);
  });

  document.querySelectorAll('.filter-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      state.selectedRegion = chip.getAttribute('data-region');
      applyFilters();
    });
  });

  document.getElementById('btn-back-explore').addEventListener('click', () => {
    switchView('explorar');
  });

  document.getElementById('btn-clear-favorites').addEventListener('click', () => {
    if (state.favorites.length === 0) return;
    state.favorites = [];
    localStorage.removeItem(STORAGE_KEYS.FAVORITES);
    updateBadges();
    renderFavorites();
    renderFeatured();
    applyFilters();
    showToast('Lista de favoritos vaciada');
  });

  document.getElementById('trip-form').addEventListener('submit', handleCreateTrip);
}

function updateBadges() {
  document.getElementById('fav-count').textContent = state.favorites.length;
  document.getElementById('trip-count').textContent = state.trips.length;
}

function translateRegion(region) {
  const map = {
    Americas: 'América',
    Europe: 'Europa',
    Asia: 'Asia',
    Africa: 'África',
    Oceania: 'Oceanía',
    Antarctic: 'Antártida'
  };
  return map[region] || region;
}

function showToast(message, type = 'default') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}