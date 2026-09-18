const express = require('express');
const app = express();
app.use(express.json());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

app.post('/', async (req, res) => {
    const userPrompt = req.body.prompt;
    const systemPrompt = req.body.system || "Te Verity vagy, egy barátságos NPC.";

    try {
        const fetch = (await import('node-fetch')).default;
        const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ]
            })
        });

        const data = await aiResponse.json();
        const replyText = data.choices[0].message.content;

        res.json({ reply: replyText });
    } catch (error) {
        console.error("OpenAI hiba:", error);
        res.status(500).json({ reply: "Hiba történt az AI feldolgozás során." });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
