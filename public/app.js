const $ = (id) => document.getElementById(id);

const areaLogin = $("area-login");
const areaApp = $("area-app");
const areaStatus = $("area-status");
const areaResultado = $("area-resultado");
const btnLogout = $("btn-logout");

// Ao carregar, verifica se o usuário já está logado no Spotify.
async function init() {
  const params = new URLSearchParams(location.search);
  if (params.get("erro")) {
    mostrarStatus(`✗ erro ao conectar: ${params.get("erro")}`, true);
    history.replaceState({}, "", "/");
  }

  const me = await fetch("/api/me").then((r) => r.json());
  if (me.logado) {
    $("usuario-nome").textContent = me.nome || "você";
    areaApp.classList.remove("hidden");
    btnLogout.classList.remove("hidden");
  } else {
    areaLogin.classList.remove("hidden");
  }
}

btnLogout.addEventListener("click", async () => {
  await fetch("/logout", { method: "POST" });
  location.href = "/";
});

$("btn-gerar").addEventListener("click", gerar);

async function gerar() {
  const prompt = $("prompt").value.trim();
  const quantidade = Number($("quantidade").value) || 20;
  if (!prompt) return mostrarStatus("✗ descreva o que você quer ouvir.", true);

  $("btn-gerar").disabled = true;
  areaResultado.classList.add("hidden");
  mostrarStatus(
    `<p class="line"><span class="spinner">⠋</span> gerando playlist... <span class="muted">(chamando a IA e buscando no Spotify)</span></p>`
  );
  animarSpinner();

  try {
    const resp = await fetch("/api/gerar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, quantidade }),
    });
    const dados = await resp.json();
    if (!resp.ok) throw new Error(dados.erro || "falha ao gerar a playlist.");
    pararSpinner();
    areaStatus.classList.add("hidden");
    mostrarResultado(dados);
  } catch (e) {
    pararSpinner();
    mostrarStatus(`✗ ${e.message}`, true);
  } finally {
    $("btn-gerar").disabled = false;
  }
}

// Spinner de texto no estilo terminal (⠋⠙⠹⠸...)
let spinnerTimer = null;
function animarSpinner() {
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let i = 0;
  spinnerTimer = setInterval(() => {
    const el = areaStatus.querySelector(".spinner");
    if (el) el.textContent = frames[(i = (i + 1) % frames.length)];
  }, 90);
}
function pararSpinner() {
  clearInterval(spinnerTimer);
  spinnerTimer = null;
}

function mostrarStatus(html, erro = false) {
  areaStatus.classList.remove("hidden");
  areaStatus.innerHTML = erro
    ? `<p class="line err-line">${html}</p>`
    : html;
}

function mostrarResultado(d) {
  const lista = d.musicas
    .map(
      (m) =>
        `<p class="line"><span class="tick">✓</span><span class="track-name">${escapar(
          m.nome
        )}</span> <span class="track-artist">— ${escapar(m.artista)}</span></p>`
    )
    .join("");

  const naoAchou = d.naoEncontradas
    .map(
      (t) =>
        `<p class="line"><span class="cross">✗</span><span class="track-artist">${escapar(
          t
        )} (não encontrada)</span></p>`
    )
    .join("");

  areaResultado.innerHTML = `
    <p class="result-head"># ${escapar(d.nome)} — ${d.total} músicas adicionadas</p>
    ${lista}
    ${naoAchou}
    <p class="line" style="margin-top:12px">
      <span class="tick">➜</span>
      <a class="spotify-link" href="${d.url}" target="_blank" rel="noopener">abrir no Spotify ↗</a>
    </p>
  `;
  areaResultado.classList.remove("hidden");
}

function escapar(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

init();
