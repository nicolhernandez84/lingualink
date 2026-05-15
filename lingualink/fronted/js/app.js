const API = window.location.origin.startsWith('http')
  ? window.location.origin
  : 'http://localhost:3000';

function $(id) {
  return document.getElementById(id);
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
  window.location.href = '/fronted/pages/login.html';
}

function go(path) {
  window.location.href = path;
}

function protect(role = null) {
  const user = getSession();

  if (!user) {
    go('/fronted/pages/login.html');
    return;
  }

  if (role && user.role !== role) {
    go('/fronted/pages/login.html');
  }
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

function parseWords(text) {
  return String(text || '')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => {
      const parts = line.split('|').map(part => part.trim());

      const english = parts[0] || '';
      const spanish = parts[1] || '';
      const audio = '';

      return {
        english,
        spanish,
        audio
      };
    })
    .filter(word => word.english && word.spanish);
}

function wordsToText(words) {
  if (!words) return '';

  if (typeof words === 'string') {
    try {
      const parsed = JSON.parse(words);

      if (Array.isArray(parsed)) {
        return wordsToText(parsed);
      }

      return words;
    } catch (error) {
      return words;
    }
  }

  if (Array.isArray(words)) {
    return words
      .map(word => {
        const english = word.english || '';
        const spanish = word.spanish || '';
        const audio = normalizeAudioPath(word.audio || '');

        if (audio) {
          return `${english}|${spanish}|${audio}`;
        }

        return `${english}|${spanish}`;
      })
      .join('\n');
  }

  return '';
}


/* LOGIN */

async function login() {
  const type_document = $('type_document').value.trim();
  const number_document = $('number_document').value.trim();
  const password = $('password').value.trim();
  const alert = $('login-alert');

  alert.classList.add('hidden');

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
    alert.textContent = error.message;
    alert.classList.remove('hidden');
  }
}
function togglePassword() {
  const passwordInput = document.getElementById('password');
  const eyeIcon = document.getElementById('eye-icon');

  if (!passwordInput || !eyeIcon) return;

  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    eyeIcon.textContent = '👁️';
  } else {
    passwordInput.type = 'password';
    eyeIcon.textContent = '🙈';
  }
}
/* ESTUDIANTE */

function selectLevel(level) {
  localStorage.setItem('selected_level', level);
  go(`/fronted/pages/level.html?level=${encodeURIComponent(level)}`);
}

async function loadLevelPage() {
  protect('student');

  const params = new URLSearchParams(window.location.search);
  const level = params.get('level') || localStorage.getItem('selected_level') || 'A1';

  if ($('level-title')) {
    $('level-title').textContent = `Nivel ${level}`;
  }

  if ($('level-description')) {
    $('level-description').textContent = 'Check the vocabulary available for this level.';
  }

  const grid = $('vocab-grid');

  if (!grid) return;

  grid.innerHTML = `
    <div class="card p-8 text-center text-slate-500 md:col-span-2 lg:col-span-3">
      Loading vocabularies...
    </div>
  `;

  try {
    const result = await requestJSON(`${API}/api/vocabularies?level=${encodeURIComponent(level)}`);
    const vocabularies = result.data || [];

    if (!vocabularies.length) {
      grid.innerHTML = `
        <div class="card p-10 text-center md:col-span-2 lg:col-span-3">
          <div class="text-5xl mb-4">📚</div>

          <h3 class="text-2xl font-extrabold text-slate-900">
            No vocabularies available
          </h3>

          <p class="text-slate-500 mt-2">
            When your teacher creates vocabulary lists for this level, they will appear here.
          </p>
        </div>
      `;
      return;
    }

    grid.innerHTML = vocabularies.map(v => `
      <button 
        onclick="go('/fronted/pages/vocab.html?id=${v.id}')" 
        class="vocab-card text-left rounded-[28px] overflow-hidden bg-white border border-slate-200 shadow-sm"
      >
        <div 
          class="h-32 flex items-center justify-center text-6xl"
          style="background: ${getVocabularyGradient(v.color)};"
        >
          ${v.emoji || '📚'}
        </div>

        <div class="p-6">
          <div class="flex justify-between items-start gap-3">
            <h3 class="text-2xl font-bold text-slate-900">
              ${v.name}
            </h3>

            <span class="px-3 py-1 rounded-full bg-blue-50 text-blue-700 font-bold text-sm">
              ${v.level}
            </span>
          </div>

          <p class="mt-2 text-slate-500">
            ${v.theme || ''}
          </p>

          <p class="mt-5 text-sm font-semibold text-slate-600">
            ${v.word_count || 0} palabras
          </p>
        </div>
      </button>
    `).join('');

  } catch (error) {
    grid.innerHTML = `
      <div class="card p-8 text-red-600 md:col-span-2 lg:col-span-3">
        ${error.message}
      </div>
    `;
  }
}

async function loadVocabularyDetail() {
  protect('student');

  const id = new URLSearchParams(window.location.search).get('id');
  const box = $('words-box');

  try {
    const result = await requestJSON(`${API}/api/vocabulary/${id}`);
    const v = result.data;
    $('vocab-title').textContent = v.name;
    $('vocab-theme').textContent = v.theme || '';
    $('vocab-emoji').textContent = v.emoji || '📚';

    box.innerHTML = (v.words || []).map(w => {
      const audioName = w.audio ? String(w.audio).replace('uploads/', '') : '';

      return `
        <div class="card p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p class="text-2xl font-bold text-slate-900">${w.english}</p>
            <p class="text-slate-500">${w.spanish}</p>
          </div>

          ${
            audioName
              ? `<button onclick="new Audio('/uploads/${audioName}').play()" class="btn-blue px-5 py-3 rounded-2xl font-semibold">Listen</button>`
              : ''
          }
        </div>
      `;
    }).join('');

  } catch (error) {
    box.innerHTML = `<div class="card p-8 text-red-600">${error.message}</div>`;
  }
}

/* PROFESOR CREAR */

async function createTeacherVocabulary() {
  protect('teacher');

  const alert = $('teacher-alert');

  const name = $('name').value.trim();
  const level = $('level').value.trim().toUpperCase();
  const theme = $('theme').value.trim();
  const emoji = $('emoji').value.trim() || '📚';
  const color = $('color').value.trim() || 'from-blue-600 to-blue-800';

  const rows = document.querySelectorAll('.word-row');

  const words = [];
  const audioFiles = [];

  alert.className = 'mt-6 p-4 rounded-2xl font-bold';

  if (!name || !level || !theme) {
    alert.textContent = 'Complete name, level and theme.';
    alert.classList.add('bg-red-50', 'text-red-600');
    return;
  }

  rows.forEach(row => {
    const englishInput = row.querySelector('.word-english');
    const spanishInput = row.querySelector('.word-spanish');
    const audioInput = row.querySelector('.word-audio');

    const english = englishInput.value.trim();
    const spanish = spanishInput.value.trim();
    const file = audioInput.files[0];

    if (english && spanish) {
      if (!file) {
        throw new Error(`The audio for the word is missing: ${english}`);
      }

      if (!file.name.toLowerCase().endsWith('.mp3')) {
        throw new Error(`The audio of ${english} it must be.mp3`);
      }

      words.push({
        english,
        spanish,
        audio: ''
      });

      audioFiles.push(file);
    }
  });

  if (words.length === 0) {
    alert.textContent = 'Add at least one word with its translation and audio.';
    alert.classList.add('bg-red-50', 'text-red-600');
    return;
  }

  try {
    const formData = new FormData();

    formData.append('name', name);
    formData.append('level', level);
    formData.append('theme', theme);
    formData.append('emoji', emoji);
    formData.append('color', color);
    formData.append('words', JSON.stringify(words));

    audioFiles.forEach(file => {
      formData.append('audios', file);
    });

    const response = await fetch(`${API}/api/vocabulary`, {
      method: 'POST',
      body: formData
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Error creating vocabulary');
    }

    alert.textContent = 'Vocabulary created correctly.';
    alert.classList.add('bg-green-50', 'text-green-700');

    setTimeout(() => {
      go('/fronted/pages/profesor-ver-vocabularios.html');
    }, 700);

  } catch (error) {
    alert.textContent = error.message;
    alert.classList.add('bg-red-50', 'text-red-600');
  }
}
/* PROFESOR VER */

async function loadTeacherVocabularies() {
  protect('teacher');

  const grid = $('teacher-vocab-grid');
  const count = $('teacher-count');

  grid.innerHTML = '<p class="text-slate-500">Loading vocabularies...</p>';

  try {
    const result = await requestJSON(`${API}/api/teacher/vocabularies`);
    const vocabularies = result.data || [];

    if (count) {
      count.textContent = `${vocabularies.length} vocabularios`;
    }

    if (vocabularies.length === 0) {
      grid.innerHTML = `
        <div class="card p-8 text-center text-slate-500">
          There are no registered vocabularies.
        </div>
      `;
      return;
    }

    grid.innerHTML = vocabularies.map(v => teacherCard(v)).join('');

  } catch (error) {
    grid.innerHTML = `<div class="card p-8 text-red-600">${error.message}</div>`;
  }
}

function showToast(message, type = 'error') {
  const oldToast = document.getElementById('custom-toast');
  if (oldToast) oldToast.remove();

  const toast = document.createElement('div');
  toast.id = 'custom-toast';

  toast.className = `
    fixed top-6 right-6 z-[9999]
    px-6 py-4 rounded-2xl shadow-xl font-bold
    ${type === 'error' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-700 border border-green-100'}
  `;

  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}


function teacherCard(v) {
  return `
    <div class="vocab-card rounded-[28px] overflow-hidden bg-white border border-slate-200 shadow-sm">
      <div class="h-32 bg-gradient-to-br ${v.color || 'from-blue-600 to-blue-800'} flex items-center justify-center text-6xl">
        ${v.emoji || '📚'}
      </div>

      <div class="p-6">
        <div class="flex justify-between items-start gap-3">
          <h3 class="text-2xl font-bold text-slate-900">${v.name}</h3>
          <span class="px-3 py-1 rounded-full bg-blue-50 text-blue-700 font-bold text-sm">${v.level}</span>
        </div>

        <p class="mt-2 text-slate-500">${v.theme || ''}</p>

        <p class="mt-5 text-sm font-semibold text-slate-600">
          ${v.word_count || 0} palabras
        </p>

        <div class="flex flex-wrap gap-3 mt-6">
          <button onclick="viewTeacherVocabulary(${v.id})" class="px-4 py-3 rounded-2xl bg-slate-100 font-bold">
            View
          </button>

          <button onclick="openEditVocabulary(${v.id})" class="btn-blue px-4 py-3 rounded-2xl font-bold">
            Modify
          </button>

          <button onclick="deleteTeacherVocabulary(${v.id})" class="px-4 py-3 rounded-2xl bg-red-50 text-red-600 font-bold">
            Delete
          </button>
        </div>
      </div>
    </div>
  `;
}

function normalizeAudioPath(path) {
  if (!path) return '';

  let cleanPath = String(path)
    .replace(/\\/g, '/')
    .trim();

  cleanPath = cleanPath.replace('http://localhost:3000/', '');
  cleanPath = cleanPath.replace(`${API}/`, '');
  cleanPath = cleanPath.replace(/^\/+/, '');

  return cleanPath;
}

function normalizeAudioUrl(audioUrl) {
  if (!audioUrl) return '';

  const cleanUrl = String(audioUrl)
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .trim();

  if (cleanUrl.startsWith('http')) {
    return cleanUrl;
  }

  return `${API}/${cleanUrl}`;
}


function wordsToText(words) {
  if (!words) return '';

  if (typeof words === 'string') {
    try {
      const parsed = JSON.parse(words);

      if (Array.isArray(parsed)) {
        return wordsToText(parsed);
      }

      return words;
    } catch (error) {
      return words;
    }
  }

  if (Array.isArray(words)) {
    return words
      .map(word => {
        const english = word.english || '';
        const spanish = word.spanish || '';
        const audio = normalizeAudioPath(word.audio || '');

        if (audio) {
          return `${english}|${spanish}|${audio}`;
        }

        return `${english}|${spanish}`;
      })
      .join('\n');
  }

  return '';
}

function getAudioUrl(audio) {
  if (!audio) return '';

  const value = String(audio).trim().replace(/\\/g, '/');

  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }

  return `${API}/${value.replace(/^\/+/, '')}`;
}

async function playVocabularyAudio(audioUrl) {
  try {
    const finalUrl = getAudioUrl(audioUrl);

    if (!finalUrl) {
      alert('Esta palabra no tiene audio.');
      return;
    }

    console.log('Reproduciendo audio:', finalUrl);

    const audio = new Audio(finalUrl);
    audio.preload = 'auto';
    audio.volume = 1;

    await audio.play();
  } catch (error) {
    console.error('No se pudo reproducir el audio:', error);
    alert('No se pudo reproducir el audio. Revisa la consola o la URL del audio.');
  }
}

function playStudentAudio(encodedAudioUrl) {
  const audioUrl = decodeURIComponent(encodedAudioUrl);
  playVocabularyAudio(audioUrl);
}

async function viewTeacherVocabulary(id) {
  protect('teacher');

  const grid = $('teacher-vocab-grid') || $('teacher-modify-grid');

  try {
    const result = await requestJSON(`${API}/api/vocabulary/${id}`);
    const v = result.data;

    grid.innerHTML = `
      <div class="card p-8 md:col-span-2 lg:col-span-3">
        <h2 class="text-4xl font-extrabold">
          ${v.emoji || '📚'} ${v.name}
        </h2>

        <p class="text-slate-500 mt-2">${v.theme || ''}</p>
        <p class="font-bold text-blue-700 mt-2">Nivel ${v.level}</p>

        <div class="grid md:grid-cols-2 gap-4 mt-8">
          ${(v.words || []).map(w => {
            const audio = w.audio || '';

            return `
              <div class="p-5 rounded-2xl border border-slate-200 bg-white flex items-center justify-between gap-4">
                <div>
                  <p class="text-xl font-bold text-slate-900">${w.english}</p>
                  <p class="text-slate-500">${w.spanish}</p>
                </div>

                ${audio ? `
                  <button
                    type="button"
                    onclick="playVocabularyAudio('${audio}')"
                    class="w-12 h-12 rounded-full bg-blue-50 text-blue-700 font-bold flex items-center justify-center hover:bg-blue-100 transition"
                    title="Listen to audio"
                  >
                    🔊
                  </button>
                ` : `
                  <span class="text-slate-300 text-sm font-semibold">
                  No audio
                  </span>
                `}
              </div>
            `;
          }).join('')}
        </div>

        <button 
          type="button"
          onclick="loadTeacherVocabularies()" 
          class="mt-8 px-6 py-4 rounded-2xl bg-slate-100 font-bold"
        >
          Back
        </button>
      </div>
    `;

  } catch (error) {
    grid.innerHTML = `<div class="card p-8 text-red-600">${error.message}</div>`;
  }
}

/* PROFESOR MODIFICAR */

async function loadTeacherModifyList() {
  protect('teacher');

  const grid = $('teacher-modify-grid');

  grid.innerHTML = '<p class="text-slate-500">Cargando vocabularios...</p>';

  try {
    const result = await requestJSON(`${API}/api/teacher/vocabularies`);
    const vocabularies = result.data || [];

    if (vocabularies.length === 0) {
      grid.innerHTML = `
        <div class="card p-8 text-center text-slate-500">
         There are no registered vocabularies.
        </div>
      `;
      return;
    }

    grid.innerHTML = vocabularies.map(v => teacherCard(v)).join('');

  } catch (error) {
    grid.innerHTML = `<div class="card p-8 text-red-600">${error.message}</div>`;
  }
}

async function openEditVocabulary(id) {
  protect('teacher');

  const grid = $('teacher-modify-grid') || $('teacher-vocab-grid');

  try {
    const result = await requestJSON(`${API}/api/vocabulary/${id}`);
    const v = result.data;

    grid.innerHTML = `
      <div class="card p-8 md:col-span-2 lg:col-span-3">
        <h2 class="text-4xl font-extrabold">Editar vocabulario</h2>

        <div class="grid md:grid-cols-2 gap-5 mt-8">
          <input
            id="edit-name"
            class="input"
            value="${v.name || ''}"
            placeholder="Name"
          >

          <input
            id="edit-level"
            class="input"
            value="${v.level || ''}"
            placeholder="Level"
          >

          <input
            id="edit-theme"
            class="input"
            value="${v.theme || ''}"
            placeholder="Theme"
          >

          <input
            id="edit-emoji"
            class="input"
            value="${v.emoji || '📚'}"
            placeholder="Emoji"
          >

          <select id="edit-color" class="input md:col-span-2">
  <option value="from-blue-500 to-blue-700" ${v.color === 'from-blue-500 to-blue-700' ? 'selected' : ''}>🔵 Blue</option>
  <option value="from-sky-500 to-cyan-600" ${v.color === 'from-sky-500 to-cyan-600' ? 'selected' : ''}>💧 Sky blue</option>
  <option value="from-green-500 to-green-700" ${v.color === 'from-green-500 to-green-700' ? 'selected' : ''}>🟢 Green</option>
  <option value="from-emerald-500 to-teal-700" ${v.color === 'from-emerald-500 to-teal-700' ? 'selected' : ''}>🍃 Emerald</option>
  <option value="from-purple-500 to-purple-700" ${v.color === 'from-purple-500 to-purple-700' ? 'selected' : ''}>🟣 Purple </option>
  <option value="from-indigo-500 to-purple-700" ${v.color === 'from-indigo-500 to-purple-700' ? 'selected' : ''}>💜 Índigo</option>
  <option value="from-pink-500 to-pink-700" ${v.color === 'from-pink-500 to-pink-700' ? 'selected' : ''}>🌸 Pink</option>
  <option value="from-orange-500 to-orange-600" ${v.color === 'from-orange-500 to-orange-600' ? 'selected' : ''}>🟠 Orange</option>
  <option value="from-red-500 to-red-700" ${v.color === 'from-red-500 to-red-700' ? 'selected' : ''}>🔴 Red</option>
  <option value="from-yellow-400 to-yellow-600" ${v.color === 'from-yellow-400 to-yellow-600' ? 'selected' : ''}>🟡 Yellow</option>
</select>

          <div class="md:col-span-2">
            <label class="block mb-2 font-bold text-slate-700">
              Vocabulary words
            </label>

            <div id="edit-words-container" class="space-y-4">
              ${(v.words || []).map(word => `
                <div class="edit-word-row grid md:grid-cols-4 gap-4 items-center">
                  <input
                    class="input edit-word-english"
                    value="${word.english || ''}"
                    placeholder="English word"
                  >

                  <input
                    class="input edit-word-spanish"
                    value="${word.spanish || ''}"
                    placeholder="Spanish word"
                  >

                  <input
                    type="hidden"
                    class="edit-current-audio"
                    value="${word.audio || ''}"
                  >

                  <div>
                  <p class="text-xs font-bold text-slate-400 mb-1">
                  Current audio: ${word.audio? word.audio.split('/').pop(): 'No audio'}
                  </p>

                    <label class="flex flex-col items-center justify-center px-4 py-3 rounded-2xl bg-blue-600 text-white font-bold cursor-pointer hover:bg-blue-700 transition w-fit min-w-[160px]">
                    <span>Seleccionar MP3</span>
                    <span class="file-name text-xs mt-2 text-blue-100">
                     No file selected
                     </span>
                     
                     <input
                      class="hidden edit-word-audio"
                      type="file"
                       accept=".mp3,audio/mpeg"
                       onchange="
                       this.parentElement.querySelector('.file-name').textContent =
                       this.files[0] ? this.files[0].name : 'No file selected'
                       "
                        >
                        </label>
                  </div>
                </div>
              `).join('')}
            </div>

            <button
              type="button"
              onclick="addEditWordRow()"
              class="mt-4 px-5 py-3 rounded-2xl bg-slate-100 font-bold"
            >
              + Add word
            </button>

            <div class="form-help-box mt-4">
              Each word can keep its current audio or select a new one in format MP3.
            </div>
          </div>
        </div>

        <div class="flex flex-wrap gap-4 mt-6">
          <button
            id="btn-save-edit-vocabulary"
            type="button"
            class="btn-blue px-6 py-4 rounded-2xl font-bold"
          >
            Save changes
          </button>

          <button
            type="button"
            onclick="window.location.href='/fronted/pages/profesor-ver-vocabularios.html'"
            class="px-6 py-4 rounded-2xl bg-slate-100 font-bold"
          >
            Cancel
          </button>
        </div>

        <div id="edit-alert" class="hidden"></div>
      </div>
    `;

    const saveButton = $('btn-save-edit-vocabulary');

    if (saveButton) {
      saveButton.addEventListener('click', function () {
        updateTeacherVocabulary(id);
      });
    }

  } catch (error) {
    grid.innerHTML = `<div class="card p-8 text-red-600">${error.message}</div>`;
  }
}

async function updateTeacherVocabulary(id) {
  protect('teacher');

  const alertBox = $('edit-alert');

  alertBox.className = 'mt-6 p-4 rounded-2xl font-bold bg-blue-50 text-blue-700';
  alertBox.textContent = 'Attempting to save changes...';

  try {

    const name = $('edit-name').value.trim();
    const level = $('edit-level').value.trim().toUpperCase();
    const theme = $('edit-theme').value.trim();
    const emoji = $('edit-emoji').value.trim() || '📚';
    const color = $('edit-color').value.trim() || 'from-blue-600 to-blue-800';

    const rows = document.querySelectorAll('.edit-word-row');

    const words = [];
    const audioFiles = [];
    const audioIndexes = [];

    rows.forEach((row, index) => {

      const english = row.querySelector('.edit-word-english').value.trim();

      const spanish = row.querySelector('.edit-word-spanish').value.trim();

      const currentAudio = row.querySelector('.edit-current-audio').value.trim();

      const file = row.querySelector('.edit-word-audio').files[0];

      if (english && spanish) {

        if (file && !file.name.toLowerCase().endsWith('.mp3')) {
          throw new Error(`The audio to ${english} it must be MP3`);
        }

        words.push({
          english,
          spanish,
          audio: currentAudio
        });

        if (file) {
          audioFiles.push(file);
          audioIndexes.push(index);
        }
      }
    });

    if (!name || !level || !theme) {
      throw new Error('Complete name , level and theme.');
    }

    if (words.length === 0) {
      throw new Error('Add at least one word.');
    }

    const formData = new FormData();

    formData.append('name', name);
    formData.append('level', level);
    formData.append('theme', theme);
    formData.append('emoji', emoji);
    formData.append('color', color);

    formData.append('words', JSON.stringify(words));

    audioFiles.forEach((file, index) => {

      formData.append('audios', file);

      formData.append('audioIndex', audioIndexes[index]);
    });

    const response = await fetch(`${API}/api/vocabulary/${id}`, {
      method: 'PUT',
      body: formData
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Error updating vocabulary');
    }

    alertBox.className = 'mt-6 p-4 rounded-2xl font-bold bg-green-50 text-green-700';

    alertBox.textContent = 'Vocabulary correctly updated.';

    setTimeout(() => {
      window.location.href = '/fronted/pages/profesor-ver-vocabularios.html';
    }, 700);

  } catch (error) {

    console.error(error);

    alertBox.className = 'mt-6 p-4 rounded-2xl font-bold bg-red-50 text-red-600';

    alertBox.textContent = error.message || 'Could not update.';
  }
}

function showConfirmModal({
  title = 'Confirm action',
  message = 'Are you sure you want to continue?',
  confirmText = 'Accept',
  cancelText = 'Cancel'
} = {}) {
  return new Promise((resolve) => {
    const oldModal = document.getElementById('custom-confirm-modal');
    if (oldModal) oldModal.remove();

    const modal = document.createElement('div');
    modal.id = 'custom-confirm-modal';
    modal.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 px-4';

    modal.innerHTML = `
      <div class="bg-white rounded-[28px] shadow-2xl max-w-md w-full p-8 border border-slate-100 animate-fade-in">
        <div class="w-16 h-16 rounded-3xl bg-red-50 flex items-center justify-center text-4xl mb-5">
          🗑️
        </div>

        <h2 id="confirm-title" class="text-2xl font-extrabold text-slate-900"></h2>

        <p id="confirm-message" class="text-slate-500 mt-3 leading-relaxed"></p>

        <div class="flex justify-end gap-3 mt-8">
          <button 
            id="confirm-cancel" 
            class="px-5 py-3 rounded-2xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 transition"
          >
          </button>

          <button 
            id="confirm-accept" 
            class="px-5 py-3 rounded-2xl bg-red-500 text-white font-bold hover:bg-red-600 transition"
          >
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    document.getElementById('confirm-cancel').textContent = cancelText;
    document.getElementById('confirm-accept').textContent = confirmText;

    function close(value) {
      modal.remove();
      resolve(value);
    }

    document.getElementById('confirm-cancel').onclick = () => close(false);
    document.getElementById('confirm-accept').onclick = () => close(true);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) close(false);
    });
  });
}

async function deleteTeacherVocabulary(id) {
  protect('teacher');

  const confirmar = await showConfirmModal({
    title: 'Delete vocabulary',
    message: 'Are you sure you want to remove this vocabulary? It will be removed from the teachers panel and will also stop appearing for the student.',
    confirmText: 'yes,delete',
    cancelText: 'Cancel'
  });

  if (!confirmar) return;

  try {
    await requestJSON(`${API}/api/vocabulary/${id}`, {
      method: 'DELETE'
    });

    showToast('Vocabulary successfully removed.', 'success');

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

function addWordRow() {
  const container = $('words-container');

  const row = document.createElement('div');
  row.className = 'word-row grid md:grid-cols-3 gap-4';

  row.innerHTML = `
  <input class="input word-english" placeholder="English word">

  <input class="input word-spanish" placeholder="Spanish word">

  <label class="flex flex-col items-center justify-center px-5 py-3 rounded-2xl bg-blue-600 text-white font-bold cursor-pointer hover:bg-blue-700 transition w-fit min-w-[180px]">

  <span class="text-white">
    Select MP3
  </span>

  <span class="file-name text-xs mt-1 text-blue-100 font-medium max-w-[160px] truncate">
    No file selected
  </span>

  <input
    class="hidden word-audio"
    type="file"
    accept=".mp3,audio/mpeg"
    onchange="
      this.parentElement.querySelector('.file-name').textContent =
      this.files[0] ? this.files[0].name : 'No file selected'
    "
  >
</label>
`;

  container.appendChild(row);
}
function safeText(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function shuffleArray(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

function hideWord(word) {
  const text = String(word || '');

  if (text.length <= 2) {
    return text[0] + '_'.repeat(text.length - 1);
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

function addEditWordRow() {
  const container = $('edit-words-container');

  const row = document.createElement('div');
  row.className = 'edit-word-row grid md:grid-cols-4 gap-4 items-center';

  row.innerHTML = `
    <input
      class="input edit-word-english"
      placeholder="English word"
    >

    <input
      class="input edit-word-spanish"
      placeholder="Spanish word"
    >

    <input
      type="hidden"
      class="edit-current-audio"
      value=""
    >

    <div>
      <p class="text-xs font-bold text-slate-400 mb-1">
        New audio MP3
      </p>

       <label class="flex flex-col items-center justify-center px-4 py-3 rounded-2xl bg-blue-600 text-white font-bold cursor-pointer hover:bg-blue-700 transition w-fit min-w-[160px]">

  <span>Select MP3</span>

  <span class="file-name text-xs mt-2 text-blue-100">
    No file selected
  </span>

  <input
    class="hidden edit-word-audio"
    type="file"
    accept=".mp3,audio/mpeg"
    onchange="
      this.parentElement.querySelector('.file-name').textContent =
      this.files[0] ? this.files[0].name : 'No file selected'
    "
  >
</label>
    </div>
  `;

  container.appendChild(row);
}

/* ==============================
   ACTIVIDADES DEL PROFESOR
============================== */

function teacherActivityCard(vocabulary, type) {
  const isComplete = type === 'complete';

  const buttonText = isComplete
    ? 'Create complete activity'
    : 'Create relate activity';

  const functionName = isComplete
    ? `createCompleteActivity(${vocabulary.id})`
    : `createMatchingActivity(${vocabulary.id})`;

  return `
    <div class="vocab-card rounded-[28px] overflow-hidden bg-white border border-slate-200 shadow-sm">
      <div class="h-32 bg-gradient-to-br ${safeText(vocabulary.color || 'from-blue-600 to-blue-800')} flex items-center justify-center text-6xl">
        ${safeText(vocabulary.emoji || '📚')}
      </div>

      <div class="p-6">
        <div class="flex justify-between items-start gap-3">
          <h3 class="text-2xl font-bold text-slate-900">
            ${safeText(vocabulary.name)}
          </h3>

          <span class="px-3 py-1 rounded-full bg-blue-50 text-blue-700 font-bold text-sm">
            ${safeText(vocabulary.level)}
          </span>
        </div>

        <p class="mt-2 text-slate-500">
          ${safeText(vocabulary.theme || '')}
        </p>

        <p class="mt-5 text-sm font-semibold text-slate-600">
          ${vocabulary.word_count || 0} palabras
        </p>

        <button 
          onclick="${functionName}" 
          class="btn-blue px-5 py-3 rounded-2xl font-bold mt-6"
        >
          ${buttonText}
        </button>
      </div>
    </div>
  `;
}

async function loadTeacherCompletePage() {
  protect('teacher');

  const grid = $('teacher-complete-grid');

  grid.innerHTML = '<p class="text-slate-500">Cargando vocabularios...</p>';

  try {
    const result = await requestJSON(`${API}/api/teacher/vocabularies`);
    const vocabularies = result.data || [];

    if (!vocabularies.length) {
      grid.innerHTML = `
        <div class="card p-8 text-center text-slate-500">
          There are no vocabularies available to create activities.
        </div>
      `;
      return;
    }

    grid.innerHTML = vocabularies
      .map(vocabulary => teacherActivityCard(vocabulary, 'complete'))
      .join('');

  } catch (error) {
    grid.innerHTML = `
      <div class="card p-8 text-red-600">
        ${safeText(error.message)}
      </div>
    `;
  }
}

async function loadTeacherMatchingPage() {
  protect('teacher');

  const grid = $('teacher-matching-grid');

  grid.innerHTML = '<p class="text-slate-500">Cargando vocabularios...</p>';

  try {
    const result = await requestJSON(`${API}/api/teacher/vocabularies`);
    const vocabularies = result.data || [];

    if (!vocabularies.length) {
      grid.innerHTML = `
        <div class="card p-8 text-center text-slate-500">
          There are no vocabularies available to create activities.
        </div>
      `;
      return;
    }

    grid.innerHTML = vocabularies
      .map(vocabulary => teacherActivityCard(vocabulary, 'matching'))
      .join('');

  } catch (error) {
    grid.innerHTML = `
      <div class="card p-8 text-red-600">
        ${safeText(error.message)}
      </div>
    `;
  }
}

/* ==============================
   CREAR ACTIVIDAD COMPLETAR
============================== */

async function createCompleteActivity(vocabularyId) {
  protect('teacher');

  const grid = $('teacher-complete-grid');

  try {
    const result = await requestJSON(`${API}/api/vocabulary/${vocabularyId}`);
    const vocabulary = result.data;
    const words = vocabulary.words || [];

    if (!words.length) {
      grid.innerHTML = `
        <div class="card p-8 text-center text-slate-500 md:col-span-2 lg:col-span-3">
          There are no vocabularies available to create activities.
          <br>
          <button onclick="loadTeacherCompletePage()" class="mt-6 px-6 py-4 rounded-2xl bg-slate-100 font-bold">
            back
          </button>
        </div>
      `;
      return;
    }

    grid.innerHTML = `
      <div class="card p-8 md:col-span-2 lg:col-span-3">
        <div class="flex justify-between items-start gap-5 mb-8">
          <div>
            <div class="text-6xl">${vocabulary.emoji || '📚'}</div>
            <h2 class="text-4xl font-extrabold mt-3">
              Create complete activity
            </h2>
            <p class="text-slate-500 mt-2">
              Vocabulary: <strong>${vocabulary.name}</strong> · level ${vocabulary.level}
            </p>
          </div>

          <button onclick="loadTeacherCompletePage()" class="px-5 py-3 rounded-2xl bg-slate-100 font-bold">
            back
          </button>
        </div>

        <div class="p-6 rounded-3xl bg-blue-50 border border-blue-100 mb-8">
          <h3 class="text-2xl font-extrabold text-blue-700">Student preview</h3>
          <p class="text-slate-600 mt-2">
            The student will see a clue in Spanish and must complete the word in English.
          </p>
        </div>

        <div class="grid md:grid-cols-2 gap-5">
          ${words.map(word => `
            <div class="p-5 rounded-2xl border border-slate-200 bg-white">
              <p class="text-sm font-bold text-slate-400 mb-2">Spanish clue</p>

              <p class="text-xl font-bold text-slate-900 mb-4">
                ${word.spanish}
              </p>

              <p class="text-3xl font-extrabold text-blue-700 tracking-widest mb-4">
                ${hideWord(word.english)}
              </p>

              <p class="text-sm text-slate-500">
                Expected answer: <strong>${word.english}</strong>
              </p>
            </div>
          `).join('')}
        </div>

        <div class="flex flex-wrap gap-4 mt-8">
          <button onclick="publishProfessorActivity(${vocabulary.id}, 'complete')" class="btn-blue px-6 py-4 rounded-2xl font-bold">
           Publish activity
          </button>

          <button onclick="loadTeacherCompletePage()" class="px-6 py-4 rounded-2xl bg-slate-100 font-bold">
            Back to vocabularies
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

function checkCompleteActivity() {
  const inputs = document.querySelectorAll('[data-complete-index]');
  const resultBox = $('complete-result');

  let correct = 0;

  inputs.forEach(input => {
    const index = Number(input.dataset.completeIndex);
    const expected = String(window.completeActivityAnswers[index] || '').trim().toLowerCase();
    const answer = input.value.trim().toLowerCase();

    input.classList.remove('border-green-500', 'border-red-500', 'bg-green-50', 'bg-red-50');

    if (answer === expected) {
      correct++;
      input.classList.add('border-green-500', 'bg-green-50');
    } else {
      input.classList.add('border-red-500', 'bg-red-50');
    }
  });

  resultBox.className = 'mt-6 p-5 rounded-2xl font-bold bg-blue-50 text-blue-700';
  resultBox.textContent = `Result: ${correct} de ${inputs.length} correct answers.`;
}

/* ==============================
   CREAR ACTIVIDAD RELACIONAR
============================== */

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
          This vocabulary does not have words to create the activity.
          <br>
          <button onclick="loadTeacherMatchingPage()" class="mt-6 px-6 py-4 rounded-2xl bg-slate-100 font-bold">
            back
          </button>
        </div>
      `;
      return;
    }

    const spanishOptions = shuffleArray(words.map(word => word.spanish));

    grid.innerHTML = `
      <div class="card p-8 md:col-span-2 lg:col-span-3">
        <div class="flex justify-between items-start gap-5 mb-8">
          <div>
            <div class="text-6xl">${vocabulary.emoji || '📚'}</div>

            <h2 class="text-4xl font-extrabold mt-3">
              Create relate activity
            </h2>

            <p class="text-slate-500 mt-2">
              Vocabulary: <strong>${vocabulary.name}</strong> · level ${vocabulary.level}
            </p>
          </div>

          <button onclick="loadTeacherMatchingPage()" class="px-5 py-3 rounded-2xl bg-slate-100 font-bold">
            back
          </button>
        </div>

        <div class="p-6 rounded-3xl bg-purple-50 border border-purple-100 mb-8">
          <h3 class="text-2xl font-extrabold text-purple-700">
            Student preview
          </h3>

          <p class="text-slate-600 mt-2">
            The student must match each English word with its Spanish translation.
          </p>
        </div>

        <div class="grid gap-5">
          ${words.map(word => `
            <div class="p-5 rounded-2xl border border-slate-200 bg-white grid md:grid-cols-2 gap-4 items-center">
              <div>
                <p class="text-sm font-bold text-slate-400 mb-2">
                  English word
                </p>

                <p class="text-2xl font-extrabold text-slate-900">
                  ${word.english}
                </p>
              </div>

              <select class="input w-full">
                <option value="">Opciones para el estudiante</option>
                ${spanishOptions.map(option => `
                  <option value="${option}">
                    ${option}
                  </option>
                `).join('')}
              </select>
            </div>
          `).join('')}
        </div>

        <div class="flex flex-wrap gap-4 mt-8">
          <button onclick="publishProfessorActivity(${vocabulary.id}, 'matching')" class="btn-blue px-6 py-4 rounded-2xl font-bold">
            Publish activity
          </button>

          <button onclick="loadTeacherMatchingPage()" class="px-6 py-4 rounded-2xl bg-slate-100 font-bold">
            back to vocabularies
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

function checkMatchingActivity() {
  const selects = document.querySelectorAll('[data-match-index]');
  const resultBox = $('matching-result');

  let correct = 0;

  selects.forEach(select => {
    const index = Number(select.dataset.matchIndex);
    const expected = String(window.matchingActivityAnswers[index] || '').trim();
    const answer = select.value.trim();

    select.classList.remove('border-green-500', 'border-red-500', 'bg-green-50', 'bg-red-50');

    if (answer === expected) {
      correct++;
      select.classList.add('border-green-500', 'bg-green-50');
    } else {
      select.classList.add('border-red-500', 'bg-red-50');
    }
  });

  resultBox.className = 'mt-6 p-5 rounded-2xl font-bold bg-blue-50 text-blue-700';
  resultBox.textContent = `Result: ${correct} de ${selects.length} correct relationships.`;
}

async function publishProfessorActivity(vocabularyId, activityType) {
  protect('teacher');

  const alertBox = $('publish-alert');

  const title = activityType === 'complete'
    ? 'Complete activity'
    : 'Relate activity';

  const instructions = activityType === 'complete'
    ? 'Complete each word in English according to the clue in Spanish.'
    : 'Match each English word with its Spanish translation.';

  alertBox.className = 'mt-6 p-5 rounded-2xl font-bold bg-blue-50 text-blue-700';
  alertBox.textContent = 'Publishing activity...';

  try {
    const result = await requestJSON(`${API}/api/activities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vocabulary_id: vocabularyId,
        activity_type: activityType,
        title,
        instructions
      })
    });

    alertBox.className = 'mt-6 p-5 rounded-2xl font-bold bg-green-50 text-green-700';
    alertBox.textContent = result.message || 'Activity published successfully.';

    // Esto actualiza la lista inmediatamente sin salir de la página
    setTimeout(() => {
      loadTeacherPublishedActivities(activityType);
    }, 300);

  } catch (error) {
    alertBox.className = 'mt-6 p-5 rounded-2xl font-bold bg-red-50 text-red-600';
    alertBox.textContent = error.message;
  }
}

async function loadTeacherPublishedActivities(type = null) {
  protect('teacher');

  const box = $('teacher-published-activities');

  if (!box) return;

  box.innerHTML = `
    <div class="card p-8 text-center text-slate-500">
      Loading published activities...
    </div>
  `;

  try {
    const result = await requestJSON(`${API}/api/activities`);
    let activities = result.data || [];

    if (type) {
      activities = activities.filter(activity => activity.activity_type === type);
    }

    if (!activities.length) {
      box.innerHTML = `
        <div class="card p-10 text-center">
          <div class="text-5xl mb-4">🧩</div>

          <h3 class="text-2xl font-extrabold text-slate-900">
            There are no published activities yet
          </h3>

          <p class="text-slate-500 mt-2">
            When you post an activity, it will automatically appear here.
          </p>
        </div>
      `;
      return;
    }

    box.innerHTML = activities.map(activity => {
      const isComplete = activity.activity_type === 'complete';

      return `
        <div class="${
          isComplete ? 'activity-published-complete' : 'activity-published-matching'
        } rounded-[28px] p-6">

          <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">

            <div class="flex items-start gap-5">

              <div class="w-16 h-16 rounded-3xl flex items-center justify-center text-4xl ${
                isComplete ? 'activity-icon-complete' : 'activity-icon-matching'
              }">
                ${isComplete ? '📝' : '🔗'}
              </div>

              <div>
                <div class="flex flex-wrap items-center gap-3">
                  <h3 class="text-2xl font-extrabold text-slate-900">
                    ${activity.title}
                  </h3>

                  <span class="px-4 py-2 rounded-full text-sm font-bold ${
                    isComplete
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-purple-100 text-purple-700'
                  }">
                    ${isComplete ? 'Complete' : 'Relate'}
                  </span>
                </div>

                <p class="text-slate-500 mt-2">
                  Vocabulario: <strong>${activity.vocabulary_name}</strong> · Nivel ${activity.level}
                </p>

                <p class="text-slate-500 mt-1">
                  ${activity.instructions || ''}
                </p>
              </div>

            </div>

            <button 
              onclick="deletePublishedActivity(${activity.id}, '${activity.activity_type}')"
              class="activity-delete-btn px-6 py-4 rounded-2xl font-bold"
            >
              Delete
            </button>

          </div>

        </div>
      `;
    }).join('');

  } catch (error) {
    box.innerHTML = `
      <div class="card p-8 text-red-600">
        ${error.message}
      </div>
    `;
  }
}

async function deletePublishedActivity(activityId, type = '') {
  protect('teacher');

  let confirmar = true;

  if (typeof showConfirmModal === 'function') {
    confirmar = await showConfirmModal({
      title: 'Delete activity',
      message: 'Are you sure you want to delete this activity? It will no longer appear for students.',
      confirmText: 'yes, delete',
      cancelText: 'Cancel'
    });
  } else {
    confirmar = confirm('Are you sure you want to delete this activity?');
  }

  if (!confirmar) return;

  try {
    await requestJSON(`${API}/api/activities/${activityId}`, {
      method: 'DELETE'
    });

    if (typeof showToast === 'function') {
      showToast('Activity successfully removed.', 'success');
    } else {
      alert('Activity successfully removed.');
    }

    loadTeacherPublishedActivities(type || null);

  } catch (error) {
    if (typeof showToast === 'function') {
      showToast(error.message, 'error');
    } else {
      alert(error.message);
    }
  }
}

async function loadStudentActivitiesByLevel() {
  protect('student');

  const grid = $('student-activities-grid');

  if (!grid) return;

  const params = new URLSearchParams(window.location.search);
  const level = params.get('level') || localStorage.getItem('selected_level') || 'A1';

  grid.innerHTML = `
    <div class="card p-8 text-center text-slate-500 md:col-span-2 lg:col-span-3">
      Loading activities...
    </div>
  `;

  try {
    const result = await requestJSON(`${API}/api/activities?level=${encodeURIComponent(level)}`);
    const activities = result.data || [];

    if (!activities.length) {
      grid.innerHTML = `
        <div class="card p-10 text-center md:col-span-2 lg:col-span-3">
          <div class="text-5xl mb-4">🧩</div>

          <h3 class="text-2xl font-extrabold text-slate-900">
            There are no published activities
          </h3>

          <p class="text-slate-500 mt-2">
            When your teacher posts activities for this level, they will appear here.
          </p>
        </div>
      `;
      return;
    }

    grid.innerHTML = activities.map(activity => {
      const gradient = getVocabularyGradient(activity.color);

      return `
        <div class="vocab-card rounded-[28px] overflow-hidden bg-white border border-slate-200 shadow-sm">
          <div 
            class="h-32 flex items-center justify-center text-6xl"
            style="background: ${gradient};"
          >
            ${activity.activity_type === 'complete' ? '📝' : '🔗'}
          </div>

          <div class="p-6">
            <div class="flex justify-between items-start gap-3">
              <h3 class="text-2xl font-bold text-slate-900">
                ${activity.title}
              </h3>

              <span 
                class="px-3 py-1 rounded-full text-white font-bold text-sm shadow"
                style="background: ${gradient};"
              >
                ${activity.level}
              </span>
            </div>

            <p class="mt-2 text-slate-500">
              ${activity.instructions || ''}
            </p>

            <p class="mt-5 text-sm font-semibold text-slate-600">
              Vocabulario: ${activity.vocabulary_name}
            </p>

            <div class="flex items-center justify-between gap-3 mt-6">
              <span 
                class="px-4 py-2 rounded-2xl font-bold text-sm text-white shadow"
                style="background: ${gradient};"
              >
                ${activity.activity_type === 'complete' ? 'Completar' : 'Relacionar'}
              </span>

              <button 
                onclick="go('/fronted/pages/student-activity.html?id=${activity.id}')"
                class="px-5 py-3 rounded-2xl font-bold text-white shadow"
                style="background: ${gradient};"
              >
                Realize
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

  } catch (error) {
    grid.innerHTML = `
      <div class="card p-8 text-red-600 md:col-span-2 lg:col-span-3">
        ${error.message}
      </div>
    `;
  }
}

function hideStudentWord(word) {
  const text = String(word || '');

  if (text.length <= 2) {
    return text[0] + '_'.repeat(text.length - 1);
  }

  return text.split('').map((letter, index) => {
    if (index === 0 || index === text.length - 1) return letter;
    if (!/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(letter)) return letter;
    return '_';
  }).join('');
}

function shuffleStudentOptions(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

async function loadStudentActivity() {
  protect('student');

  const box = $('student-activity-box');
  const activityId = new URLSearchParams(window.location.search).get('id');

  if (!activityId) {
    box.innerHTML = '<div class="card p-8 text-red-600">No se recibió el ID de la actividad.</div>';
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
    box.innerHTML = `
      <div class="card p-8 text-red-600">
        ${error.message}
      </div>
    `;
  }
}

function renderStudentCompleteActivity(activity, words) {
  const box = $('student-activity-box');
  const gradient = getVocabularyGradient(activity.color);

  window.studentCompleteAnswers = words.map(word => word.english);

  box.innerHTML = `
    <div class="card p-8">
      <h1 class="text-3xl font-black text-slate-800 mb-3">
        ${activity.title}
      </h1>

      <p class="text-slate-500 mb-2">
        ${activity.instructions || ''}
      </p>

      <p class="font-bold text-blue-700 mb-8">
        Vocabulario: ${activity.vocabulary_name}
      </p>

      <div class="grid gap-5">
        ${words.map((word, index) => {
          const audio = String(word.audio || '').replace(/'/g, "\\'");

          return `
            <div class="p-5 rounded-2xl border border-slate-100 bg-white shadow-sm">
              <p class="text-sm font-bold text-slate-400 mb-1">
                Pista en español
              </p>

              <h3 class="text-2xl font-black text-slate-800 mb-3">
                ${word.spanish}
              </h3>

              ${
                word.audio
                  ? `
                    <button 
                      type="button"
                      onclick="playStudentAudio('${encodeURIComponent(word.audio || '')}')"
                      class="mb-4 px-4 py-2 rounded-xl bg-blue-50 text-blue-700 font-bold hover:bg-blue-100">
                      🔊 Escuchar audio
                    </button>
                  `
                  : `
                    <p class="mb-4 text-sm text-slate-400 font-bold">
                      Sin audio
                    </p>
                  `
              }

              <p class="text-slate-500 mb-3">
                Completa la palabra:
              </p>

              <p class="text-xl font-black text-slate-700 mb-3 tracking-widest">
                ${hideStudentWord(word.english)}
              </p>

              <input 
                data-student-complete-index="${index}"
                type="text"
                placeholder="Escribe la palabra en inglés"
                class="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-4 focus:ring-blue-100">
            </div>
          `;
        }).join('')}
      </div>

      <div id="student-result-box"></div>

      <div class="flex gap-4 mt-8">
        <button 
          onclick="finishStudentCompleteActivity()"
          class="px-6 py-3 rounded-2xl text-white font-black shadow-lg"
          style="background:${gradient}">
          End activity
        </button>

        <button 
          onclick="backFromStudentActivity()"
          class="px-6 py-3 rounded-2xl bg-slate-100 text-slate-700 font-black">
          back
        </button>
      </div>
    </div>
  `;
}

function renderStudentMatchingActivity(activity, words) {
  const box = $('student-activity-box');
  const gradient = getVocabularyGradient(activity.color);
  const spanishOptions = shuffleStudentOptions(words.map(word => word.spanish));

  window.studentMatchingAnswers = words.map(word => word.spanish);

  box.innerHTML = `
    <div class="card p-8">
      <h1 class="text-3xl font-black text-slate-800 mb-3">
        ${activity.title}
      </h1>

      <p class="text-slate-500 mb-2">
        ${activity.instructions || ''}
      </p>

      <p class="font-bold text-blue-700 mb-8">
        Vocabulario: ${activity.vocabulary_name}
      </p>

      <div class="grid gap-5">
        ${words.map((word, index) => {
          const audio = String(word.audio || '').replace(/'/g, "\\'");

          return `
            <div class="p-5 rounded-2xl border border-slate-100 bg-white shadow-sm">
              <p class="text-sm font-bold text-slate-400 mb-1">
                Palabra en inglés
              </p>

              <h3 class="text-2xl font-black text-slate-800 mb-3">
                ${word.english}
              </h3>

              ${
                word.audio
                  ? `
                    <button 
                      type="button"
                      onclick="playStudentAudio('${encodeURIComponent(word.audio || '')}')"
                      class="mb-4 px-4 py-2 rounded-xl bg-blue-50 text-blue-700 font-bold hover:bg-blue-100">
                      🔊 Escuchar audio
                    </button>
                  `
                  : `
                    <p class="mb-4 text-sm text-slate-400 font-bold">
                      Sin audio
                    </p>
                  `
              }

              <label class="block text-slate-500 font-bold mb-2">
                Selecciona la traducción
              </label>

              <select 
                data-student-match-index="${index}"
                class="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-4 focus:ring-blue-100">
                <option value="">Seleccionar respuesta</option>
                ${spanishOptions.map(option => `
                  <option value="${option}">
                    ${option}
                  </option>
                `).join('')}
              </select>
            </div>
          `;
        }).join('')}
      </div>

      <div id="student-result-box"></div>

      <div class="flex gap-4 mt-8">
        <button 
          onclick="finishStudentMatchingActivity()"
          class="px-6 py-3 rounded-2xl text-white font-black shadow-lg"
          style="background:${gradient}">
          Finalizar actividad
        </button>

        <button 
          onclick="backFromStudentActivity()"
          class="px-6 py-3 rounded-2xl bg-slate-100 text-slate-700 font-black">
          Volver
        </button>
      </div>
    </div>
  `;
}
function backFromStudentActivity() {
  const params = new URLSearchParams(window.location.search);
  const level = localStorage.getItem('selected_level') || 'A1';

  if (params.get('from') === 'progress') {
    localStorage.setItem('level_section', 'progress');
    localStorage.setItem('refresh_progress', 'true');

    window.location.replace(`/fronted/pages/level.html?level=${level}&t=${Date.now()}`);
    return;
  }

  history.back();
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

    input.classList.remove('border-green-500', 'border-red-500', 'bg-green-50', 'bg-red-50');
    input.classList.add(correct ? 'border-green-500' : 'border-red-500');
    input.classList.add(correct ? 'bg-green-50' : 'bg-red-50');

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

    select.classList.remove('border-green-500', 'border-red-500', 'bg-green-50', 'bg-red-50');
    select.classList.add(correct ? 'border-green-500' : 'border-red-500');
    select.classList.add(correct ? 'bg-green-50' : 'bg-red-50');

    answers.push({
      answer,
      expected,
      correct
    });
  });

  await saveStudentResult(score, selects.length, answers);
}

async function saveStudentResult(score, totalQuestions, answers) {
  const user = getSession();
  const activity = window.currentStudentActivity;
  const resultBox = $('student-result-box');

  const studentId = user.id || user.user_id || user.student_id;

  if (!studentId) {
    resultBox.className = 'mt-8 p-5 rounded-2xl font-bold bg-red-50 text-red-600';
    resultBox.textContent = 'No se pudo identificar el estudiante en la sesión.';
    return;
  }

  const percentage = totalQuestions > 0
    ? Number(((score / totalQuestions) * 100).toFixed(2))
    : 0;

  resultBox.className = 'mt-8 p-5 rounded-2xl font-bold bg-blue-50 text-blue-700';
  resultBox.textContent = 'Saving result...';

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

    resultBox.className = 'mt-8 p-5 rounded-2xl font-bold bg-green-50 text-green-700';
    resultBox.innerHTML = `
      Result saved successfully. 
      Score: ${score} de ${totalQuestions}. 
      Percentage: ${percentage}%.
    `;

  } catch (error) {
    resultBox.className = 'mt-8 p-5 rounded-2xl font-bold bg-red-50 text-red-600';
    resultBox.textContent = error.message;
  }
}

async function saveStudentActivityResult(activityId, score, totalQuestions, answers) {
  const user = getSession();

  if (!user) {
    go('/fronted/pages/login.html');
    return;
  }

  const studentId = user.id || user.user_id;

  const percentage = totalQuestions > 0
    ? Math.round((score / totalQuestions) * 100)
    : 0;

  await requestJSON(`${API}/api/activities/${activityId}/result`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      student_id: studentId,
      score,
      total_questions: totalQuestions,
      percentage,
      answers
    })
  });
}

function initStudentLevelDashboard() {
  protect('student');

  const params = new URLSearchParams(window.location.search);
  const level = params.get('level') || localStorage.getItem('selected_level') || 'A1';

  if ($('level-title')) {
    $('level-title').textContent = `Nivel ${level}`;
  }

  if ($('level-description')) {
    $('level-description').textContent = 'Choose what you want to do at this level.';
  }

  const savedSection = localStorage.getItem('level_section') || 'vocabularies';
localStorage.removeItem('level_section');

showLevelSection(savedSection);

if (localStorage.getItem('refresh_progress') === 'true') {
  localStorage.removeItem('refresh_progress');

  setTimeout(() => {
    showLevelSection('progress');
    loadStudentProgressGeneral();
  }, 300);
}
}

function showLevelSection(section) {
  protect('student');

  const params = new URLSearchParams(window.location.search);
  const level = params.get('level') || localStorage.getItem('selected_level') || 'A1';

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
    const panel = $(sections[key]);
    const button = $(buttons[key]);

    if (panel) {
      panel.classList.add('hidden');
    }

    if (button) {
      button.classList.remove('border-blue-500', 'bg-blue-50', 'ring-4', 'ring-blue-100');
    }
  });

  const activePanel = $(sections[section]);
  const activeButton = $(buttons[section]);

  if (activePanel) {
    activePanel.classList.remove('hidden');
  }

  if (activeButton) {
    activeButton.classList.add('border-blue-500', 'bg-blue-50', 'ring-4', 'ring-blue-100');
  }

  if ($('level-title')) {
    $('level-title').textContent = `Nivel ${level}`;
  }

  if ($('level-description')) {
    if (section === 'vocabularies') {
      $('level-description').textContent = 'Check the vocabulary available for this level.';
    }

    if (section === 'activities') {
      $('level-description').textContent = 'Complete the activities posted by your teacher.';
    }

    if (section === 'progress') {
      $('level-description').textContent = `View your progress at the level ${level}.`;
    }
  }

  if (section === 'vocabularies') {
    loadLevelPage();
  }

  if (section === 'activities') {
    loadStudentActivitiesByLevel();
  }

  if (section === 'progress') {
    loadStudentProgressGeneral();
  }
}

async function loadStudentProgressGeneral() {
  protect('student');

  const box = $('student-progress-grid');
  if (!box) return;

  const user = getSession();
  const studentId = user.id || user.user_id || user.student_id;

  const params = new URLSearchParams(window.location.search);
  const currentLevel = (params.get('level') || localStorage.getItem('selected_level') || 'A1').toUpperCase();

  box.innerHTML = `
    <div class="card p-8 text-center text-slate-500">
      Loading progress for level ${currentLevel}...
    </div>
  `;

  try {
    const result = await requestJSON(`${API}/api/activities/progress/${studentId}`);
    const progressList = result.data || [];

    const levelActivities = progressList.filter(item =>
      String(item.level || '').toUpperCase() === currentLevel
    );

    if (!levelActivities.length) {
      box.innerHTML = `
        <div class="card p-10 text-center">
          <div class="text-5xl mb-4">📈</div>

          <h3 class="text-2xl font-extrabold text-slate-900">
            You do not have progress in level ${currentLevel} yet
          </h3>

          <p class="text-slate-500 mt-2">
            Complete activities in this level to see your progress.
          </p>
        </div>
      `;
      return;
    }

    const totalScore = levelActivities.reduce((sum, item) => {
      return sum + Number(item.score || 0);
    }, 0);

    const totalQuestions = levelActivities.reduce((sum, item) => {
      return sum + Number(item.total_questions || 0);
    }, 0);

    const generalPercentage = totalQuestions > 0
      ? Math.round((totalScore / totalQuestions) * 100)
      : 0;

    box.innerHTML = `
      <div class="card p-8 mb-8">
        <h3 class="text-2xl font-extrabold text-slate-900">
          Level ${currentLevel} summary
        </h3>

        <div class="grid md:grid-cols-3 gap-6 mt-6">
          <div class="p-5 rounded-3xl bg-blue-50">
            <p class="text-slate-500 font-bold">
              Completed activities
            </p>

            <p class="text-4xl font-extrabold text-blue-700 mt-2">
              ${levelActivities.length}
            </p>
          </div>

          <div class="p-5 rounded-3xl bg-green-50">
            <p class="text-slate-500 font-bold">
              Total score
            </p>

            <p class="text-4xl font-extrabold text-green-700 mt-2">
              ${totalScore}/${totalQuestions}
            </p>
          </div>

          <div class="p-5 rounded-3xl bg-purple-50">
            <p class="text-slate-500 font-bold">
              General average
            </p>

            <p class="text-4xl font-extrabold text-purple-700 mt-2">
              ${generalPercentage}%
            </p>
          </div>
        </div>
      </div>

      <div class="grid md:grid-cols-2 gap-6">
        ${levelActivities.map(activity => {
  const gradient = getVocabularyGradient(activity.color);

  const typeText = activity.activity_type === 'complete'
    ? 'Complete'
    : 'Match';

  const icon = activity.activity_type === 'complete'
    ? '📝'
    : '🔗';

  const percentage = Number(activity.percentage || 0);

  let progressColor = 'linear-gradient(135deg, #ef4444, #b91c1c)';

  if (percentage >= 70 && percentage < 100) {
    progressColor = 'linear-gradient(135deg, #facc15, #ca8a04)';
  }

  if (percentage === 100) {
    progressColor = 'linear-gradient(135deg, #22c55e, #15803d)';
  }

  return `
    <div class="card p-6 overflow-hidden">
      <div 
        class="h-3 rounded-full mb-6"
        style="background: ${gradient};"
      ></div>

      <div class="flex items-start justify-between gap-4">
        <div>
          <div class="text-4xl mb-3">${icon}</div>

          <h4 class="text-2xl font-extrabold text-slate-900">
            ${activity.title}
          </h4>

          <p class="text-slate-500 mt-1">
            Vocabulary: <strong>${activity.vocabulary_name}</strong>
          </p>
        </div>

        <span
          class="px-4 py-2 rounded-2xl text-white font-bold text-sm shadow"
          style="background: ${gradient};"
        >
          ${typeText}
        </span>
      </div>

      <div class="grid grid-cols-2 gap-4 mt-6">
        <div class="p-4 rounded-2xl bg-slate-50">
          <p class="text-sm text-slate-500 font-bold">Score</p>
          <p class="text-3xl font-extrabold text-slate-900 mt-1">
            ${activity.score}/${activity.total_questions}
          </p>
        </div>

        <div class="p-4 rounded-2xl bg-slate-50">
          <p class="text-sm text-slate-500 font-bold">Percentage</p>
          <p class="text-3xl font-extrabold text-slate-900 mt-1">
            ${percentage}%
          </p>
        </div>
      </div>

      <div class="mt-5">
        <div class="flex justify-between mb-2">
          <span class="font-bold text-slate-600">Activity progress</span>
          <span class="font-bold text-slate-900">${percentage}%</span>
        </div>

        <div class="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
          <div
            class="h-full rounded-full"
            style="width: ${percentage}%; background: ${progressColor};"
          ></div>
        </div>
      </div>

      <button
        onclick="go('/fronted/pages/student-activity.html?id=${activity.activity_id}')"
        class="mt-6 px-5 py-3 rounded-2xl font-bold text-white shadow"
        style="background: ${gradient};"
      >
        🔁 Retry activity
      </button>
    </div>
  `;
}).join('')}
      </div>
    `;

  } catch (error) {
    box.innerHTML = `
      <div class="card p-8 text-red-600">
        ${error.message}
      </div>
    `;
  }
}

function initStudentLevelDashboard() {
  protect('student');

  const params = new URLSearchParams(window.location.search);
  const level = params.get('level') || localStorage.getItem('selected_level') || 'A1';

  if ($('level-title')) {
    $('level-title').textContent = `Nivel ${level}`;
  }

  if ($('level-description')) {
    $('level-description').textContent = 'Choose what you want to do at this level.';
  }

  showLevelSection('vocabularies');
}

function showLevelSection(section) {
  protect('student');

  const params = new URLSearchParams(window.location.search);
  const level = params.get('level') || localStorage.getItem('selected_level') || 'A1';

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
    const panel = $(sections[key]);
    const button = $(buttons[key]);

    if (panel) {
      panel.classList.add('hidden');
    }

    if (button) {
      button.classList.remove('border-blue-500', 'bg-blue-50', 'ring-4', 'ring-blue-100');
    }
  });

  const activePanel = $(sections[section]);
  const activeButton = $(buttons[section]);

  if (activePanel) {
    activePanel.classList.remove('hidden');
  }

  if (activeButton) {
    activeButton.classList.add('border-blue-500', 'bg-blue-50', 'ring-4', 'ring-blue-100');
  }

  if ($('level-title')) {
    $('level-title').textContent = `Nivel ${level}`;
  }

  if ($('level-description')) {
    if (section === 'vocabularies') {
      $('level-description').textContent = 'Check the vocabulary available for this level.';
    }

    if (section === 'activities') {
      $('level-description').textContent = 'Complete the activities posted by your teacher.';
    }

    if (section === 'progress') {
      $('level-description').textContent = `View your progress at the level ${level}.`;
    }
  }

  if (section === 'vocabularies') {
    loadLevelPage();
  }

  if (section === 'activities') {
    loadStudentActivitiesByLevel();
  }

  if (section === 'progress') {
    loadStudentProgressGeneral();
  }
}

function getVocabularyGradient(color) {
  const gradients = {
    'from-blue-500 to-blue-700': 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
    'from-sky-500 to-cyan-600': 'linear-gradient(135deg, #0ea5e9, #0891b2)',
    'from-green-500 to-green-700': 'linear-gradient(135deg, #22c55e, #15803d)',
    'from-emerald-500 to-teal-700': 'linear-gradient(135deg, #10b981, #0f766e)',
    'from-purple-500 to-purple-700': 'linear-gradient(135deg, #a855f7, #7e22ce)',
    'from-indigo-500 to-purple-700': 'linear-gradient(135deg, #6366f1, #7e22ce)',
    'from-pink-500 to-pink-700': 'linear-gradient(135deg, #ec4899, #be185d)',
    'from-orange-500 to-orange-600': 'linear-gradient(135deg, #f97316, #ea580c)',
    'from-red-500 to-red-700': 'linear-gradient(135deg, #ef4444, #b91c1c)',
    'from-yellow-400 to-yellow-600': 'linear-gradient(135deg, #facc15, #ca8a04)',

    // Colores viejos por si ya tenías vocabularios anteriores
    'from-blue-600 to-blue-800': 'linear-gradient(135deg, #2563eb, #1e40af)',
    'from-pink-500 to-red-500': 'linear-gradient(135deg, #ec4899, #ef4444)',
    'from-purple-600 to-violet-700': 'linear-gradient(135deg, #9333ea, #6d28d9)',
    'from-green-500 to-emerald-600': 'linear-gradient(135deg, #22c55e, #059669)',
    'from-amber-500 to-orange-600': 'linear-gradient(135deg, #f59e0b, #ea580c)',
    'from-lime-500 to-green-600': 'linear-gradient(135deg, #84cc16, #16a34a)',
    'from-red-500 to-rose-600': 'linear-gradient(135deg, #ef4444, #e11d48)'
  };

  return gradients[color] || 'linear-gradient(135deg, #2563eb, #1e40af)';
}