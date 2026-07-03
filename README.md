# 🎧 PlaylistAi

Gera playlists no Spotify a partir de um prompt (cantores, gêneros, clima…) usando um modelo de IA do OpenRouter para escolher as músicas e a API do Spotify para criar a playlist na sua conta.

## Como funciona

1. Você faz login com o Spotify (OAuth).
2. Digita um prompt, ex: _"rock nacional dos anos 80 pra viajar de carro"_.
3. Um modelo do **OpenRouter** sugere uma lista de músicas.
4. O app procura cada música no **Spotify** e cria a playlist na sua conta.

## Estrutura

```
PlaylistAi/
├── server.js          # Servidor Express + OAuth + rota /api/gerar
├── src/
│   ├── ai.js          # Geração das músicas via OpenRouter
│   └── spotify.js     # Login, busca e criação de playlist no Spotify
├── public/            # Frontend (HTML, CSS, JS)
├── .env.example       # Modelo das variáveis de ambiente
└── package.json
```

## Instalação

```bash
npm install
cp .env.example .env   # no Windows/PowerShell: copy .env.example .env
```

Depois preencha o `.env` (veja o passo a passo abaixo) e rode:

```bash
npm start        # ou: npm run dev  (reinicia sozinho ao salvar)
```

Acesse **http://127.0.0.1:3000**

---

## Passo a passo — configurar a API do Spotify

1. Acesse **https://developer.spotify.com/dashboard** e faça login.
2. Clique em **Create app**.
3. Preencha:
   - **App name**: PlaylistAi (ou o nome que quiser)
   - **App description**: qualquer coisa
   - **Redirect URI**: `http://127.0.0.1:3000/callback`
     ⚠️ Precisa ser **idêntico** ao valor de `SPOTIFY_REDIRECT_URI` no `.env`.
     Clique em **Add** depois de digitar.
   - Em **Which API/SDKs are you planning to use?** marque **Web API**.
4. Aceite os termos e clique em **Save**.
5. Abra o app criado → **Settings**. Copie:
   - **Client ID** → cole em `SPOTIFY_CLIENT_ID`
   - **Client secret** (clique em _View client secret_) → cole em `SPOTIFY_CLIENT_SECRET`
6. **Modo de desenvolvimento**: por padrão só você (dono do app) consegue logar.
   Para liberar outras pessoas, vá em **User Management** e adicione o e-mail/nome
   Spotify delas — ou solicite _Extended Quota Mode_ para uso público.

> Observação sobre o Redirect URI: o Spotify **não aceita mais `localhost`**, use
> `http://127.0.0.1:3000/callback`. Se um dia publicar o site, adicione também a URL
> `https://seudominio.com/callback` no dashboard e no `.env`.

## Passo a passo — configurar o OpenRouter

1. Acesse **https://openrouter.ai** e faça login (Google/GitHub).
2. Vá em **Keys** (https://openrouter.ai/keys) → **Create Key**.
3. Copie a chave (começa com `sk-or-...`) e cole em `OPENROUTER_API_KEY` no `.env`.
4. Escolha um modelo **gratuito** (terminam em `:free`) na lista
   https://openrouter.ai/models?max_price=0 e coloque o ID em `OPENROUTER_MODEL`.
   Sugestão: `meta-llama/llama-3.3-70b-instruct:free`.

> Para os modelos gratuitos **não é preciso cadastrar cartão**. O tier grátis tem
> limite de requisições (~20/min e um teto diário); para gerar playlists de vez em
> quando é de sobra. Se um modelo `:free` estiver indisponível, é só trocar o
> `OPENROUTER_MODEL` por outro da lista.

## O arquivo `.env`

```env
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/callback

OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=meta-llama/llama-3.3-70b-instruct:free

PORT=3000
SESSION_SECRET=uma_string_aleatoria_longa
```

## Problemas comuns

| Erro | Causa provável |
|------|----------------|
| `INVALID_CLIENT: Invalid redirect URI` | O Redirect URI no dashboard ≠ do `.env`. |
| `state_invalido` no callback | Cookies bloqueados ou sessão expirada; tente de novo. |
| Login falha para outra pessoa | Adicione o usuário em **User Management** no dashboard. |
| `401` ao gerar | Sessão do Spotify expirou; faça login novamente. |
| Erro `401` do OpenRouter | `OPENROUTER_API_KEY` inválida ou ausente. |
| Erro `429` / rate limit | Limite do tier gratuito atingido; espere ou troque o modelo. |
| `404` de modelo | ID em `OPENROUTER_MODEL` errado ou modelo `:free` fora do ar. |
