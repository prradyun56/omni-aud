const OpenAI = require('openai');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

async function testGroq() {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
        console.error('ERROR: GROQ_API_KEY is not set in .env.local');
        return;
    }

    const openai = new OpenAI({
        apiKey: apiKey,
        baseURL: "https://api.groq.com/openai/v1",
    });

    try {
        console.log("Testing Groq API with llama-3.3-70b-versatile...");
        const result = await openai.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "user", content: "Hello! Please respond with a brief greeting." }
            ],
            temperature: 0.1,
        });

        console.log("✓ SUCCESS: Groq API works!");
        console.log("Response:", result.choices[0].message.content);
    } catch (error) {
        console.error("✗ FAILED: Groq API test failed");
        console.error(error);
    }
}

testGroq();
