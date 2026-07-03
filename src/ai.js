const OLLAMA_URL =
  (process.env.OLLAMA_URL || "http://127.0.0.1:11434") + "/api/chat";
const MODEL = process.env.OLLAMA_MODEL || "llama3.2:3b";

/**
 * Recebe um prompt em linguagem natural (cantores, gêneros, clima, etc.)
 * e devolve uma lista de músicas [{ artist, title }] usando um modelo local via Ollama.
 */
export async function gerarMusicas(prompt, quantidade = 20) {
  const qtd = Math.min(Math.max(Number(quantidade) || 20, 1), 50);

  let resp;
  try {
    resp = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        stream: false,
        format: "json",
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
  } catch {
    throw new Error(
      "Não foi possível conectar ao Ollama. Verifique se ele está rodando (ollama serve)."
    );
  }

  if (!resp.ok) {
    throw new Error(`Erro no Ollama (${resp.status}): ${await resp.text()}`);
  }

  const data = await resp.json();
  const texto = data?.message?.content?.trim();

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
