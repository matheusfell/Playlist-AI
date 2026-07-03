const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL =
  process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free";

/**
 * Recebe um prompt em linguagem natural (cantores, gêneros, clima, etc.)
 * e devolve uma lista de músicas [{ artist, title }] usando um modelo do OpenRouter.
 */
export async function gerarMusicas(prompt, quantidade = 20) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY não configurada no .env");
  }

  const qtd = Math.min(Math.max(Number(quantidade) || 20, 1), 50);

  const resp = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      // Opcionais, mas recomendados pelo OpenRouter (aparecem no ranking do app):
      "HTTP-Referer": "http://127.0.0.1:3000",
      "X-Title": "PlaylistAi",
    },
    body: JSON.stringify({
      model: MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Você é um curador musical especialista. A partir do pedido do usuário, " +
            "monte uma playlist coerente. Responda APENAS com um JSON válido, sem texto " +
            "extra e sem markdown, no formato: " +
            '{"nome":"<nome criativo para a playlist>","musicas":[{"artist":"<artista>","title":"<música>"}]}. ' +
            "Use músicas reais e existentes. Não repita músicas.",
        },
        {
          role: "user",
          content: `Monte uma playlist com ${qtd} músicas para o seguinte pedido: "${prompt}"`,
        },
      ],
    }),
  });

  if (!resp.ok) {
    throw new Error(`Erro no OpenRouter (${resp.status}): ${await resp.text()}`);
  }

  const data = await resp.json();
  const texto = data?.choices?.[0]?.message?.content?.trim();

  if (!texto) {
    throw new Error("O modelo não retornou nenhuma resposta.");
  }

  const json = extrairJson(texto);

  if (!json || !Array.isArray(json.musicas)) {
    throw new Error("A IA não retornou uma lista de músicas válida.");
  }

  return {
    nome: json.nome || "Playlist gerada por IA",
    musicas: json.musicas
      .filter((m) => m && m.artist && m.title)
      .slice(0, qtd),
  };
}

// Extrai o objeto JSON mesmo se a IA envolver em ```json ... ```
function extrairJson(texto) {
  try {
    return JSON.parse(texto);
  } catch {
    const inicio = texto.indexOf("{");
    const fim = texto.lastIndexOf("}");
    if (inicio !== -1 && fim !== -1) {
      try {
        return JSON.parse(texto.slice(inicio, fim + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}
