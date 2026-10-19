const el = (id) => document.getElementById(id);
document.querySelectorAll(".help-tip").forEach((tip) => {
  const summary = tip.querySelector("summary");
  let openedByHover = false;
  summary.addEventListener("pointerenter", (event) => {
    if (event.pointerType === "mouse") {
      openedByHover = true;
      tip.open = true;
    }
  });
  summary.addEventListener("pointerleave", (event) => {
    if (event.pointerType === "mouse" && openedByHover) {
      openedByHover = false;
      tip.open = false;
    }
  });
  summary.addEventListener("click", (event) => {
    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      event.preventDefault();
      tip.open = true;
    }
  });
  tip.addEventListener("focusout", (event) => {
    if (!tip.contains(event.relatedTarget) && !openedByHover) tip.open = false;
  });
});
window.addEventListener(
  "error",
  (event) => {
    if (
      event.target instanceof HTMLScriptElement &&
      event.target.src.includes("simulation3d.js")
    ) {
      const message = el("scene-message");
      if (message) {
        message.textContent =
          "3D preview could not load. Check your internet connection and reload.";
      }
    }
  },
  true,
);
const loginScreen = el("login-screen"),
  dashboard = el("dashboard");
let csrfToken = "",
  authMode = "login",
  authReady = false,
  dashboardAuthenticated = false,
  readingsSaveTimer = null,
  readingsSaveInFlight = false,
  readingsSavePending = false,
  readingsSaveSnapshot = null,
  lastReadingsSaveAt = 0,
  readingsWindowTimer = null,
  peakReadingWindow = null,
  savedReadings = [],
  readingsPage = 1,
  readingsPages = 1,
  readingsTotal = 0,
  readingsLoading = false,
  readingsSearchTerm = "",
  readingsSort = "newest",
  readingsSearchTimer = null,
  readingsRequestId = 0;
function showDashboard(email) {
  loginScreen.hidden = true;
  dashboard.hidden = false;
  el("account-email").textContent = email || "";
  dashboardAuthenticated = true;
  startReadingsWindow();
  void loadSavedReadings();
}
function showLogin() {
  if (readingsExpandButton?.getAttribute("aria-expanded") === "true") {
    setReadingsExpanded(false);
  }
  dashboardAuthenticated = false;
  readingsSavePending = false;
  readingsSaveSnapshot = null;
  peakReadingWindow = null;
  if (readingsWindowTimer) {
    clearInterval(readingsWindowTimer);
    readingsWindowTimer = null;
  }
  savedReadings = [];
  readingsPage = 1;
  readingsPages = 1;
  readingsTotal = 0;
  readingsSearchTerm = "";
  el("saved-readings-search").value = "";
  readingsRequestId++;
  readingsLoading = false;
  if (readingsSearchTimer) {
    clearTimeout(readingsSearchTimer);
    readingsSearchTimer = null;
  }
  renderSavedReadings(savedReadings);
  updateReadingsPager();
  if (readingsSaveTimer) {
    clearTimeout(readingsSaveTimer);
    readingsSaveTimer = null;
  }
  dashboard.hidden = true;
  loginScreen.hidden = false;
  el("login-password").value = "";
  el("login-confirm").value = "";
  setPasswordVisibility("login-password", "password-toggle", false, "password");
  setPasswordVisibility(
    "login-confirm",
    "confirm-password-toggle",
    false,
    "confirm password",
  );
  el("login-error").textContent = "";
}
function setAuthMode(mode) {
  authMode = mode;
  const registering = mode === "register";
  el("login-title").textContent = registering
    ? "Create your account"
    : "Welcome back";
  el("login-copy").textContent = registering
    ? "Register to access the environment monitoring dashboard."
    : "Sign in to open the environment monitoring dashboard.";
  el("login-password").autocomplete = registering
    ? "new-password"
    : "current-password";
  el("login-password").minLength = registering ? 8 : 1;
  el("confirm-field").hidden = !registering;
  el("login-confirm").required = registering;
  el("login-submit").textContent = registering ? "Create account" : "Sign in";
  el("auth-switch").firstChild.textContent = registering
    ? "Already registered? "
    : "New to AirWatch? ";
  el("mode-toggle").textContent = registering ? "Sign in" : "Create an account";
  el("login-error").textContent = "";
}
function setupPasswordToggle(inputId, buttonId, label) {
  const input = el(inputId);
  const button = el(buttonId);
  button.addEventListener("click", () => {
    setPasswordVisibility(inputId, buttonId, input.type !== "text", label);
  });
}
function setPasswordVisibility(inputId, buttonId, visible, label) {
  const input = el(inputId);
  const button = el(buttonId);
  input.type = visible ? "text" : "password";
  button.querySelector(".eye-open").hidden = visible;
  button.querySelector(".eye-closed").hidden = !visible;
  button.setAttribute("aria-label", `${visible ? "Hide" : "Show"} ${label}`);
  button.title = `${visible ? "Hide" : "Show"} ${label}`;
  button.setAttribute("aria-pressed", String(visible));
}
setupPasswordToggle("login-password", "password-toggle", "password");
setupPasswordToggle(
  "login-confirm",
  "confirm-password-toggle",
  "confirm password",
);
el("mode-toggle").addEventListener("click", () =>
  setAuthMode(authMode === "login" ? "register" : "login"),
);
async function authRequest(action, payload = {}) {
  const response = await fetch("api/auth.php", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload, csrf_token: csrfToken }),
  });
  const data = await readAuthResponse(response);
  if (!response.ok) throw new Error(data.error || "Request failed.");
  csrfToken = data.csrf_token || csrfToken;
  return data;
}
async function readAuthResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error(
      "The account service is not running as PHP. Open this app through XAMPP or a PHP server; VS Code Live Server cannot run the account endpoint.",
    );
  }
  try {
    return await response.json();
  } catch (error) {
    throw new Error("The account service returned invalid JSON.");
  }
}
function renderSavedReadings(readings) {
  const body = el("readings-body");
  body.replaceChildren();
  if (!readings.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 7;
    cell.textContent = readingsSearchTerm
      ? "No readings match this search."
      : "No shared readings yet.";
    row.append(cell);
    body.append(row);
    return;
  }

  readings.forEach((reading) => {
    const row = document.createElement("tr");
    const timestamp = String(reading.recorded_at || "");
    const parsedTime = new Date(timestamp.replace(" ", "T"));
    const recorded = Number.isNaN(parsedTime.getTime())
      ? timestamp
      : new Intl.DateTimeFormat(undefined, {
          dateStyle: "short",
          timeStyle: "medium",
        }).format(parsedTime);
    const alerts = [];
    if (reading.gas_alert) alerts.push("Gas");
    if (Number(reading.temperature) >= temperatureAlertThreshold) {
      alerts.push("Temperature");
    }
    if (Number(reading.humidity) >= humidityAlertThreshold) {
      alerts.push("Humidity");
    }
    const values = [
      recorded,
      reading.email || `User ${reading.user_id}`,
      `${Number(reading.temperature).toFixed(1)} °C`,
      `${Number(reading.humidity).toFixed(3)}%`,
      `${Number(reading.gas_adc)} ADC`,
      `${Number(reading.gas_threshold)} ADC`,
      alerts.length ? `${alerts.join(" + ")} alert` : "Normal",
    ];

    values.forEach((value, index) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      if (index === 6) {
        cell.className = alerts.length ? "reading-alert" : "reading-normal";
      }
      row.append(cell);
    });
    body.append(row);
  });
}
function updateReadingsPager() {
  el("readings-page-label").textContent = `Page ${readingsPage} of ${readingsPages} · ${readingsTotal} saved`;
  el("readings-previous").disabled =
    readingsLoading || !dashboardAuthenticated || readingsPage <= 1;
  el("readings-next").disabled =
    readingsLoading || !dashboardAuthenticated || readingsPage >= readingsPages;
}
el("readings-previous").addEventListener("click", () => {
  if (readingsPage > 1) void loadSavedReadings(readingsPage - 1);
});
el("readings-next").addEventListener("click", () => {
  if (readingsPage < readingsPages) void loadSavedReadings(readingsPage + 1);
});
el("readings-sort").addEventListener("change", (event) => {
  readingsSort = event.currentTarget.value;
  readingsPage = 1;
  void loadSavedReadings(1);
});
el("saved-readings-search").addEventListener("input", (event) => {
  readingsSearchTerm = event.currentTarget.value.trim();
  readingsPage = 1;
  readingsRequestId++;
  readingsLoading = true;
  updateReadingsPager();
  el("readings-save-status").textContent = readingsSearchTerm
    ? "Searching saved readings…"
    : "Loading saved readings…";
  if (readingsSearchTimer) clearTimeout(readingsSearchTimer);
  readingsSearchTimer = setTimeout(() => {
    readingsSearchTimer = null;
    void loadSavedReadings(1);
  }, 250);
});
const savedReadingsPanel = el("saved-readings-title").closest(
  ".saved-readings",
);
const readingsExpandButton = el("readings-expand");
function setReadingsExpanded(expanded) {
  savedReadingsPanel.classList.toggle("is-expanded", expanded);
  document.body.classList.toggle("readings-expanded", expanded);
  readingsExpandButton.setAttribute("aria-expanded", String(expanded));
  readingsExpandButton.textContent = expanded ? "Collapse" : "Expand";
  readingsExpandButton.setAttribute(
    "aria-label",
    `${expanded ? "Collapse" : "Expand"} shared data readings`,
  );
  if (!expanded) readingsExpandButton.focus();
}
readingsExpandButton.addEventListener("click", () => {
  setReadingsExpanded(readingsExpandButton.getAttribute("aria-expanded") !== "true");
});
document.addEventListener("keydown", (event) => {
  if (
    event.key === "Escape" &&
    readingsExpandButton.getAttribute("aria-expanded") === "true"
  ) {
    setReadingsExpanded(false);
  }
});
async function loadSavedReadings(page = readingsPage) {
  if (!dashboardAuthenticated) return;
  const requestId = ++readingsRequestId;
  readingsLoading = true;
  updateReadingsPager();
  el("readings-save-status").textContent = readingsSearchTerm
    ? "Searching saved readings…"
    : "Loading saved readings…";
  try {
    const query = new URLSearchParams({
      page: String(page),
      q: readingsSearchTerm,
      sort: readingsSort,
    });
    const response = await fetch(`api/readings.php?${query}`, {
      credentials: "same-origin",
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load readings.");
    if (!dashboardAuthenticated || requestId !== readingsRequestId) return;
    savedReadings = data.readings || [];
    readingsPage = Number(data.page) || 1;
    readingsPages = Number(data.pages) || 1;
    readingsTotal = Number(data.total) || 0;
    renderSavedReadings(savedReadings);
    el("readings-save-status").textContent = readingsTotal
      ? `Showing shared records ${(readingsPage - 1) * 10 + 1}–${Math.min(readingsPage * 10, readingsTotal)} of ${readingsTotal}${readingsSearchTerm ? " matches" : " readings"}. Refreshes every 10 seconds; saved values are window peaks.`
      : readingsSearchTerm
        ? `No shared readings match “${readingsSearchTerm}”.`
        : "No shared readings yet. Peak readings save every 10 seconds while you are signed in.";
  } catch (error) {
    if (requestId === readingsRequestId) {
      el("readings-save-status").textContent =
        error.message || "Could not load saved readings.";
    }
  } finally {
    if (requestId === readingsRequestId) {
      readingsLoading = false;
      updateReadingsPager();
    }
  }
}
function currentGasThreshold() {
  return Math.max(0, Math.min(1023, Number(el("gas-threshold").value) || 0));
}
function createReadingSample(reading, threshold) {
  return {
    temperature: Number(reading.temperature),
    humidity: Number(reading.humidity),
    gas: Number(reading.gas),
    threshold,
  };
}
function collectReadingPeak(reading, threshold) {
  const sample = createReadingSample(reading, threshold);
  if (!peakReadingWindow) {
    peakReadingWindow = sample;
    return;
  }
  peakReadingWindow.temperature = Math.max(
    peakReadingWindow.temperature,
    sample.temperature,
  );
  peakReadingWindow.humidity = Math.max(
    peakReadingWindow.humidity,
    sample.humidity,
  );
  peakReadingWindow.gas = Math.max(peakReadingWindow.gas, sample.gas);
  peakReadingWindow.threshold = threshold;
}
function startReadingsWindow() {
  if (readingsWindowTimer) clearInterval(readingsWindowTimer);
  peakReadingWindow = createReadingSample(values, currentGasThreshold());
  readingsWindowTimer = setInterval(flushReadingWindow, 10000);
}
function flushReadingWindow() {
  if (!dashboardAuthenticated) return;
  const peak = peakReadingWindow || createReadingSample(values, currentGasThreshold());
  peakReadingWindow = createReadingSample(values, currentGasThreshold());
  addHistory(peak);
  readingsSaveSnapshot = {
    temperature: peak.temperature,
    humidity: peak.humidity,
    gas_adc: peak.gas,
    gas_threshold: peak.threshold,
  };
  scheduleReadingsSave();
}
function scheduleReadingsSave() {
  if (!dashboardAuthenticated || !readingsSaveSnapshot) return;
  readingsSavePending = true;
  if (readingsSaveInFlight) return;
  if (readingsSaveTimer) return;

  const delay = Math.max(0, 10000 - (Date.now() - lastReadingsSaveAt));
  readingsSaveTimer = setTimeout(() => {
    readingsSaveTimer = null;
    void saveCurrentReadings();
  }, delay);
}
async function saveCurrentReadings() {
  if (!dashboardAuthenticated || !readingsSavePending || readingsSaveInFlight) {
    return;
  }
  const payload = readingsSaveSnapshot;
  if (!payload) return;

  readingsSavePending = false;
  readingsSaveInFlight = true;
  el("readings-save-status").textContent = "Saving the 10-second peak readings…";
  try {
    const response = await fetch("api/readings.php", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, csrf_token: csrfToken }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not save readings.");

    if (readingsSaveSnapshot === payload) readingsSaveSnapshot = null;
    lastReadingsSaveAt = Date.now();
    readingsPage = 1;
    void loadSavedReadings(1);
  } catch (error) {
    lastReadingsSaveAt = Date.now();
    readingsSavePending = dashboardAuthenticated && Boolean(readingsSaveSnapshot);
    el("readings-save-status").textContent =
      error.message || "Could not save the current readings.";
  } finally {
    readingsSaveInFlight = false;
    if (readingsSavePending) scheduleReadingsSave();
  }
}
el("login-submit").disabled = true;
async function restoreSession() {
  authReady = false;
  el("login-submit").disabled = true;
  try {
    const response = await fetch("api/auth.php", {
      credentials: "same-origin",
      cache: "no-store",
    });
    const data = await readAuthResponse(response);
    if (!response.ok) {
      throw new Error(data.error || "The account service is unavailable.");
    }
    csrfToken = data.csrf_token || "";
    if (data.authenticated) showDashboard(data.email);
  } catch (error) {
    el("login-error").textContent =
      error.message ||
      "Cannot reach the account service. Start Apache and MySQL in XAMPP.";
  } finally {
    authReady = true;
    el("login-submit").disabled = false;
  }
}
restoreSession();
el("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!authReady) return;
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  if (
    authMode === "register" &&
    el("login-password").value !== el("login-confirm").value
  ) {
    el("login-error").textContent = "The passwords do not match.";
    return;
  }
  const submit = el("login-submit");
  submit.disabled = true;
  el("login-error").textContent = "";
  try {
    const result = await authRequest(authMode, {
      email: el("login-email").value,
      password: el("login-password").value,
    });
    showDashboard(result.email);
  } catch (error) {
    el("login-error").textContent = error.message;
  } finally {
    submit.disabled = false;
  }
});
el("logout").addEventListener("click", async () => {
  try {
    await authRequest("logout");
  } catch (error) {
    el("login-error").textContent = error.message;
    return;
  }
  csrfToken = "";
  showLogin();
  await restoreSession();
});
const themeToggle = el("theme-toggle");
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const dark = theme === "dark";
  themeToggle.setAttribute(
    "aria-label",
    `Switch to ${dark ? "light" : "dark"} mode`,
  );
  themeToggle.setAttribute("aria-pressed", String(dark));
}
let savedTheme = "light";
try {
  savedTheme =
    localStorage.getItem("airwatch-theme") === "dark" ? "dark" : "light";
} catch (error) {
  // Keep the dashboard usable when browser storage is disabled.
}
setTheme(savedTheme);
themeToggle.addEventListener("click", () => {
  const theme =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  setTheme(theme);
  try {
    localStorage.setItem("airwatch-theme", theme);
  } catch (error) {
    // The selected theme still applies for this page view.
  }
});
const initial = { temperature: 24, humidity: 45, gas: 318 };
const temperatureAlertThreshold = 45;
const humidityAlertThreshold = 70;
let values = { ...initial },
  timer = null,
  simulationMode = "manual",
  alertMuted = false,
  smokeDetected = false,
  smokeExposure = 0;
const activeHazards = { fire: 0, water: 0 };
let audioContext = null,
  audioBus = null,
  alarmTimer = null,
  alarmGeneration = 0,
  currentAlarmTypes = [];
const audioSources = {};
const readingHistory = {
  temperature: [
    23.5, 23.8, 23.4, 24.2, 24.0, 24.7, 24.4, 25.1, 24.8, 25.4, 25.1, 24.0,
  ],
  humidity: [42, 44, 43, 46, 45, 48, 47, 50, 48, 46, 44, 45],
  gas: [302, 318, 294, 326, 310, 345, 331, 360, 342, 330, 312, 318],
};
const chartMetrics = {
  temperature: {
    title: "Temperature history",
    description: "Peak temperature in each 10-second window",
    color: "#45a67d",
    format: (value) => `${Number(value).toFixed(1)} °C`,
  },
  humidity: {
    title: "Humidity history",
    description: "Peak humidity in each 10-second window",
    color: "#438fc5",
    format: (value) => `${Number(value).toFixed(3)}%`,
  },
  gas: {
    title: "Gas history",
    description: "Peak gas reading in each 10-second window",
    color: "#df9852",
    format: (value) => `${Math.round(Number(value))} ADC`,
  },
};
let selectedChartMetric = "temperature";
let previousAreaEvents = null;
const controls = [
  el("temp-control"),
  el("humidity-control"),
  el("gas-control"),
];
async function enableAudio() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!audioContext) audioContext = new AudioContextClass();
    if (!audioBus) {
      const compressor = audioContext.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-18, audioContext.currentTime);
      compressor.knee.setValueAtTime(12, audioContext.currentTime);
      compressor.ratio.setValueAtTime(4, audioContext.currentTime);
      compressor.attack.setValueAtTime(0.004, audioContext.currentTime);
      compressor.release.setValueAtTime(0.16, audioContext.currentTime);
      audioBus = audioContext.createGain();
      audioBus.gain.setValueAtTime(0.72, audioContext.currentTime);
      audioBus.connect(compressor);
      compressor.connect(audioContext.destination);
      for (const [type, position] of Object.entries({
        gas: [3.19, 1.0, -0.15],
        temperature: [-3.25, 1.01, -0.05],
        humidity: [-3.25, 1.01, -0.05],
      })) {
        const panner = audioContext.createPanner();
        panner.panningModel = "HRTF";
        panner.distanceModel = "linear";
        panner.refDistance = 2;
        panner.maxDistance = 13;
        panner.rolloffFactor = 1;
        if (panner.positionX) {
          panner.positionX.setValueAtTime(position[0], audioContext.currentTime);
          panner.positionY.setValueAtTime(position[1], audioContext.currentTime);
          panner.positionZ.setValueAtTime(position[2], audioContext.currentTime);
        } else {
          panner.setPosition(...position);
        }
        panner.connect(audioBus);
        audioSources[type] = panner;
      }
    }
    if (audioContext.state === "suspended") await audioContext.resume();
  } catch (error) {
    /* Audio may be unavailable or blocked by browser settings. */
  }
}
window.addEventListener("sensor-audio-listener-move", (event) => {
  if (!audioContext) return;
  const { position, forward, up } = event.detail;
  const listener = audioContext.listener;
  if (listener.positionX) {
    listener.positionX.setTargetAtTime(position.x, audioContext.currentTime, 0.04);
    listener.positionY.setTargetAtTime(position.y, audioContext.currentTime, 0.04);
    listener.positionZ.setTargetAtTime(position.z, audioContext.currentTime, 0.04);
    listener.forwardX.setTargetAtTime(forward.x, audioContext.currentTime, 0.04);
    listener.forwardY.setTargetAtTime(forward.y, audioContext.currentTime, 0.04);
    listener.forwardZ.setTargetAtTime(forward.z, audioContext.currentTime, 0.04);
    listener.upX.setTargetAtTime(up.x, audioContext.currentTime, 0.04);
    listener.upY.setTargetAtTime(up.y, audioContext.currentTime, 0.04);
    listener.upZ.setTargetAtTime(up.z, audioContext.currentTime, 0.04);
  } else {
    listener.setPosition(position.x, position.y, position.z);
    listener.setOrientation(
      forward.x, forward.y, forward.z, up.x, up.y, up.z,
    );
  }
});
function alarmBeep(alertTypes = ["gas"]) {
  if (!audioContext || !audioBus || audioContext.state !== "running") return;
  const now = audioContext.currentTime;
  const alertSounds = {
    gas: {
      spacing: 1.25,
      notes: [
        [880, 0, 0.12],
        [660, 0.16, 0.12],
        [988, 0.32, 0.15],
        [660, 0.52, 0.12],
        [988, 0.68, 0.2],
      ],
      waveform: "triangle",
      volume: 0.19,
      overtone: 0.032,
    },
    temperature: {
      spacing: 1.25,
      notes: [
        [784, 0, 0.22],
        [988, 0.28, 0.22],
        [784, 0.56, 0.34],
      ],
      waveform: "sine",
      volume: 0.17,
      overtone: 0.025,
    },
    humidity: {
      spacing: 1.25,
      notes: [
        [523, 0, 0.16],
        [659, 0.22, 0.16],
        [784, 0.44, 0.28],
      ],
      waveform: "sine",
      volume: 0.16,
      overtone: 0.04,
    },
  };
  alertTypes.forEach((type, alertIndex) => {
    const sound = alertSounds[type];
    if (!sound) return;
    sound.notes.forEach(([frequency, offset, duration]) => {
      const start = now + alertIndex * sound.spacing + offset;
      const scheduleTone = (toneFrequency, volume, waveform) => {
        const oscillator = audioContext.createOscillator();
        const envelope = audioContext.createGain();
        oscillator.type = waveform;
        oscillator.frequency.setValueAtTime(toneFrequency, start);
        envelope.gain.setValueAtTime(0.0001, start);
        envelope.gain.exponentialRampToValueAtTime(volume, start + 0.018);
        envelope.gain.setTargetAtTime(volume * 0.72, start + 0.018, 0.045);
        envelope.gain.setValueAtTime(volume * 0.72, start + duration * 0.62);
        envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        oscillator.connect(envelope);
        envelope.connect(audioSources[type] || audioBus);
        oscillator.start(start);
        oscillator.stop(start + duration + 0.015);
      };
      scheduleTone(frequency, sound.volume, sound.waveform);
      scheduleTone(frequency * 2, sound.overtone, "sine");
    });
  });
}
async function startAlarm() {
  if (alertMuted) return;
  const threshold = Math.max(
    0,
    Math.min(1023, Number(el("gas-threshold").value) || 0),
  );
  const gasAlert = values.gas >= threshold;
  const temperatureAlert = values.temperature >= temperatureAlertThreshold;
  const humidityAlert = values.humidity >= humidityAlertThreshold;
  currentAlarmTypes = [
    gasAlert && "gas",
    temperatureAlert && "temperature",
    humidityAlert && "humidity",
  ].filter(Boolean);
  if (alarmTimer || currentAlarmTypes.length === 0) return;
  const generation = ++alarmGeneration;
  await enableAudio();
  if (
    generation !== alarmGeneration ||
    alertMuted ||
    currentAlarmTypes.length === 0
  )
    return;
  const ringAlarm = () => alarmBeep(currentAlarmTypes);
  ringAlarm();
  alarmTimer = setInterval(() => {
    if (audioContext && audioContext.state === "running") ringAlarm();
  }, 3600);
}
function stopAlarm() {
  alarmGeneration++;
  currentAlarmTypes = [];
  if (alarmTimer) {
    clearInterval(alarmTimer);
    alarmTimer = null;
  }
}
function updateClock() {
  el("clock").textContent = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date());
}
function sliderFill(input) {
  const pct = ((input.value - input.min) / (input.max - input.min)) * 100;
  input.style.setProperty("--pct", `${pct}%`);
}
function addHistory(readings) {
  Object.entries(readingHistory).forEach(([key, history]) => {
    history.push(readings[key]);
    if (history.length > 12) history.shift();
  });
  drawCharts();
}
function drawCharts() {
  const history = readingHistory[selectedChartMetric];
  const metric = chartMetrics[selectedChartMetric];
  const low = Math.min(...history) - 1;
  const high = Math.max(...history) + 1;
  const points = history.map((value, index) => {
    const x = (index * 560) / (history.length - 1);
    const y = 165 - ((value - low) / (high - low || 1)) * 125;
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  const path = `M${points.join(" L")}`;
  el("history-line-path").setAttribute("d", path);
  el("history-area-path").setAttribute("d", `${path} L560 170 L0 170Z`);
  const [x, y] = points[points.length - 1].split(" ");
  el("history-chart-point").setAttribute("cx", x);
  el("history-chart-point").setAttribute("cy", y);
  el("history-chart-title").textContent = metric.title;
  el("history-chart-description").textContent = metric.description;
  el("history-chart-value").textContent = metric.format(history.at(-1));
  el("history-panel").dataset.metric = selectedChartMetric;
  el("history-chart-svg").setAttribute("aria-label", metric.title);
  el("history-gradient-start").setAttribute("stop-color", metric.color);
  el("history-gradient-end").setAttribute("stop-color", metric.color);
}
document.querySelectorAll("[data-chart-select]").forEach((button) => {
  button.addEventListener("click", () => {
    selectedChartMetric = button.dataset.chartSelect;
    document.querySelectorAll("[data-chart-select]").forEach((option) => {
      const selected = option === button;
      option.classList.toggle("is-active", selected);
      option.setAttribute("aria-pressed", String(selected));
    });
    drawCharts();
  });
});
function updateAreaNotifications({
  threshold,
  gasHigh,
  temperatureHigh,
  temperatureOut,
  humidityHigh,
  humidityOut,
}) {
  const activeEvents = [];
  if (smokeDetected) {
    activeEvents.push({
      id: "smoke",
      label: "Smoke near the MQ-2",
      message: `Smoke detected at the MQ-2. Gas reading: ${values.gas} ADC.`,
      severity: "alert",
    });
  }
  if (activeHazards.fire > 0) {
    activeEvents.push({
      id: "fire",
      label: "Heat near the DHT22",
      message: `Heat detected at the DHT22. Temperature: ${values.temperature.toFixed(1)} °C; humidity: ${Number(values.humidity).toFixed(3)}%.`,
      severity: "alert",
    });
  }
  if (activeHazards.water > 0) {
    activeEvents.push({
      id: "water",
      label: "Moisture near the DHT22",
      message: `Moisture detected at the DHT22. Humidity: ${Number(values.humidity).toFixed(3)}%; temperature: ${values.temperature.toFixed(1)} °C.`,
      severity: "warning",
    });
  }
  if (gasHigh) {
    activeEvents.push({
      id: "gas-alert",
      label: "Gas alert threshold reached",
      message: `Gas reading is ${values.gas} ADC; alert threshold is ${threshold} ADC.`,
      severity: "alert",
    });
  }
  if (temperatureHigh) {
    activeEvents.push({
      id: "temperature-alert",
      label: "High temperature alert",
      message: `DHT22 temperature reached ${values.temperature.toFixed(1)} °C (alert limit: ${temperatureAlertThreshold} °C).`,
      severity: "alert",
    });
  } else if (temperatureOut) {
    const direction = values.temperature < 18 ? "below" : "above";
    activeEvents.push({
      id: `temperature-${direction}`,
      label: `Temperature ${direction} its comfort range`,
      message: `DHT22 temperature is ${values.temperature.toFixed(1)} °C. Typical range is 18–26 °C.`,
      severity: "warning",
    });
  }
  if (humidityHigh) {
    activeEvents.push({
      id: "humidity-alert",
      label: "High humidity alert",
      message: `DHT22 humidity reached ${Number(values.humidity).toFixed(3)}% (alert limit: ${humidityAlertThreshold}%).`,
      severity: "alert",
    });
  } else if (humidityOut) {
    const direction = values.humidity < 30 ? "low" : "high";
    activeEvents.push({
      id: `humidity-${direction}`,
      label: `Humidity ${direction} its typical range`,
      message: `DHT22 humidity is ${Number(values.humidity).toFixed(3)}%. Typical range is 30–60%.`,
      severity: "warning",
    });
  }

  const previousIds = new Set((previousAreaEvents || []).map((event) => event.id));
  const activeIds = new Set(activeEvents.map((event) => event.id));
  const signature = [...activeIds].sort().join("|");
  if (previousAreaEvents === null || signature !== [...previousIds].sort().join("|")) {
    if (previousAreaEvents === null) {
      if (activeEvents.length) {
        activeEvents
          .filter((event) => event.severity === "alert")
          .forEach((event) => pushNotification(event.message, event.severity));
      }
    } else {
      activeEvents
        .filter((event) => event.severity === "alert" && !previousIds.has(event.id))
        .forEach((event) => pushNotification(event.message, event.severity));
    }
    previousAreaEvents = activeEvents;
  }
}
function pushNotification(message, severity) {
  if (message.startsWith("Monitoring started.")) return;
  const stack = el("notification-toasts");
  const toast = document.createElement("div");
  toast.className = `sensor-toast sensor-toast-${severity}`;
  toast.setAttribute("role", severity === "alert" ? "alert" : "status");

  const marker = document.createElement("span");
  marker.className = "sensor-toast-mark";
  marker.setAttribute("aria-hidden", "true");
  const text = document.createElement("span");
  text.className = "sensor-toast-message";
  text.textContent = message;
  const close = document.createElement("button");
  close.className = "sensor-toast-close";
  close.type = "button";
  close.setAttribute("aria-label", "Dismiss notification");
  close.textContent = "×";

  let timerId;
  const dismiss = () => {
    clearTimeout(timerId);
    toast.classList.add("sensor-toast-leaving");
    setTimeout(() => toast.remove(), 180);
  };
  close.addEventListener("click", dismiss);
  toast.append(marker, text, close);
  stack.append(toast);
  while (stack.children.length > 4) stack.firstElementChild.remove();
  timerId = setTimeout(dismiss, 6500);
}
function paint() {
  const threshold = Math.max(
    0,
    Math.min(1023, Number(el("gas-threshold").value) || 0),
  );
  const normalGas = Number(el("gas-control").value);
  const fireLevel = activeHazards.fire;
  const waterLevel = activeHazards.water;
  const baseTemperature = Number(el("temp-control").value);
  values = {
    temperature: Math.max(
      10,
      Math.min(
        80,
        baseTemperature + ((80 - baseTemperature) * fireLevel) / 5 - waterLevel * 0.5,
      ),
    ),
    humidity: Math.max(
      0,
      Math.min(100, Number(el("humidity-control").value) - fireLevel * 2 + waterLevel * 7.5),
    ),
    gas: Math.round(normalGas + smokeExposure * (1023 - normalGas)),
  };
  el("temperature").textContent = values.temperature.toFixed(1);
  el("humidity").textContent = values.humidity.toFixed(3);
  el("gas").textContent = String(values.gas);
  el("temp-output").textContent = `${values.temperature.toFixed(1)} °C`;
  el("humidity-output").textContent = `${values.humidity.toFixed(3)}%`;
  el("gas-output").textContent = `${values.gas} ADC`;
  controls.forEach(sliderFill);
  const gasHigh = values.gas >= threshold,
    temperatureHigh = values.temperature >= temperatureAlertThreshold,
    temperatureOut = values.temperature < 18 || values.temperature > 26,
    humidityHigh = values.humidity >= humidityAlertThreshold,
    humidityOut = values.humidity < 30 || values.humidity > 60;
  updateAreaNotifications({
    threshold,
    gasHigh,
    temperatureHigh,
    temperatureOut,
    humidityHigh,
    humidityOut,
  });
  window.dispatchEvent(
    new CustomEvent("sensor-readings-change", {
      detail: {
        ...values,
        gasAlert: gasHigh,
        temperatureHigh,
        temperatureOut,
        humidityHigh,
        humidityOut,
        smokeDetected,
        fireDetected: fireLevel > 0,
        waterDetected: waterLevel > 0,
      },
    }),
  );
  const tempState = el("temp-state");
  tempState.textContent = temperatureHigh
    ? "HIGH ALERT"
    : values.temperature < 18
      ? "Below range"
      : values.temperature > 26
        ? "Above range"
        : "In range";
  tempState.className =
    "state" + (temperatureHigh ? " alert" : temperatureOut ? " warn" : "");
  const humState = el("humidity-state");
  humState.textContent = humidityHigh
    ? "HIGH ALERT"
    : humidityOut
      ? "Check level"
      : "In range";
  humState.className =
    "state" + (humidityHigh ? " alert" : humidityOut ? " warn" : "");
  const gasState = el("gas-state");
  gasState.textContent = gasHigh ? "ALERT" : "Normal";
  gasState.className = "state" + (gasHigh ? " alert" : "");
  el("gas-output").classList.toggle("alert", gasHigh);
  const critical = gasHigh || temperatureHigh || humidityHigh;
  if (critical && !alertMuted) startAlarm();
  else stopAlarm();
  const environmentDetected = fireLevel > 0 || waterLevel > 0;
  el("live-dot").style.background = critical
    ? "var(--red)"
    : environmentDetected
      ? "var(--orange)"
      : "#4eaa7d";
  el("live-dot").style.boxShadow = critical
    ? "0 0 0 4px #fbe6e3"
    : "0 0 0 4px #e5f4eb";
  el("mode-label").textContent = critical
    ? "Simulated alert"
    : environmentDetected
      ? "Sensor detected"
      : simulationMode === "automatic"
        ? "Automatic demo"
        : "For Demo";
  collectReadingPeak(values, threshold);
}
controls.forEach((input) => input.addEventListener("input", paint));
el("gas-threshold").addEventListener("input", paint);
function setSimulationMode(mode) {
  if (mode !== "manual" && mode !== "automatic") return;
  if (mode === simulationMode && (mode === "manual" || timer)) return;

  clearInterval(timer);
  timer = null;
  simulationMode = mode;
  controls.forEach((input) => {
    input.disabled = mode === "automatic";
  });

  const manualMode = mode === "manual";
  el("mode-manual").classList.toggle("is-active", manualMode);
  el("mode-manual").setAttribute("aria-pressed", String(manualMode));
  el("auto").classList.toggle("is-active", !manualMode);
  el("auto").setAttribute("aria-pressed", String(!manualMode));
  el("mode-help").textContent = manualMode
    ? "Set readings with the sliders for a demo."
    : "Readings update automatically, with a 25% chance per update of an alert. Select For Demo to set them manually.";

  if (manualMode) {
    paint();
    return;
  }

  void enableAudio();
  timer = setInterval(() => {
    const alertType = Math.random() < 0.25
      ? ["gas", "temperature", "humidity"][Math.floor(Math.random() * 3)]
      : null;
    const varyReading = (input, min, max, step) => {
      const current = Number(input.value);
      const change = (Math.random() * 2 - 1) * step;
      return Math.max(min, Math.min(max, current + change));
    };

    el("temp-control").value = varyReading(
      el("temp-control"),
      21,
      28,
      1.2,
    ).toFixed(1);
    el("humidity-control").value = varyReading(
      el("humidity-control"),
      35,
      58,
      4,
    ).toFixed(3);
    el("gas-control").value = String(
      Math.round(varyReading(el("gas-control"), 220, 440, 32)),
    );
    if (alertType === "gas") {
      const threshold = Math.max(0, Number(el("gas-threshold").value) || 0);
      el("gas-control").value = String(
        Math.min(1023, threshold + 20 + Math.floor(Math.random() * 81)),
      );
    } else if (alertType === "temperature") {
      el("temp-control").value = (45 + Math.random() * 8).toFixed(1);
    } else if (alertType === "humidity") {
      el("humidity-control").value = (70 + Math.random() * 10).toFixed(3);
    }
    paint();
  }, 1200);
  paint();
}
el("mode-manual").addEventListener("click", () =>
  setSimulationMode("manual"),
);
el("auto").addEventListener("click", () =>
  setSimulationMode("automatic"),
);
window.addEventListener("sensor-effect-response", (event) => {
  const response = event.detail || {};
  smokeExposure = Math.max(0, Math.min(1, Number(response.smoke) || 0));
  smokeDetected = smokeExposure >= 0.06;
  activeHazards.fire = Math.max(0, Math.min(5, Number(response.fire) || 0));
  activeHazards.water = Math.max(0, Math.min(5, Number(response.water) || 0));
  paint();
});
el("reset").addEventListener("click", () => {
  el("temp-control").value = initial.temperature;
  el("humidity-control").value = initial.humidity;
  el("gas-control").value = initial.gas;
  el("gas-threshold").value = 450;
  alertMuted = false;
  el("quiet").textContent = "Mute alarm";
  el("quiet").setAttribute("aria-pressed", "false");
  if (simulationMode !== "manual") setSimulationMode("manual");
  else paint();
});
el("quiet").addEventListener("click", () => {
  alertMuted = !alertMuted;
  el("quiet").textContent = alertMuted ? "Unmute alarm" : "Mute alarm";
  el("quiet").setAttribute("aria-pressed", String(alertMuted));
  paint();
});
el("test-alarm").addEventListener("click", async () => {
  await enableAudio();
  alarmBeep(["gas", "temperature", "humidity"]);
});
el("export").addEventListener("click", () => {
  const rows = [
    ["sensor", "value", "unit"],
    ["temperature", values.temperature.toFixed(1), "C"],
    ["humidity", values.humidity.toFixed(3), "%"],
    ["mq2_raw", values.gas, "ADC"],
    ["gas_alert_threshold", el("gas-threshold").value, "ADC"],
  ];
  const csv = rows.map((r) => r.join(",")).join("\n");
  const a = document.createElement("a");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.href = url;
  a.download = "gas-sensor-readings.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
paint();
updateClock();
setInterval(updateClock, 1000);
setInterval(() => {
  if (dashboardAuthenticated && !readingsLoading) {
    void loadSavedReadings(readingsPage);
  }
}, 10000);
