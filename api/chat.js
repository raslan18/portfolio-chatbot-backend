import OpenAI from "openai"
import { createClient } from "@supabase/supabase-js"

export default async function handler(req, res) {

  /* ---------------- CORS ---------------- */

  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")

  if (req.method === "OPTIONS") {
    return res.status(200).end()
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {

    const { message, history = [] } = req.body

    /* ---------------- OpenAI ---------------- */

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })

    /* ---------------- Supabase ---------------- */

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    )

    /* ---------------- Create embedding ---------------- */

    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: message
    })

    const [{ embedding }] = embeddingResponse.data

    /* ---------------- Vector search ---------------- */

    const { data: matches } = await supabase.rpc(
      "match_embeddings",
      {
        query_embedding: embedding,
        match_threshold: 0.78,
        match_count: 5
      }
    )

    const context =
      matches?.map((m) => m.content).join("\n") || ""

    /* ---------------- Conversation memory ---------------- */

    const messages = [

      {
        role: "system",
        content: `
You are RAI, the AI assistant inside the portfolio of product designer Muhammed Raslan.

Your job is to help recruiters understand Raslan’s:

• projects
• design process
• experience
• skills
• product thinking
• impact

Always answer clearly and concisely.

Use the provided portfolio context when relevant.
`
      },

      ...history.map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.text
      })),

      {
        role: "user",
        content: `Context:\n${context}\n\nQuestion:\n${message}`
      }
    ]

    /* ---------------- Ask OpenAI ---------------- */

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages
    })

    const reply =
      completion.choices[0].message.content

    /* ---------------- Response ---------------- */

    return res.status(200).json({
      reply
    })

  } catch (error) {

    console.error("Chat API error:", error)

    return res.status(500).json({
      error: "Internal server error"
    })

  }
}
