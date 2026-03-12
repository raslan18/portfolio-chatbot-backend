import OpenAI from "openai"
import { createClient } from "@supabase/supabase-js"

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  const { message, history = [] } = req.body

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  })

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  )

  /* Embed the user question */

  const embeddingResponse =
    await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: message
    })

  const [{ embedding }] = embeddingResponse.data

  /* Retrieve relevant portfolio data */

  const { data: matches } =
    await supabase.rpc("match_embeddings", {
      query_embedding: embedding,
      match_threshold: 0.78,
      match_count: 5
    })

  const context =
    matches?.map(m => m.content).join("\n") || ""

  /* Build conversation */

  const messages = [

    {
      role: "system",
      content: `
You are RAI, the AI assistant inside the portfolio of product designer Muhammed Raslan.

Answer questions about Raslan's:
- projects
- design process
- experience
- tools
- impact

Use the provided context when relevant.

Be concise and clear because recruiters are reading your answers.
`
    },

    ...history.map(m => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.text
    })),

    {
      role: "user",
      content: `Context:\n${context}\n\nQuestion: ${message}`
    }
  ]

  /* Ask OpenAI */

  const completion =
    await openai.chat.completions.create({
      model: "gpt-4.1",
      messages
    })

  return res.status(200).json({
    reply: completion.choices[0].message.content
  })
}
