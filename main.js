import './style.css';
import * as Tone from 'tone';

// ===== Note & Key Configuration =====
// Piano range: A3 to E5
// White keys mapped to Q-] row, Black keys to number row

const NOTES_CONFIG = [
  // { note, type, keyboard key, MIDI number }
  { note: 'A3',  type: 'white', key: 'q',           midi: 57 },
  { note: 'A#3', type: 'black', key: '2',            midi: 58 },
  { note: 'B3',  type: 'white', key: 'w',            midi: 59 },
  { note: 'C4',  type: 'white', key: 'e',            midi: 60 },
  { note: 'C#4', type: 'black', key: '4',            midi: 61 },
  { note: 'D4',  type: 'white', key: 'r',            midi: 62 },
  { note: 'D#4', type: 'black', key: '5',            midi: 63 },
  { note: 'E4',  type: 'white', key: 't',            midi: 64 },
  { note: 'F4',  type: 'white', key: 'y',            midi: 65 },
  { note: 'F#4', type: 'black', key: '7',            midi: 66 },
  { note: 'G4',  type: 'white', key: 'u',            midi: 67 },
  { note: 'G#4', type: 'black', key: '8',            midi: 68 },
  { note: 'A4',  type: 'white', key: 'i',            midi: 69 },
  { note: 'A#4', type: 'black', key: '9',            midi: 70 },
  { note: 'B4',  type: 'white', key: 'o',            midi: 71 },
  { note: 'C5',  type: 'white', key: 'p',            midi: 72 },
  { note: 'C#5', type: 'black', key: '-',            midi: 73 },
  { note: 'D5',  type: 'white', key: '[',            midi: 74 },
  { note: 'D#5', type: 'black', key: '=',            midi: 75 },
  { note: 'E5',  type: 'white', key: ']',            midi: 76 },
];

// Map keyboard event.key to our config key
const KEY_MAP = {};
NOTES_CONFIG.forEach(cfg => {
  KEY_MAP[cfg.key.toLowerCase()] = cfg;
});

// ===== State =====
let sampler = null;
let isLoaded = false;
let sustainActive = false;
let labelsVisible = true;
let volume = -6; // dB, initial
let activeNotes = new Set();
let sustainedNotes = new Set();

// Recording state
let isRecording = false;
let recordedNotes = [];
let recordStartTime = 0;
let isPlaying = false;

// ===== Salamander Grand Piano Samples =====
// Using the official Tone.js Salamander Grand Piano samples
// File naming: C3.mp3, Ds3.mp3 (s for sharp), Fs3.mp3, A3.mp3 etc.
const SAMPLE_BASE_URL = 'https://tonejs.github.io/audio/salamander/';

// Map note names to sample file names
// Tone.js Sampler will pitch-shift/interpolate between provided samples
function getSamplerUrls() {
  return {
    'A3': 'A3.mp3',
    'A4': 'A4.mp3',
    'A5': 'A5.mp3',
    'C3': 'C3.mp3',
    'C4': 'C4.mp3',
    'C5': 'C5.mp3',
    'D#3': 'Ds3.mp3',
    'D#4': 'Ds4.mp3',
    'D#5': 'Ds5.mp3',
    'F#3': 'Fs3.mp3',
    'F#4': 'Fs4.mp3',
    'F#5': 'Fs5.mp3',
  };
}

// ===== Initialize Audio Engine =====
async function initAudio() {
  const loadingStatus = document.getElementById('loading-status');
  const progressFill = document.getElementById('progress-fill');

  loadingStatus.textContent = 'Loading piano samples...';
  progressFill.style.width = '20%';

  return new Promise((resolve, reject) => {
    sampler = new Tone.Sampler({
      urls: getSamplerUrls(),
      baseUrl: SAMPLE_BASE_URL,
      release: 1.5,
      onload: () => {
        progressFill.style.width = '90%';
        loadingStatus.textContent = 'Almost ready...';

        // Setup volume
        const vol = new Tone.Volume(volume).toDestination();
        sampler.connect(vol);

        // Store volume node for later adjustments
        window._volumeNode = vol;

        setTimeout(() => {
          progressFill.style.width = '100%';
          loadingStatus.textContent = 'Ready!';
          isLoaded = true;

          setTimeout(() => {
            const loadingScreen = document.getElementById('loading-screen');
            const mainApp = document.getElementById('main-app');
            loadingScreen.classList.add('fade-out');
            mainApp.classList.remove('hidden');

            setTimeout(() => {
              loadingScreen.style.display = 'none';
            }, 600);

            resolve();
          }, 400);
        }, 300);
      },
      onerror: (err) => {
        loadingStatus.textContent = 'Error loading samples. Please refresh.';
        console.error('Sampler error:', err);
        reject(err);
      }
    });
  });
}

// ===== Build Piano UI =====
function buildPiano() {
  const piano = document.getElementById('piano');
  piano.innerHTML = '';

  const whiteKeys = NOTES_CONFIG.filter(n => n.type === 'white');
  const blackKeys = NOTES_CONFIG.filter(n => n.type === 'black');

  // Create white keys first
  whiteKeys.forEach((cfg) => {
    const keyEl = document.createElement('div');
    keyEl.className = 'key white';
    keyEl.dataset.note = cfg.note;
    keyEl.dataset.key = cfg.key;
    keyEl.id = `key-${cfg.note.replace('#', 's')}`;
    keyEl.setAttribute('role', 'button');
    keyEl.setAttribute('aria-label', `Piano key ${cfg.note}`);

    keyEl.innerHTML = `
      <div class="key-glow"></div>
      <span class="key-note">${cfg.note}</span>
      <span class="key-shortcut">${cfg.key.toUpperCase()}</span>
    `;

    piano.appendChild(keyEl);
  });

  // Position black keys absolutely
  // We need to calculate positions based on white key positions
  const whiteKeyWidth = 56; // matches CSS

  blackKeys.forEach((cfg) => {
    const keyEl = document.createElement('div');
    keyEl.className = 'key black';
    keyEl.dataset.note = cfg.note;
    keyEl.dataset.key = cfg.key;
    keyEl.id = `key-${cfg.note.replace('#', 's')}`;
    keyEl.setAttribute('role', 'button');
    keyEl.setAttribute('aria-label', `Piano key ${cfg.note}`);

    keyEl.innerHTML = `
      <div class="key-glow-black"></div>
      <span class="key-note">${cfg.note}</span>
      <span class="key-shortcut">${cfg.key.toUpperCase()}</span>
    `;

    // Calculate position: find which white key this black key sits between
    const leftPos = getBlackKeyPosition(cfg.note, whiteKeys, whiteKeyWidth);
    keyEl.style.left = `${leftPos}px`;

    piano.appendChild(keyEl);
  });
}

function getBlackKeyPosition(blackNote, whiteKeys, keyWidth) {
  // Black keys sit between specific white keys
  // A#3 between A3 and B3
  // C#4 between C4 and D4
  // D#4 between D4 and E4
  // F#4 between F4 and G4
  // G#4 between G4 and A4
  // A#4 between A4 and B4
  // C#5 between C5 and D5
  // D#5 between D5 and E5

  const blackToLeftWhite = {
    'A#3': 'A3',
    'C#4': 'C4',
    'D#4': 'D4',
    'F#4': 'F4',
    'G#4': 'G4',
    'A#4': 'A4',
    'C#5': 'C5',
    'D#5': 'D5',
  };

  const leftWhiteNote = blackToLeftWhite[blackNote];
  if (!leftWhiteNote) return 0;

  const whiteIndex = whiteKeys.findIndex(w => w.note === leftWhiteNote);
  if (whiteIndex === -1) return 0;

  // Position at the boundary between the two white keys, offset to center
  return (whiteIndex + 1) * keyWidth - 18; // 18 = half black key width
}

// ===== Play / Stop Note =====
function playNote(note) {
  if (!isLoaded || !sampler) return;

  // Start audio context on first interaction
  if (Tone.context.state !== 'running') {
    Tone.start();
  }

  if (activeNotes.has(note)) return;

  activeNotes.add(note);
  sampler.triggerAttack(note, Tone.now());

  // Visual feedback
  const keyEl = document.getElementById(`key-${note.replace('#', 's')}`);
  if (keyEl) keyEl.classList.add('active');

  // Update now playing
  updateNowPlaying();

  // Recording
  if (isRecording) {
    recordedNotes.push({
      note,
      time: performance.now() - recordStartTime,
      type: 'attack'
    });
  }
}

function stopNote(note) {
  if (!activeNotes.has(note)) return;

  activeNotes.delete(note);

  if (sustainActive) {
    sustainedNotes.add(note);
  } else {
    sampler.triggerRelease(note, Tone.now());
  }

  // Visual feedback
  const keyEl = document.getElementById(`key-${note.replace('#', 's')}`);
  if (keyEl) keyEl.classList.remove('active');

  // Update now playing
  updateNowPlaying();

  // Recording
  if (isRecording) {
    recordedNotes.push({
      note,
      time: performance.now() - recordStartTime,
      type: 'release'
    });
  }
}

function releaseSustainedNotes() {
  sustainedNotes.forEach(note => {
    if (!activeNotes.has(note)) {
      sampler.triggerRelease(note, Tone.now());
    }
  });
  sustainedNotes.clear();
}

function updateNowPlaying() {
  const notesEl = document.getElementById('current-notes');
  if (activeNotes.size === 0) {
    notesEl.textContent = '—';
  } else {
    notesEl.textContent = Array.from(activeNotes).join(' · ');
  }
}

// ===== Keyboard Event Handlers =====
const pressedKeys = new Set();

function handleKeyDown(e) {
  if (e.repeat) return;

  const key = e.key.toLowerCase();

  // Sustain: Spacebar
  if (key === ' ') {
    e.preventDefault();
    if (!sustainActive) {
      sustainActive = true;
      const sustainBtn = document.getElementById('sustain-toggle');
      sustainBtn.classList.add('active');
      sustainBtn.querySelector('.toggle-label').textContent = 'ON';
    }
    return;
  }

  const config = KEY_MAP[key];
  if (config && !pressedKeys.has(key)) {
    e.preventDefault();
    pressedKeys.add(key);
    playNote(config.note);
  }
}

function handleKeyUp(e) {
  const key = e.key.toLowerCase();

  // Sustain release
  if (key === ' ') {
    e.preventDefault();
    sustainActive = false;
    const sustainBtn = document.getElementById('sustain-toggle');
    sustainBtn.classList.remove('active');
    sustainBtn.querySelector('.toggle-label').textContent = 'OFF';
    releaseSustainedNotes();
    return;
  }

  const config = KEY_MAP[key];
  if (config) {
    pressedKeys.delete(key);
    stopNote(config.note);
  }
}

// ===== Mouse / Touch Handlers =====
function setupMouseHandlers() {
  const piano = document.getElementById('piano');
  let isMouseDown = false;

  piano.addEventListener('mousedown', (e) => {
    const keyEl = e.target.closest('.key');
    if (!keyEl) return;
    e.preventDefault();
    isMouseDown = true;
    playNote(keyEl.dataset.note);
  });

  piano.addEventListener('mouseenter', (e) => {
    if (!isMouseDown) return;
    const keyEl = e.target.closest('.key');
    if (keyEl) playNote(keyEl.dataset.note);
  }, true);

  piano.addEventListener('mouseleave', (e) => {
    const keyEl = e.target.closest('.key');
    if (keyEl) stopNote(keyEl.dataset.note);
  }, true);

  document.addEventListener('mouseup', () => {
    if (isMouseDown) {
      isMouseDown = false;
      // Release all active notes from mouse
      activeNotes.forEach(note => stopNote(note));
    }
  });

  // Touch support
  piano.addEventListener('touchstart', (e) => {
    e.preventDefault();
    Array.from(e.changedTouches).forEach(touch => {
      const keyEl = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('.key');
      if (keyEl) playNote(keyEl.dataset.note);
    });
  }, { passive: false });

  piano.addEventListener('touchend', (e) => {
    e.preventDefault();
    Array.from(e.changedTouches).forEach(touch => {
      const keyEl = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('.key');
      if (keyEl) stopNote(keyEl.dataset.note);
    });
  }, { passive: false });
}

// ===== Recording =====
function setupRecording() {
  const recordBtn = document.getElementById('record-btn');
  const playBtn = document.getElementById('play-btn');
  const clearBtn = document.getElementById('clear-btn');

  recordBtn.addEventListener('click', () => {
    if (isPlaying) return;

    if (!isRecording) {
      // Start recording
      isRecording = true;
      recordedNotes = [];
      recordStartTime = performance.now();
      recordBtn.classList.add('recording');
      recordBtn.querySelector('span').textContent = 'Stop';
      playBtn.disabled = true;
      clearBtn.disabled = true;
    } else {
      // Stop recording
      isRecording = false;
      recordBtn.classList.remove('recording');
      recordBtn.querySelector('span').textContent = 'Record';
      playBtn.disabled = recordedNotes.length === 0;
      clearBtn.disabled = recordedNotes.length === 0;
    }
  });

  playBtn.addEventListener('click', () => {
    if (isRecording || isPlaying || recordedNotes.length === 0) return;
    playRecording();
  });

  clearBtn.addEventListener('click', () => {
    recordedNotes = [];
    playBtn.disabled = true;
    clearBtn.disabled = true;
  });
}

function playRecording() {
  isPlaying = true;
  const playBtn = document.getElementById('play-btn');
  const recordBtn = document.getElementById('record-btn');
  playBtn.querySelector('span').textContent = 'Playing...';
  playBtn.disabled = true;
  recordBtn.disabled = true;

  const startTime = performance.now();

  recordedNotes.forEach(event => {
    setTimeout(() => {
      if (event.type === 'attack') {
        playNote(event.note);
      } else {
        stopNote(event.note);
      }
    }, event.time);
  });

  // Calculate total duration
  const maxTime = Math.max(...recordedNotes.map(e => e.time));
  setTimeout(() => {
    isPlaying = false;
    playBtn.querySelector('span').textContent = 'Play';
    playBtn.disabled = false;
    recordBtn.disabled = false;

    // Release any remaining notes
    activeNotes.forEach(note => stopNote(note));
  }, maxTime + 500);
}

// ===== Controls Setup =====
function setupControls() {
  // Volume
  const volumeSlider = document.getElementById('volume-slider');
  const volumeValue = document.getElementById('volume-value');

  volumeSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    volumeValue.textContent = `${val}%`;

    // Convert 0-100 to dB (-40 to 0)
    const db = val === 0 ? -Infinity : -40 + (val / 100) * 40;
    if (window._volumeNode) {
      window._volumeNode.volume.value = db;
    }
  });

  // Sustain toggle (click)
  const sustainToggle = document.getElementById('sustain-toggle');
  sustainToggle.addEventListener('click', () => {
    sustainActive = !sustainActive;
    sustainToggle.classList.toggle('active', sustainActive);
    sustainToggle.querySelector('.toggle-label').textContent = sustainActive ? 'ON' : 'OFF';
    if (!sustainActive) {
      releaseSustainedNotes();
    }
  });

  // Labels toggle
  const labelsToggle = document.getElementById('labels-toggle');
  const pianoContainer = document.getElementById('piano-container');

  labelsToggle.addEventListener('click', () => {
    labelsVisible = !labelsVisible;
    labelsToggle.classList.toggle('active', labelsVisible);
    labelsToggle.querySelector('.toggle-label').textContent = labelsVisible ? 'ON' : 'OFF';
    pianoContainer.classList.toggle('labels-hidden', !labelsVisible);
  });
}

// ===== MIDI Support =====
async function setupMIDI() {
  if (!navigator.requestMIDIAccess) {
    console.log('WebMIDI not supported in this browser.');
    return;
  }

  try {
    const midiAccess = await navigator.requestMIDIAccess();

    midiAccess.inputs.forEach(input => {
      input.onmidimessage = handleMIDIMessage;
    });

    midiAccess.onstatechange = (e) => {
      if (e.port.type === 'input' && e.port.state === 'connected') {
        e.port.onmidimessage = handleMIDIMessage;
      }
    };

    console.log('MIDI connected successfully');
  } catch (err) {
    console.log('MIDI access denied:', err);
  }
}

function handleMIDIMessage(msg) {
  const [status, midiNote, velocity] = msg.data;
  const command = status & 0xf0;

  // Find corresponding note in our config
  const config = NOTES_CONFIG.find(n => n.midi === midiNote);
  if (!config) return;

  if (command === 0x90 && velocity > 0) {
    // Note On
    playNote(config.note);
  } else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
    // Note Off
    stopNote(config.note);
  } else if (command === 0xb0 && midiNote === 64) {
    // Sustain pedal (CC 64)
    if (velocity >= 64) {
      sustainActive = true;
      const sustainBtn = document.getElementById('sustain-toggle');
      sustainBtn.classList.add('active');
    } else {
      sustainActive = false;
      const sustainBtn = document.getElementById('sustain-toggle');
      sustainBtn.classList.remove('active');
      releaseSustainedNotes();
    }
  }
}

// ===== Responsive Black Key Positioning =====
function updateBlackKeyPositions() {
  const piano = document.getElementById('piano');
  const whiteKeys = piano.querySelectorAll('.key.white');
  if (whiteKeys.length === 0) return;

  const whiteKeyWidth = whiteKeys[0].offsetWidth;
  const blackKeyWidth = 36; // Approximate from CSS

  const whiteNotes = NOTES_CONFIG.filter(n => n.type === 'white');
  const blackKeys = piano.querySelectorAll('.key.black');

  const blackToLeftWhite = {
    'A#3': 'A3',
    'C#4': 'C4',
    'D#4': 'D4',
    'F#4': 'F4',
    'G#4': 'G4',
    'A#4': 'A4',
    'C#5': 'C5',
    'D#5': 'D5',
  };

  blackKeys.forEach(keyEl => {
    const note = keyEl.dataset.note;
    const leftWhite = blackToLeftWhite[note];
    if (!leftWhite) return;

    const whiteIndex = whiteNotes.findIndex(w => w.note === leftWhite);
    if (whiteIndex === -1) return;

    const actualBlackWidth = keyEl.offsetWidth;
    const pos = (whiteIndex + 1) * whiteKeyWidth - actualBlackWidth / 2;
    keyEl.style.left = `${pos}px`;
  });
}

// ===== Initialize =====
async function init() {
  buildPiano();
  setupControls();
  setupRecording();
  setupMouseHandlers();

  // Keyboard events
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('keyup', handleKeyUp);

  // Load audio
  try {
    await initAudio();
  } catch (err) {
    console.error('Failed to init audio:', err);
  }

  // MIDI
  setupMIDI();

  // Responsive positioning
  updateBlackKeyPositions();
  window.addEventListener('resize', updateBlackKeyPositions);

  // Click to start audio context (Tone.js requires user interaction)
  document.addEventListener('click', async () => {
    if (Tone.context.state !== 'running') {
      await Tone.start();
    }
  }, { once: true });
}

// Start
init();
