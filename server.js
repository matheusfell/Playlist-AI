import "dotenv/config";
import crypto from "node:crypto";
import express from "express";
import session from "express-session";

import { gerarMusicas } from "./src/ai.js";
import * as spotify from "./src/spotify.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("public"));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "troque-isso",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 }, // 1h
  })
);

// Garante que temos um access_token válido, renovando se necessário.
async function tokenValido(req) {
  if (!req.session.tokens) return null;
  const { access_token, refresh_token, expira_em } = req.session.tokens;
  if (Date.now() < expira_em - 60_000) return access_token;

  const novo = await spotify.renovarToken(refresh_token);
  req.session.tokens.access_token = novo.access_token;
  req.session.tokens.expira_em = Date.now() + novo.expires_in * 1000;
  if (novo.refresh_token) req.session.tokens.refresh_token = novo.refresh_token;
  return novo.access_token;
}

// 1) Inicia o login no Spotify
app.get("/login", (req, res) => {
  const state = crypto.randomBytes(16).toString("hex");
  req.session.state = state;
  res.redirect(spotify.urlDeLogin(state));
});

// 2) Callback do OAuth: troca o code por tokens
app.get("/callback", async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.redirect("/?erro=" + encodeURIComponent(error));
  if (!code || state !== req.session.state) {
    return res.redirect("/?erro=state_invalido");
  }
  try {
    const t = await spotify.trocarCodePorToken(code);
    req.session.tokens = {
      access_token: t.access_token,
      refresh_token: t.refresh_token,
      expira_em: Date.now() + t.expires_in * 1000,
    };
    // Diagnóstico: mostra quais permissões o Spotify realmente concedeu.
    console.log("🔑 Escopos concedidos pelo Spotify:", t.scope || "(nenhum)");
    const user = await spotify.meusDados(t.access_token);
    req.session.userId = user.id;
    req.session.userNome = user.display_name;
    console.log(`👤 Logado como ${user.display_name} (id: ${user.id})`);
    res.redirect("/");
  } catch (e) {
    res.redirect("/?erro=" + encodeURIComponent(e.message));
  }
});

// Status de login (o frontend consulta ao carregar)
app.get("/api/me", async (req, res) => {
  const token = await tokenValido(req).catch(() => null);
  if (!token) return res.json({ logado: false });
  res.json({ logado: true, nome: req.session.userNome, id: req.session.userId });
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// 3) Gera a playlist: IA -> busca no Spotify -> cria e preenche a playlist
app.post("/api/gerar", async (req, res) => {
  try {
    const token = await tokenValido(req);
    if (!token) return res.status(401).json({ erro: "Faça login no Spotify primeiro." });

    const { prompt, quantidade } = req.body;
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ erro: "Descreva o que você quer na playlist." });
    }

    // 3.1 A IA sugere as músicas
    const { nome, musicas } = await gerarMusicas(prompt, quantidade);

    // 3.2 Procura cada música no Spotify
    const encontradas = [];
    const naoEncontradas = [];
    for (const m of musicas) {
      const r = await spotify.buscarMusica(token, m.artist, m.title);
      if (r) encontradas.push(r);
      else naoEncontradas.push(`${m.artist} - ${m.title}`);
    }

    if (encontradas.length === 0) {
      return res.status(422).json({ erro: "Nenhuma música encontrada no Spotify." });
    }

    // 3.3 Cria a playlist e adiciona as faixas
    const playlist = await spotify.criarPlaylist(
      token,
      req.session.userId,
      nome,
      `Gerada por IA a partir de: "${prompt}"`
    );
    await spotify.adicionarFaixas(token, playlist.id, encontradas.map((e) => e.uri));

    res.json({
      nome,
      url: playlist.external_urls.spotify,
      total: encontradas.length,
      musicas: encontradas,
      naoEncontradas,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`▶  PlaylistAi rodando em http://127.0.0.1:${PORT}`);
});
