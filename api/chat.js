import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { message } = req.body;

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

  const embeddingResponse = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: message
  });

  const [{ embedding }] = embeddingResponse.data;

  const { data: matches } = await supabase.rpc("match_embeddings", {
    query_embedding: embedding,
    match_threshold: 0.78,
    match_count: 5
  });

  const context = matches.map(m => m.content).join("\n");

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1",
    messages: [
      {
        role: "system",
        content: `
You are an assistant inside the portfolio of a product designer (Muhammed Raslan).
Answer using the context. Be concise.
If you don't know something, say you don't have that information yet.
`
      },
      {
        role: "user",
        content: `Context:\n${context}\n\nQuestion: ${message}`
      }
    ]
  });

  return res.status(200).json({
    reply: completion.choices[0].message.content
  });
}
