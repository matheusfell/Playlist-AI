const AUTH_URL = "https://accounts.spotify.com/authorize";
const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API = "https://api.spotify.com/v1";

// Permissões que pedimos ao usuário: ler o perfil e criar/editar playlists.
const SCOPES = [
  "playlist-modify-public",
  "playlist-modify-private",
  "user-read-private",
].join(" ");

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI;

/** Monta a URL para onde o usuário é enviado para autorizar o app. */
export function urlDeLogin(state) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    scope: SCOPES,
    redirect_uri: REDIRECT_URI,
    state,
    // Força a tela de consentimento a aparecer sempre, garantindo que os
    // escopos de escrita de playlist sejam (re)concedidos.
    show_dialog: "true",
  });
  return `${AUTH_URL}?${params.toString()}`;
}

/** Troca o "code" recebido no callback por tokens de acesso. */
export async function trocarCodePorToken(code) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
  });
  return requisitarToken(body);
}

/** Renova o access_token usando o refresh_token. */
export async function renovarToken(refreshToken) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  return requisitarToken(body);
}

async function requisitarToken(body) {
  const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const resp = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!resp.ok) {
    throw new Error(`Falha ao obter token do Spotify: ${await resp.text()}`);
  }
  return resp.json();
}

async function api(token, caminho, opcoes = {}) {
  const resp = await fetch(`${API}${caminho}`, {
    ...opcoes,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(opcoes.headers || {}),
    },
  });
  if (!resp.ok) {
    throw new Error(`Erro na API do Spotify (${resp.status}): ${await resp.text()}`);
  }
  return resp.status === 204 ? null : resp.json();
}

/** Dados do usuário logado. */
export function meusDados(token) {
  return api(token, "/me");
}

/** Busca uma música e retorna a URI da melhor correspondência (ou null). */
export async function buscarMusica(token, artist, title) {
  const q = encodeURIComponent(`track:${title} artist:${artist}`);
  let dados = await api(token, `/search?q=${q}&type=track&limit=1`);
  let item = dados?.tracks?.items?.[0];

  // Fallback: busca mais solta se a busca estruturada não achou nada.
  if (!item) {
    const q2 = encodeURIComponent(`${title} ${artist}`);
    dados = await api(token, `/search?q=${q2}&type=track&limit=1`);
    item = dados?.tracks?.items?.[0];
  }
  return item ? { uri: item.uri, nome: item.name, artista: item.artists[0]?.name } : null;
}

/** Cria uma playlist na conta do usuário. */
export async function criarPlaylist(token, userId, nome, descricao) {
  return api(token, `/users/${userId}/playlists`, {
    method: "POST",
    body: JSON.stringify({ name: nome, description: descricao, public: false }),
  });
}

/** Adiciona faixas (em lotes de 100) à playlist. */
export async function adicionarFaixas(token, playlistId, uris) {
  for (let i = 0; i < uris.length; i += 100) {
    await api(token, `/playlists/${playlistId}/tracks`, {
      method: "POST",
      body: JSON.stringify({ uris: uris.slice(i, i + 100) }),
    });
  }
}
