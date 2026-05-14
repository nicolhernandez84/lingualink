const API = window.location.origin.startsWith('http')
  ? window.location.origin
  : 'http://localhost:3000';

/* =========================
   HELPERS BASE
========================= */

const $ = (id) => document.getElementById(id);

function go(path) {
  window.location.href = path;
}

function saveSession(user) {
  localStorage.setItem('lingualink_user', JSON.stringify(user));
}

function getSession() {
  try {
    return JSON.parse(localStorage.getItem('lingualink_user'));
  } catch {
    return null;
  }
}

function logout() {
  localStorage.removeItem('lingualink_user');
  go('/fronted/pages/login.html');
}

function protect(role = null) {
  const user = getSession();

  if (!user) {
    go('/fronted/pages/login.html');
    return false;
  }

  if (role && user.role !== role) {
    go('/fronted/pages/login.html');
    return false;
  }

  return true;
}

async function requestJSON(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();

  let json;

  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('La ruta devolvió HTML o texto. Abre el proyecto desde http://localhost:3000');
  }

  if (!response.ok) {
    throw new Error(json.message || 'Error en la solicitud');
  }

  return json;
}

function safeText(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function parseWords(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [english, ...rest] = line.split('|');

      return {
        english: String(english || '').trim(),
        spanish: rest.join('|').trim()
      };
    })
    .filter(word => word.english && word.spanish);
}

function wordsToText(words = []) {
  return words
    .map(word => `${word.english}|${word.spanish}`)
    .join('\n');
}

function shuffle(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

function hideWord(word) {
  const text = String(word || '');

  if (text.length <= 2) {
    return text[0] + '_'.repeat(Math.max(text.length - 1, 0));
  }

  return text
    .split('')
    .map((letter, index) => {
      const isLetter = /[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(letter);

      if (!isLetter) return letter;
      if (index === 0 || index === text.length - 1) return letter;

      return '_';
    })
    .join('');
}

function getVocabularyGradient(color) {
  const value = String(color || '').trim();

  const colors = {
    blue: { 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af' },
    pink: { 500: '#ec4899', 600: '#db2777', 700: '#be185d' },
    red: { 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c' },
    rose: { 500: '#f43f5e', 600: '#e11d48', 700: '#be123c' },
    purple: { 500: '#a855f7', 600: '#9333ea', 700: '#7e22ce' },
    violet: { 500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9' },
    green: { 500: '#22c55e', 600: '#16a34a', 700: '#15803d' },
    emerald: { 500: '#10b981', 600: '#059669', 700: '#047857' },
    orange: { 500: '#f97316', 600: '#ea580c', 700: '#c2410c' },
    amber: { 500: '#f59e0b', 600: '#d97706', 700: '#b45309' },
    lime: { 500: '#84cc16', 600: '#65a30d', 700: '#4d7c0f' }
  };

  const fromMatch = value.match(/from-([a-z]+)-(\d+)/);
  const toMatch = value.match(/to-([a-z]+)-(\d+)/);

  if (fromMatch && toMatch) {
    const fromHex = colors[fromMatch[1]]?.[fromMatch[2]];
    const toHex = colors[toMatch[1]]?.[toMatch[2]];

    if (fromHex && toHex) {
      return `linear-gradient(135deg, ${fromHex}, ${toHex})`;
    }
  }

  return 'linear-gradient(135deg, #2563eb, #1e40af)';
}

function getCurrentLevel() {
  const params = new URLSearchParams(window.location.search);
  return (params.get('level') || localStorage.getItem('selected_level') || 'A1').toUpperCase();
}

/* =========================
   TOAST Y MODAL
========================= */

function showToast(message, type = 'success') {
  const oldToast = $('custom-toast');
  if (oldToast) oldToast.remove();

  const toast = document.createElement('div');
  toast.id = 'custom-toast';

  const styles = type === 'success'
    ? 'bg-green-50 text-green-700 border-green-200'
    : 'bg-red-50 text-red-700 border-red-200';

  toast.className = `fixed top-6 right-6 z-[9999] px-6 py-4 rounded-2xl shadow-xl border font-bold ${styles}`;
  toast.textContent = message;

  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 2500);
}

function showConfirmModal({
  title = 'Confirmar acción',
  message = '¿Seguro que deseas continuar?',
  confirmText = 'Aceptar',
  cancelText = 'Cancelar'
} = {}) {
  return new Promise((resolve) => {
    const oldModal = $('custom-confirm-modal');
    if (oldModal) oldModal.remove();

    const modal = document.createElement('div');
    modal.id = 'custom-confirm-modal';
    modal.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 px-4';

    modal.innerHTML = `
      <div class="bg-white rounded-[28px] shadow-2xl max-w-md w-full p-8 border border-slate-100 animate-fade-in">
        <div class="w-16 h-16 rounded-3xl bg-red-50 flex items-center justify-center text-4xl mb-5">🗑️</div>
        <h2 id="confirm-title" class="text-2xl font-extrabold text-slate-900"></h2>
        <p id="confirm-message" class="text-slate-500 mt-3 leading-relaxed"></p>

        <div class="flex justify-end gap-3 mt-8">
          <button id="confirm-cancel" class="px-5 py-3 rounded-2xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 transition"></button>
          <button id="confirm-accept" class="px-5 py-3 rounded-2xl bg-red-500 text-white font-bold hover:bg-red-600 transition"></button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    $('confirm-title').textContent = title;
    $('confirm-message').textContent = message;
    $('confirm-cancel').textContent = cancelText;
    $('confirm-accept').textContent = confirmText;

    function close(value) {
      modal.remove();
      resolve(value);
    }

    $('confirm-cancel').onclick = () => close(false);
    $('confirm-accept').onclick = () => close(true);

    modal.addEventListener('click', (event) => {
      if (event.target === modal) close(false);
    });
  });
}

/* =========================
   LOGIN
========================= */

async function login() {
  const type_document = $('type_document').value.trim();
  const number_document = $('number_document').value.trim();
  const password = $('password').value.trim();
  const alertBox = $('login-alert');

  alertBox.classList.add('hidden');

  try {
    const result = await requestJSON(`${API}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type_document, number_document, password })
    });

    saveSession(result.user);

    if (result.user.role === 'teacher') {
      go('/fronted/pages/profesor.html');
      return;
    }

    if (result.user.role === 'student') {
      go('/fronted/pages/select-nivel.html');
      return;
    }

    throw new Error('Rol no reconocido.');
  } catch (error) {
    alertBox.textContent = error.message;
    alertBox.classList.remove('hidden');
  }
}

/* =========================
   ESTUDIANTE: NIVEL
========================= */

function selectLevel(level) {
  localStorage.setItem('selected_level', level);
  go(`/fronted/pages/level.html?level=${encodeURIComponent(level)}`);
}

function initStudentLevelDashboard() {
  if (!protect('student')) return;

  const level = getCurrentLevel();

  if ($('level-title')) $('level-title').textContent = `Nivel ${level}`;
  if ($('level-description')) $('level-description').textContent = 'Elige qué deseas hacer en este nivel.';

  showLevelSection('vocabularies');
}

function showLevelSection(section) {
  if (!protect('student')) return;

  const level = getCurrentLevel();

  const sections = {
    vocabularies: 'student-vocab-section',
    activities: 'student-activities-section',
    progress: 'student-progress-section'
  };

  const buttons = {
    vocabularies: 'student-btn-vocabularies',
    activities: 'student-btn-activities',
    progress: 'student-btn-progress'
  };

  Object.keys(sections).forEach(key => {
    $(sections[key])?.classList.add('hidden');
    $(buttons[key])?.classList.remove('border-blue-500', 'bg-blue-50', 'ring-4', 'ring-blue-100');
  });

  $(sections[section])?.classList.remove('hidden');
  $(buttons[section])?.classList.add('border-blue-500', 'bg-blue-50', 'ring-4', 'ring-blue-100');

  const descriptions = {
    vocabularies: 'Consulta los vocabularios disponibles para este nivel.',
    activities: 'Realiza las actividades publicadas por tu profesor.',
    progress: `Visualiza tu progreso en el nivel ${level}.`
  };

  if ($('level-title')) $('level-title').textContent = `Nivel ${level}`;
  if ($('level-description')) $('level-description').textContent = descriptions[section];

  if (section === 'vocabularies') loadLevelPage();
  if (section === 'activities') loadStudentActivitiesByLevel();
  if (section === 'progress') loadStudentProgressGeneral();
}

async function loadLevelPage() {
  if (!protect('student')) return;

  const level = getCurrentLevel();
  const grid = $('vocab-grid');

  if (!grid) return;

  grid.innerHTML = `<div class="card p-8 text-center text-slate-500 md:col-span-2 lg:col-span-3">Cargando vocabularios...</div>`;

  try {
    const result = await requestJSON(`${API}/api/vocabularies?level=${encodeURIComponent(level)}`);
    const vocabularies = result.data || [];

    if (!vocabularies.length) {
      grid.innerHTML = emptyCard('📚', 'No hay vocabularios disponibles', 'Cuando tu profesor cree vocabularios para este nivel, aparecerán aquí.');
      return;
    }

    grid.innerHTML = vocabularies.map(vocabularyStudentCard).join('');
  } catch (error) {
    grid.innerHTML = errorCard(error.message);
  }
}


function vocabularyStudentCard(v) {
  return `
    <button onclick="go('/fronted/pages/vocab.html?id=${v.id}')" class="vocab-card text-left rounded-[28px] overflow-hidden bg-white border border-slate-200 shadow-sm">
      <div class="h-32 flex items-center justify-center text-6xl" style="background: ${getVocabularyGradient(v.color)};">
        ${safeText(v.emoji || '📚')}
      </div>

      <div class="p-6">
        <div class="flex justify-between items-start gap-3">
          <h3 class="text-2xl font-bold text-slate-900">${safeText(v.name)}</h3>
          <span class="px-3 py-1 rounded-full bg-blue-50 text-blue-700 font-bold text-sm">${safeText(v.level)}</span>
        </div>

        <p class="mt-2 text-slate-500">${safeText(v.theme || '')}</p>
        <p class="mt-5 text-sm font-semibold text-slate-600">${v.word_count || 0} palabras</p>
      </div>
    </button>
  `;
}

async function loadVocabularyDetail() {
  if (!protect('student')) return;

  const id = new URLSearchParams(window.location.search).get('id');
  const box = $('words-box');

  if (!box) return;

  if (!id) {
    box.innerHTML = errorCard('No se recibió el ID del vocabulario.');
    return;
  }

  try {
    const result = await requestJSON(`${API}/api/vocabulary/${id}`);
    const vocabulary = result.data;

    if ($('vocab-title')) {
      $('vocab-title').textContent = vocabulary.name || 'Vocabulario';
    }

    if ($('vocab-theme')) {
      $('vocab-theme').textContent = vocabulary.theme || '';
    }

    if ($('vocab-emoji')) {
      $('vocab-emoji').textContent = vocabulary.emoji || '📚';
    }

    const words = vocabulary.words || [];

    if (!words.length) {
      box.innerHTML = `
        <div class="card p-8 text-center text-slate-500">
          Este vocabulario no tiene palabras registradas.
        </div>
      `;
      return;
    }

    box.innerHTML = words.map(word => {
      const audioName = word.audio
        ? String(word.audio).replace('uploads/', '')
        : '';

      return `
        <div class="card p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p class="text-2xl font-bold text-slate-900">
              ${safeText(word.english)}
            </p>

            <p class="text-slate-500">
              ${safeText(word.spanish)}
            </p>
          </div>

          ${
            audioName
              ? `<button onclick="new Audio('/uploads/${audioName}').play()" class="btn-blue px-5 py-3 rounded-2xl font-semibold">Escuchar</button>`
              : ''
          }
        </div>
      `;
    }).join('');

  } catch (error) {
    box.innerHTML = errorCard(error.message);
  }
}

/* =========================
   PROFESOR: CREAR VOCABULARIO
========================= */

async function createTeacherVocabulary() {
  if (!protect('teacher')) return;

  const alertBox = $('teacher-alert');

  const name = $('name').value.trim();
  const level = $('level').value.trim().toUpperCase();
  const theme = $('theme').value.trim();
  const emoji = $('emoji').value.trim() || '📚';
  const color = $('color').value.trim() || 'from-blue-600 to-blue-800';
  const words = parseWords($('words').value);

  alertBox.className = 'mt-6 p-5 rounded-2xl font-bold';

  if (!name || !level || !theme) {
    alertBox.textContent = 'Completa nombre, nivel y tema.';
    alertBox.classList.add('bg-red-50', 'text-red-600');
    return;
  }

  if (!words.length) {
    alertBox.textContent = 'Agrega palabras con este formato: apple|manzana';
    alertBox.classList.add('bg-red-50', 'text-red-600');
    return;
  }

  try {
    await requestJSON(`${API}/api/vocabulary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        level,
        theme,
        emoji,
        color,
        words
      })
    });

    alertBox.textContent = 'Vocabulario creado correctamente.';
    alertBox.classList.add('bg-green-50', 'text-green-700');

    setTimeout(() => {
      go('/fronted/pages/profesor-ver-vocabularios.html');
    }, 700);

  } catch (error) {
    alertBox.textContent = error.message;
    alertBox.classList.add('bg-red-50', 'text-red-600');
  }
}

async function loadTeacherVocabularies() {
  if (!protect('teacher')) return;

  const grid = $('teacher-vocab-grid');
  const count = $('teacher-count');

  if (!grid) return;

  grid.innerHTML = '<p class="text-slate-500">Cargando vocabularios...</p>';

  try {
    const result = await requestJSON(`${API}/api/teacher/vocabularies`);
    const vocabularies = result.data || [];

    if (count) {
      count.textContent = `${vocabularies.length} vocabularios`;
    }

    if (!vocabularies.length) {
      grid.innerHTML = `
        <div class="card p-8 text-center text-slate-500 md:col-span-2 lg:col-span-3">
          No hay vocabularios registrados.
        </div>
      `;
      return;
    }

    grid.innerHTML = vocabularies.map(teacherVocabularyCard).join('');

  } catch (error) {
    grid.innerHTML = errorCard(error.message);
  }
}

function teacherVocabularyCard(v) {
  return `
    <div class="vocab-card rounded-[28px] overflow-hidden bg-white border border-slate-200 shadow-sm">
      <div 
        class="h-32 flex items-center justify-center text-6xl" 
        style="background: ${getVocabularyGradient(v.color)};"
      >
        ${safeText(v.emoji || '📚')}
      </div>

      <div class="p-6">
        <div class="flex justify-between items-start gap-3">
          <h3 class="text-2xl font-bold text-slate-900">
            ${safeText(v.name)}
          </h3>

          <span class="px-3 py-1 rounded-full bg-blue-50 text-blue-700 font-bold text-sm">
            ${safeText(v.level)}
          </span>
        </div>

        <p class="mt-2 text-slate-500">
          ${safeText(v.theme || '')}
        </p>

        <p class="mt-5 text-sm font-semibold text-slate-600">
          ${v.word_count || 0} palabras
        </p>

        <div class="flex flex-wrap gap-3 mt-6">
          <button onclick="viewTeacherVocabulary(${v.id})" class="px-4 py-3 rounded-2xl bg-slate-100 font-bold">
            Ver
          </button>

          <button onclick="openEditVocabulary(${v.id})" class="btn-blue px-4 py-3 rounded-2xl font-bold">
            Modificar
          </button>

          <button onclick="deleteTeacherVocabulary(${v.id})" class="px-4 py-3 rounded-2xl bg-red-50 text-red-600 font-bold">
            Eliminar
          </button>
        </div>
      </div>
    </div>
  `;
}

async function viewTeacherVocabulary(id) {
  if (!protect('teacher')) return;

  const grid = $('teacher-vocab-grid') || $('teacher-modify-grid');

  try {
    const result = await requestJSON(`${API}/api/vocabulary/${id}`);
    const v = result.data;

    grid.innerHTML = `
      <div class="card p-8 md:col-span-2 lg:col-span-3">
        <h2 class="text-4xl font-extrabold">
          ${safeText(v.emoji || '📚')} ${safeText(v.name)}
        </h2>

        <p class="text-slate-500 mt-2">
          ${safeText(v.theme || '')}
        </p>

        <p class="font-bold text-blue-700 mt-2">
          Nivel ${safeText(v.level)}
        </p>

        <div class="grid md:grid-cols-2 gap-4 mt-8">
          ${(v.words || []).map(word => `
            <div class="p-5 rounded-2xl border border-slate-200 bg-white">
              <p class="text-xl font-bold">
                ${safeText(word.english)}
              </p>

              <p class="text-slate-500">
                ${safeText(word.spanish)}
              </p>
            </div>
          `).join('')}
        </div>

        <button 
          onclick="loadTeacherVocabularies()" 
          class="mt-8 px-6 py-4 rounded-2xl bg-slate-100 font-bold"
        >
          Volver
        </button>
      </div>
    `;

  } catch (error) {
    grid.innerHTML = errorCard(error.message);
  }
}

async function openEditVocabulary(id) {
  if (!protect('teacher')) return;

  const grid = $('teacher-vocab-grid') || $('teacher-modify-grid');

  try {
    const result = await requestJSON(`${API}/api/vocabulary/${id}`);
    const v = result.data;

    grid.innerHTML = `
      <div class="card p-8 md:col-span-2 lg:col-span-3">
        <h2 class="text-4xl font-extrabold">
          Editar vocabulario
        </h2>

        <div class="grid md:grid-cols-2 gap-5 mt-8">
          <input 
            id="edit-name" 
            class="input" 
            value="${safeText(v.name || '')}" 
            placeholder="Nombre"
          >

          <input 
            id="edit-level" 
            class="input" 
            value="${safeText(v.level || '')}" 
            placeholder="Nivel"
          >

          <input 
            id="edit-theme" 
            class="input" 
            value="${safeText(v.theme || '')}" 
            placeholder="Tema"
          >

          <input 
            id="edit-emoji" 
            class="input" 
            value="${safeText(v.emoji || '📚')}" 
            placeholder="Emoji"
          >

          <input 
            id="edit-color" 
            class="input md:col-span-2" 
            value="${safeText(v.color || 'from-blue-600 to-blue-800')}" 
            placeholder="Color Tailwind"
          >

          <textarea 
            id="edit-words" 
            class="input md:col-span-2 min-h-[260px]" 
            placeholder="apple|manzana"
          >${safeText(wordsToText(v.words || []))}</textarea>
        </div>

        <div class="flex flex-wrap gap-4 mt-6">
          <button 
            onclick="updateTeacherVocabulary(${v.id})" 
            class="btn-blue px-6 py-4 rounded-2xl font-bold"
          >
            Guardar cambios
          </button>

          <button 
            onclick="loadTeacherVocabularies()" 
            class="px-6 py-4 rounded-2xl bg-slate-100 font-bold"
          >
            Cancelar
          </button>
        </div>

        <div id="edit-alert" class="hidden"></div>
      </div>
    `;

  } catch (error) {
    grid.innerHTML = errorCard(error.message);
  }
}

async function updateTeacherVocabulary(id) {
  if (!protect('teacher')) return;

  const alertBox = $('edit-alert');

  const name = $('edit-name').value.trim();
  const level = $('edit-level').value.trim().toUpperCase();
  const theme = $('edit-theme').value.trim();
  const emoji = $('edit-emoji').value.trim() || '📚';
  const color = $('edit-color').value.trim() || 'from-blue-600 to-blue-800';
  const words = parseWords($('edit-words').value);

  alertBox.className = 'mt-6 p-5 rounded-2xl font-bold';

  if (!name || !level || !theme) {
    alertBox.textContent = 'Completa nombre, nivel y tema.';
    alertBox.classList.add('bg-red-50', 'text-red-600');
    return;
  }

  if (!words.length) {
    alertBox.textContent = 'Agrega al menos una palabra.';
    alertBox.classList.add('bg-red-50', 'text-red-600');
    return;
  }

  try {
    await requestJSON(`${API}/api/vocabulary/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        level,
        theme,
        emoji,
        color,
        words
      })
    });

    alertBox.textContent = 'Vocabulario actualizado correctamente.';
    alertBox.classList.add('bg-green-50', 'text-green-700');

    setTimeout(() => {
      loadTeacherVocabularies();
    }, 700);

  } catch (error) {
    alertBox.textContent = error.message;
    alertBox.classList.add('bg-red-50', 'text-red-600');
  }
}

async function deleteTeacherVocabulary(id) {
  if (!protect('teacher')) return;

  const confirmar = await showConfirmModal({
    title: 'Eliminar vocabulario',
    message: '¿Seguro que deseas eliminar este vocabulario? También dejará de aparecer para el estudiante.',
    confirmText: 'Sí, eliminar',
    cancelText: 'Cancelar'
  });

  if (!confirmar) return;

  try {
    await requestJSON(`${API}/api/vocabulary/${id}`, {
      method: 'DELETE'
    });

    showToast('Vocabulario eliminado correctamente.', 'success');

    if ($('teacher-vocab-grid')) {
      loadTeacherVocabularies();
    }

    if ($('teacher-modify-grid')) {
      loadTeacherModifyList();
    }

  } catch (error) {
    showToast(error.message, 'error');
  }
}



function publishedActivityCard(activity) {
  const isComplete = activity.activity_type === 'complete';


  return `
    <div class="${isComplete ? 'activity-published-complete' : 'activity-published-matching'} rounded-[28px] p-6">
      <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div class="flex items-start gap-5">
          <div class="w-16 h-16 rounded-3xl flex items-center justify-center text-4xl ${isComplete ? 'activity-icon-complete' : 'activity-icon-matching'}">
            ${isComplete ? '📝' : '🔗'}
          </div>


          <div>
            <div class="flex flex-wrap items-center gap-3">
              <h3 class="text-2xl font-extrabold text-slate-900">${safeText(activity.title)}</h3>
              <span class="px-4 py-2 rounded-full text-sm font-bold ${isComplete ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}">
                ${isComplete ? 'Completar' : 'Relacionar'}
              </span>
            </div>


            <p class="text-slate-500 mt-2">
              Vocabulario: <strong>${safeText(activity.vocabulary_name)}</strong> · Nivel ${safeText(activity.level)}
            </p>


            <p class="text-slate-500 mt-1">${safeText(activity.instructions || '')}</p>
          </div>
        </div>


        <button onclick="deletePublishedActivity(${activity.id}, '${activity.activity_type}')" class="activity-delete-btn px-6 py-4 rounded-2xl font-bold">
          Eliminar
        </button>
      </div>
    </div>
  `;
}




async function deletePublishedActivity(activityId, type = '') {
  if (!protect('teacher')) return;


  const confirmDelete = await showConfirmModal({
    title: 'Eliminar actividad',
    message: '¿Seguro que deseas eliminar esta actividad? Ya no aparecerá para los estudiantes.',
    confirmText: 'Sí, eliminar',
    cancelText: 'Cancelar'
  });


  if (!confirmDelete) return;


  try {
    await requestJSON(`${API}/api/activities/${activityId}`, { method: 'DELETE' });


    showToast('Actividad eliminada correctamente.', 'success');
    loadTeacherPublishedActivities(type || null);
  } catch (error) {
    showToast(error.message, 'error');
  }
}
  async function createMatchingActivity(vocabularyId) {
  protect('teacher');

  const grid = $('teacher-matching-grid');

  try {
    const result = await requestJSON(`${API}/api/vocabulary/${vocabularyId}`);
    const vocabulary = result.data;
    const words = vocabulary.words || [];

    if (!words.length) {
      grid.innerHTML = `
        <div class="card p-8 text-center text-slate-500 md:col-span-2 lg:col-span-3">
          Este vocabulario no tiene palabras para crear la actividad.
          <br>
          <button onclick="loadTeacherMatchingPage()" class="mt-6 px-6 py-4 rounded-2xl bg-slate-100 font-bold">
            Volver
          </button>
        </div>
      `;
      return;
    }

    const spanishOptions = shuffle(words.map(word => word.spanish));

    grid.innerHTML = `
      <div class="card p-8 md:col-span-2 lg:col-span-3">
        <div class="flex justify-between items-start gap-5 mb-8">
          <div>
            <div class="text-6xl">${vocabulary.emoji || '📚'}</div>

            <h2 class="text-4xl font-extrabold mt-3">
              Crear actividad relacionar
            </h2>

            <p class="text-slate-500 mt-2">
              Vocabulario: <strong>${vocabulary.name}</strong> · Nivel ${vocabulary.level}
            </p>
          </div>

          <button onclick="loadTeacherMatchingPage()" class="px-5 py-3 rounded-2xl bg-slate-100 font-bold">
            Volver
          </button>
        </div>

        <div class="p-6 rounded-3xl bg-purple-50 border border-purple-100 mb-8">
          <h3 class="text-2xl font-extrabold text-purple-700">
            Vista previa para el estudiante
          </h3>

          <p class="text-slate-600 mt-2">
            El estudiante deberá relacionar cada palabra en inglés con su traducción en español.
          </p>
        </div>

        <div class="grid gap-5">
          ${words.map(word => `
            <div class="p-5 rounded-2xl border border-slate-200 bg-white grid md:grid-cols-2 gap-4 items-center">
              <div>
                <p class="text-sm font-bold text-slate-400 mb-2">
                  Palabra en inglés
                </p>

                <p class="text-2xl font-extrabold text-slate-900">
                  ${word.english}
                </p>

                <p class="text-sm text-slate-500 mt-2">
                  Respuesta esperada: <strong>${word.spanish}</strong>
                </p>
              </div>

              <select class="input w-full" disabled>
                <option>Opciones para el estudiante</option>
                ${spanishOptions.map(option => `
                  <option>${option}</option>
                `).join('')}
              </select>
            </div>
          `).join('')}
        </div>

        <div class="flex flex-wrap gap-4 mt-8">
          <button onclick="publishProfessorActivity(${vocabulary.id}, 'matching')" class="btn-blue px-6 py-4 rounded-2xl font-bold">
            Publicar actividad
          </button>

          <button onclick="loadTeacherMatchingPage()" class="px-6 py-4 rounded-2xl bg-slate-100 font-bold">
            Volver a vocabularios
          </button>
        </div>

        <div id="publish-alert" class="hidden"></div>
      </div>
    `;

  } catch (error) {
    grid.innerHTML = `
      <div class="card p-8 text-red-600 md:col-span-2 lg:col-span-3">
        ${error.message}
      </div>
    `;
  }
}


/* =========================
   ESTUDIANTE: ACTIVIDADES
========================= */

async function loadStudentActivitiesByLevel() {
  if (!protect('student')) return;

  const grid = $('student-activities-grid');
  const level = getCurrentLevel();

  if (!grid) return;

  grid.innerHTML = `
    <div class="card p-8 text-center text-slate-500 md:col-span-2 lg:col-span-3">
      Cargando actividades...
    </div>
  `;

  try {
    const result = await requestJSON(`${API}/api/activities?level=${encodeURIComponent(level)}`);
    const activities = result.data || [];

    if (!activities.length) {
      grid.innerHTML = emptyCard(
        '🧩',
        'No hay actividades publicadas',
        'Cuando tu profesor publique actividades para este nivel, aparecerán aquí.'
      );
      return;
    }

    grid.innerHTML = activities.map(studentActivityCard).join('');

  } catch (error) {
    grid.innerHTML = errorCard(error.message);
  }
}

function studentActivityCard(activity) {
  const isComplete = activity.activity_type === 'complete';
  const label = isComplete ? 'Completar' : 'Relacionar';

  return `
    <div class="vocab-card rounded-[28px] overflow-hidden bg-white border border-slate-200 shadow-sm">
      <div 
        class="h-32 flex items-center justify-center text-6xl" 
        style="background: ${getVocabularyGradient(activity.color)};"
      >
        ${isComplete ? '📝' : '🔗'}
      </div>

      <div class="p-6">
        <div class="flex justify-between items-start gap-3">
          <h3 class="text-2xl font-bold text-slate-900">
            ${safeText(activity.title)}
          </h3>

          <span class="px-3 py-1 rounded-full bg-blue-50 text-blue-700 font-bold text-sm">
            ${safeText(activity.level)}
          </span>
        </div>

        <p class="mt-2 text-slate-500">
          ${safeText(activity.instructions || '')}
        </p>

        <p class="mt-5 text-sm font-semibold text-slate-600">
          Vocabulario: ${safeText(activity.vocabulary_name)}
        </p>

        <div class="flex items-center justify-between gap-3 mt-6">
          <span class="px-4 py-2 rounded-2xl font-bold text-sm ${
            isComplete
              ? 'bg-blue-50 text-blue-700'
              : 'bg-purple-50 text-purple-700'
          }">
            ${label}
          </span>

          <button 
            onclick="go('/fronted/pages/student-activity.html?id=${activity.id}')"
            class="btn-blue px-5 py-3 rounded-2xl font-bold"
          >
            Realizar
          </button>
        </div>
      </div>
    </div>
  `;
}

async function loadStudentActivity() {
  if (!protect('student')) return;

  const box = $('student-activity-box');
  const activityId = new URLSearchParams(window.location.search).get('id');

  if (!box) return;

  if (!activityId) {
    box.innerHTML = errorCard('No se recibió el ID de la actividad.');
    return;
  }

  try {
    const result = await requestJSON(`${API}/api/activities/${activityId}`);
    const activity = result.data;
    const words = activity.words || [];

    window.currentStudentActivity = activity;

    if (activity.activity_type === 'complete') {
      renderStudentCompleteActivity(activity, words);
    } else {
      renderStudentMatchingActivity(activity, words);
    }

  } catch (error) {
    box.innerHTML = errorCard(error.message);
  }
}

function renderStudentCompleteActivity(activity, words) {
  window.studentCompleteAnswers = words.map(word => word.english);

  $('student-activity-box').innerHTML = `
    ${studentActivityHeader(activity, '📝')}

    <section class="grid md:grid-cols-2 gap-5">
      ${words.map((word, index) => `
        <div class="card p-6">
          <p class="text-sm font-bold text-slate-400 mb-2">
            Pista en español
          </p>

          <p class="text-xl font-bold text-slate-900 mb-4">
            ${safeText(word.spanish)}
          </p>

          <p class="text-3xl font-extrabold text-blue-700 tracking-widest mb-4">
            ${safeText(hideWord(word.english))}
          </p>

          <input 
            data-student-complete-index="${index}" 
            class="input w-full" 
            placeholder="Escribe la palabra completa"
          >
        </div>
      `).join('')}
    </section>

    <section class="flex flex-wrap gap-4 mt-8">
      <button 
        onclick="finishStudentCompleteActivity()" 
        class="btn-blue px-6 py-4 rounded-2xl font-bold"
      >
        Finalizar actividad
      </button>
    </section>

    <div id="student-result-box" class="hidden"></div>
  `;
}

function renderStudentMatchingActivity(activity, words) {
  const spanishOptions = shuffle(words.map(word => word.spanish));

  window.studentMatchingAnswers = words.map(word => word.spanish);

  $('student-activity-box').innerHTML = `
    ${studentActivityHeader(activity, '🔗')}

    <section class="grid gap-5">
      ${words.map((word, index) => `
        <div class="card p-6 grid md:grid-cols-2 gap-5 items-center">
          <div>
            <p class="text-sm font-bold text-slate-400 mb-2">
              Palabra en inglés
            </p>

            <p class="text-2xl font-extrabold text-slate-900">
              ${safeText(word.english)}
            </p>
          </div>

          <select data-student-match-index="${index}" class="input w-full">
            <option value="">Selecciona la traducción</option>

            ${spanishOptions.map(option => `
              <option value="${safeText(option)}">
                ${safeText(option)}
              </option>
            `).join('')}
          </select>
        </div>
      `).join('')}
    </section>

    <section class="flex flex-wrap gap-4 mt-8">
      <button 
        onclick="finishStudentMatchingActivity()" 
        class="btn-blue px-6 py-4 rounded-2xl font-bold"
      >
        Finalizar actividad
      </button>
    </section>

    <div id="student-result-box" class="hidden"></div>
  `;
}

function studentActivityHeader(activity, icon) {
  return `
    <section class="card p-10 mb-8">
      <div class="text-6xl">${icon}</div>

      <h1 class="text-4xl font-extrabold mt-4">
        ${safeText(activity.title)}
      </h1>

      <p class="text-slate-500 mt-3">
        ${safeText(activity.instructions || '')}
      </p>

      <p class="font-bold text-blue-700 mt-3">
        Vocabulario: ${safeText(activity.vocabulary_name)}
      </p>
    </section>
  `;
}

async function finishStudentCompleteActivity() {
  const inputs = document.querySelectorAll('[data-student-complete-index]');
  const answers = [];
  let score = 0;

  inputs.forEach(input => {
    const index = Number(input.dataset.studentCompleteIndex);
    const expected = String(window.studentCompleteAnswers[index] || '').trim().toLowerCase();
    const answer = input.value.trim().toLowerCase();
    const correct = answer === expected;

    if (correct) score++;

    markField(input, correct);

    answers.push({
      answer,
      expected,
      correct
    });
  });

  await saveStudentResult(score, inputs.length, answers);
}

async function finishStudentMatchingActivity() {
  const selects = document.querySelectorAll('[data-student-match-index]');
  const answers = [];
  let score = 0;

  selects.forEach(select => {
    const index = Number(select.dataset.studentMatchIndex);
    const expected = String(window.studentMatchingAnswers[index] || '').trim();
    const answer = select.value.trim();
    const correct = answer === expected;

    if (correct) score++;

    markField(select, correct);

    answers.push({
      answer,
      expected,
      correct
    });
  });

  await saveStudentResult(score, selects.length, answers);
}

function markField(field, correct) {
  field.classList.remove(
    'border-green-500',
    'border-red-500',
    'bg-green-50',
    'bg-red-50'
  );

  field.classList.add(correct ? 'border-green-500' : 'border-red-500');
  field.classList.add(correct ? 'bg-green-50' : 'bg-red-50');
}

async function saveStudentResult(score, totalQuestions, answers) {
  const user = getSession();
  const activity = window.currentStudentActivity;
  const resultBox = $('student-result-box');

  const studentId = user?.id || user?.user_id || user?.student_id;

  if (!studentId) {
    setInlineAlert(
      resultBox,
      'No se pudo identificar el estudiante en la sesión.',
      'error'
    );
    return;
  }

  const percentage = totalQuestions > 0
    ? Number(((score / totalQuestions) * 100).toFixed(2))
    : 0;

  setInlineAlert(resultBox, 'Guardando resultado...', 'info');

  try {
    await requestJSON(`${API}/api/activities/${activity.id}/result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: studentId,
        score,
        total_questions: totalQuestions,
        percentage,
        answers
      })
    });

    setInlineAlert(
      resultBox,
      `Resultado guardado correctamente. Puntaje: ${score} de ${totalQuestions}. Porcentaje: ${percentage}%.`,
      'success'
    );

  } catch (error) {
    setInlineAlert(resultBox, error.message, 'error');
  }
}

/* =========================
   ESTUDIANTE: PROGRESO
========================= */

async function loadStudentProgressGeneral() {
  if (!protect('student')) return;

  const box = $('student-progress-grid');
  const user = getSession();
  const studentId = user?.id || user?.user_id || user?.student_id;
  const currentLevel = getCurrentLevel();

  if (!box) return;

  if (!studentId) {
    box.innerHTML = errorCard('No se pudo identificar el estudiante en la sesión.');
    return;
  }

  box.innerHTML = `
    <div class="card p-8 text-center text-slate-500">
      Cargando progreso del nivel ${currentLevel}...
    </div>
  `;

  try {
    const result = await requestJSON(`${API}/api/activities/progress/${studentId}`);
    const progressList = result.data || [];

    const levelProgress = progressList.find(item => {
      return String(item.level || '').toUpperCase() === currentLevel;
    });

    if (!levelProgress) {
      box.innerHTML = emptyCard(
        '📈',
        `Todavía no tienes progreso en el nivel ${currentLevel}`,
        'Realiza actividades de completar o relacionar en este nivel para empezar a ver tu avance.'
      );
      return;
    }

    renderLevelProgress(box, levelProgress, currentLevel);

  } catch (error) {
    box.innerHTML = errorCard(error.message);
  }
}

function renderLevelProgress(box, progress, level) {
  const completed = Number(progress.completed_activities || 0);
  const score = Number(progress.total_score || 0);
  const questions = Number(progress.total_questions || 0);
  const percentage = Number(progress.progress_percentage || 0);

  box.innerHTML = `
    <div class="grid md:grid-cols-3 gap-6">
      ${metricCard(
        '✅',
        'Actividades realizadas',
        completed,
        `Actividades completadas en el nivel ${level}.`
      )}

      ${metricCard(
        '🎯',
        'Puntaje acumulado',
        `${score}/${questions}`,
        'Respuestas correctas en este nivel.'
      )}

      ${metricCard(
        '📊',
        'Progreso del nivel',
        `${percentage}%`,
        'Promedio entre completar y relacionar.'
      )}
    </div>

    <div class="card p-8 mt-8">
      <h3 class="text-2xl font-extrabold text-slate-900 mb-6">
        Progreso del nivel ${level}
      </h3>

      <div class="p-5 rounded-3xl border border-slate-200 bg-white">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h4 class="text-xl font-extrabold text-slate-900">
              Nivel ${level}
            </h4>

            <p class="text-slate-500 mt-1">
              ${completed} actividades realizadas · ${score}/${questions} respuestas correctas
            </p>
          </div>

          <div class="text-2xl font-extrabold text-blue-700">
            ${percentage}%
          </div>
        </div>

        <div class="w-full h-3 rounded-full bg-slate-100 mt-5 overflow-hidden">
          <div 
            class="h-full bg-blue-600 rounded-full" 
            style="width: ${percentage}%"
          ></div>
        </div>
      </div>
    </div>
  `;
}

function metricCard(icon, title, value, text) {
  return `
    <div class="card p-8">
      <div class="text-4xl mb-4">${icon}</div>

      <h3 class="text-xl font-extrabold text-slate-900">
        ${title}
      </h3>

      <p class="text-4xl font-extrabold text-blue-700 mt-4">
        ${value}
      </p>

      <p class="text-slate-500 mt-2">
        ${text}
      </p>
    </div>
  `;
}

/* =========================
   COMPONENTES PEQUEÑOS
========================= */

function setInlineAlert(element, message, type = 'success') {
  const styles = {
    success: 'mt-6 p-5 rounded-2xl font-bold bg-green-50 text-green-700',
    error: 'mt-6 p-5 rounded-2xl font-bold bg-red-50 text-red-600',
    info: 'mt-6 p-5 rounded-2xl font-bold bg-blue-50 text-blue-700'
  };

  element.className = styles[type] || styles.info;
  element.textContent = message;
}

function emptyCard(icon, title, text) {
  return `
    <div class="card p-10 text-center md:col-span-2 lg:col-span-3">
      <div class="text-5xl mb-4">${icon}</div>

      <h3 class="text-2xl font-extrabold text-slate-900">
        ${title}
      </h3>

      <p class="text-slate-500 mt-2">
        ${text}
      </p>
    </div>
  `;
}

function errorCard(message) {
  return `
    <div class="card p-8 text-red-600 md:col-span-2 lg:col-span-3">
      ${safeText(message)}
    </div>
  `;
}
