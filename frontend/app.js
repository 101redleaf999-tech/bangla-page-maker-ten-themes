const $ = (id) => document.getElementById(id);
const textInput = $("textInput");
const API_BASE = (window.BPM_CONFIG && window.BPM_CONFIG.API_BASE_URL || "").replace(/\/+$/, "");
let activeDownloadUrl = null;

function countText() {
  const text = textInput.value;
  $("charCount").textContent = `${text.length.toLocaleString()} অক্ষর`;
  const words = text.trim() ? text.trim().split(/\s+/u).length : 0;
  $("wordCount").textContent = `${words.toLocaleString()} শব্দ`;
  updatePreview();
}
function escapeHTML(s) {
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function updatePreview() {
  const w = Number($("width").value), h = Number($("height").value);
  const lines = Number($("lines").value), fs = Number($("fontSize").value);
  $("previewDimensions").textContent = `${w} × ${h} px`;
  $("previewLineCount").textContent = `${lines} লাইন পর্যন্ত`;
  const paper = $("paper");
  const scale = Math.min(220 / w, 300 / h);
  paper.style.width = `${w * scale}px`;
  paper.style.height = `${h * scale}px`;
  paper.style.padding = `${Math.max(5, 8*scale)}px`;
  $("previewNumber").style.fontSize = `${Math.max(6, 8*scale)}px`;
  $("paper").querySelector(".paper-rule").style.margin = `${Math.max(2,4*scale)}px 0 ${Math.max(3,8*scale)}px`;
  const innerWidth = Math.max(70, w - 24);
  $("previewLines").style.fontSize = `${Math.max(6, fs*scale)}px`;
  $("previewLines").style.lineHeight = "1.65";
  $("previewLines").style.gridTemplateRows = `repeat(${lines}, 1fr)`;
  const raw = textInput.value.trim().split(/\s+/u).filter(Boolean);
  const sample = raw.slice(0, 45).join(" ");
  const fakeLines = wrapPreview(sample, Math.max(10, Math.floor(innerWidth / Math.max(5, fs*.56))));
  $("previewLines").innerHTML = fakeLines.slice(0, lines).map(line => `<p>${escapeHTML(line)}</p>`).join("");
  $("previewNumber").textContent = $("includeText").checked ? "0001" : "";
}
function wrapPreview(text, maxChars) {
  const words = text.split(/\s+/u);
  const lines = []; let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) { lines.push(current); current = word; }
    else current = next;
  }
  if (current) lines.push(current);
  return lines;
}
function resetResult() {
  $("idleResult").hidden = true;
  $("successBox").hidden = true;
  $("errorBox").hidden = true;
  $("progressBox").hidden = false;
  setProgress(3, "অনুরোধ পাঠানো হচ্ছে…", "টেক্সট ও সেটিংস সার্ভারে পাঠানো হচ্ছে।");
}
function setProgress(percent, label, message) {
  $("progressBar").style.width = `${percent}%`;
  $("progressPercent").textContent = `${percent}%`;
  $("progressLabel").textContent = label;
  $("progressMessage").textContent = message;
}
function showError(message) {
  $("progressBox").hidden = true; $("successBox").hidden = true;
  $("idleResult").hidden = true; $("errorBox").hidden = false;
  $("errorMessage").textContent = message;
}
function showIdle() {
  $("idleResult").hidden = false; $("successBox").hidden = true;
  $("errorBox").hidden = true; $("progressBox").hidden = true;
}
function configPayload() {
  return {
    text: textInput.value,
    width: Number($("width").value),
    height: Number($("height").value),
    lines_per_page: Number($("lines").value),
    font_size: Number($("fontSize").value),
    quality: Number($("quality").value),
    include_page_numbers: $("includeText").checked
  };
}
async function generate() {
  if (!textInput.value.trim()) {
    showError("প্রথমে টেক্সট পেস্ট করো অথবা একটি TXT ফাইল আপলোড করো।");
    return;
  }
  const button = $("generateButton");
  button.disabled = true; button.innerHTML = "<span>…</span> তৈরি হচ্ছে <b>↻</b>";
  resetResult();
  try {
    const endpoint = `${API_BASE}/api/generate`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(configPayload())
    });
    setProgress(25, "পৃষ্ঠা তৈরি হচ্ছে…", "বাংলা ফন্ট দিয়ে টেক্সটকে লাইনে ভাগ করা হচ্ছে।");
    if (!response.ok) {
      let msg = `সার্ভার ত্রুটি (${response.status})`;
      try { const data = await response.json(); msg = data.detail || msg; } catch {}
      throw new Error(msg);
    }
    setProgress(75, "ZIP তৈরি হচ্ছে…", "সব JPG একসঙ্গে প্যাক করা হচ্ছে।");
    const blob = await response.blob();
    setProgress(95, "ডাউনলোড প্রস্তুত…", "ফাইল প্রস্তুত।");
    const pages = Number(response.headers.get("X-Page-Count") || 0);
    const zipName = response.headers.get("X-Filename") || "bangla-pages.zip";
    if (activeDownloadUrl) URL.revokeObjectURL(activeDownloadUrl);
    activeDownloadUrl = URL.createObjectURL(blob);
    $("downloadLink").href = activeDownloadUrl;
    $("downloadLink").download = zipName;
    $("pageTotal").textContent = pages || "—";
    $("sizeTotal").textContent = blob.size < 1024*1024 ? `${(blob.size/1024).toFixed(1)} KB` : `${(blob.size/(1024*1024)).toFixed(2)} MB`;
    $("progressBox").hidden = true; $("idleResult").hidden = true;
    $("errorBox").hidden = true; $("successBox").hidden = false;
    setProgress(100, "সম্পন্ন", "ZIP ডাউনলোডের জন্য প্রস্তুত।");
  } catch (error) {
    const msg = error instanceof TypeError
      ? "Backend-এর সঙ্গে সংযোগ করা যায়নি। Render API চালু আছে কি না এবং frontend/config.js-এ API_BASE_URL ঠিক আছে কি না পরীক্ষা করো।"
      : error.message;
    showError(msg);
  } finally {
    button.disabled = false;
    button.innerHTML = "<span>✦</span> JPG পৃষ্ঠা তৈরি করো <b>→</b>";
  }
}
$("generateButton").addEventListener("click", generate);
$("retryButton").addEventListener("click", generate);
$("makeAnother").addEventListener("click", showIdle);
textInput.addEventListener("input", countText);
["width","height","lines","fontSize","includeText"].forEach(id => $(id).addEventListener("change", updatePreview));
$("quality").addEventListener("input", () => $("qualityValue").textContent = `${$("quality").value}%`);
$("clearText").addEventListener("click", () => { textInput.value = ""; countText(); textInput.focus(); });
$("resetSettings").addEventListener("click", () => {
  $("width").value = "240"; $("height").value = "320"; $("lines").value = "10";
  $("fontSize").value = "16"; $("quality").value = "65"; $("qualityValue").textContent = "65%";
  $("includeText").checked = true; updatePreview();
});
const fileInput = $("fileInput"), dropzone = $("dropzone");
$("chooseFile").addEventListener("click", e => { e.stopPropagation(); fileInput.click(); });
dropzone.addEventListener("click", e => { if (e.target.id !== "chooseFile") fileInput.click(); });
dropzone.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); }});
fileInput.addEventListener("change", () => { if (fileInput.files[0]) loadTextFile(fileInput.files[0]); });
async function loadTextFile(file) {
  if (!file.name.toLowerCase().endsWith(".txt") && file.type !== "text/plain") {
    showError("শুধু .txt ফাইল আপলোড করো।"); return;
  }
  try {
    textInput.value = await file.text();
    countText();
    showIdle();
  } catch { showError("ফাইলটি পড়া যায়নি। UTF-8 TXT হিসেবে সেভ করে আবার চেষ্টা করো।"); }
}
["dragenter","dragover"].forEach(ev => dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.add("dragover"); }));
["dragleave","drop"].forEach(ev => dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.remove("dragover"); }));
dropzone.addEventListener("drop", e => { const file = e.dataTransfer.files[0]; if (file) loadTextFile(file); });
countText(); showIdle();

// ---- themes ----
const THEMES = [["light","লাইট","#f7f6f2","#276749"],["dark","ডার্ক","#0e1117","#2f9e6e"],["midnight","মিডনাইট","#0d1445","#5a7bf0"],["ocean","ওশান","#06405e","#1790ad"],["sunset","সানসেট","#b8483f","#e0602a"],["forest","ফরেস্ট","#0f2d1c","#2f9158"],["gaming","গেমিং ব্লু","#0a1730","#1f6fe5"],["cosmic","কসমিক পারপল","#2a1260","#8444e6"],["red","ন্যাচারাল রেড","#3b0d10","#d23a3a"],["earth","আর্থ গ্রিন","#232a12","#6f8f23"]];
const dock = $("themeDock");
function applyTheme(id, save) {
  if (!THEMES.some(t => t[0] === id)) id = "dark";
  document.documentElement.dataset.theme = id;
  if (save) { try { localStorage.setItem("bpm-theme", id); } catch {} }
  dock.querySelectorAll("button").forEach(b => b.setAttribute("aria-checked", b.dataset.id === id));
  document.querySelector('meta[name="theme-color"]').content = THEMES.find(t => t[0] === id)[2];
}
dock.innerHTML = THEMES.map(([id, name, a, b]) => `<button type="button" role="radio" data-id="${id}" title="${name}" aria-label="${name}" style="--a:${a};--b:${b}"></button>`).join("");
dock.addEventListener("click", e => { const b = e.target.closest("button"); if (b) applyTheme(b.dataset.id, true); });
$("scene").innerHTML = Array.from({length: 18}, (_, i) => `<i style="--x:${Math.round(i * 5.5 + Math.random() * 4)}%;--d:-${(Math.random() * 20).toFixed(1)}s;--z:${(0.6 + Math.random() * 1.1).toFixed(2)};--yv:${Math.round(Math.random() * 95)}vh"></i>`).join("");
let savedTheme = "dark"; try { savedTheme = localStorage.getItem("bpm-theme") || "dark"; } catch {}
applyTheme(savedTheme, false);
