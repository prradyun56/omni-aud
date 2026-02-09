const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

// Mock fs and process.cwd for the test if running outside of Next.js context context
// But since we are running node directly, we need to handle the import of mastra.ts which acts as a module
// transforming it to a simple script that imports the necessary parts or mocking them might be complex due to TS.
// Instead, let's create a standalone script that duplicates the logic for testing purposes, 
// OR use ts-node if available.
// Given the environment, a standalone script similar to the implementation is safer to avoid TS compilation issues.

const fs = require('fs');
const OpenAI = require('openai');

async function testGroqAudio() {
    console.log("Testing Groq Audio Analysis...");

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        console.error('ERROR: GROQ_API_KEY is not set in .env.local');
        return;
    }

    const openai = new OpenAI({
        apiKey: apiKey,
        baseURL: "https://api.groq.com/openai/v1",
        timeout: 120 * 1000, // 120 seconds
    });

    const filePath = path.join(process.cwd(), 'mortgage_underwater.wav');

    try {
        if (!fs.existsSync(filePath)) {
            console.error(`File not found: ${filePath}`);
            return;
        }

        console.log(`1. Transcribing ${filePath} using whisper-large-v3...`);

        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(filePath),
            model: "whisper-large-v3",
            response_format: "json",
        });

        console.log("Transcription Result:", transcription.text);

        console.log("2. Analyzing transcript using llama-3.3-70b-versatile...");

        const prompt = `
            You are an expert financial audio analyst. Analyze the following transcript of a financial conversation.
            
            Transcript:
            "${transcription.text}"

            Extract the following structured data:
            - Sentiment: 'Positive', 'Neutral', or 'Negative'
            - Speakers: Identify speakers (e.g., "Agent", "Customer", "debtor")
            - Topics: Key financial topics discussed
            - Financial Details: Document type, vendor/client names, amounts, currency, dates

            Return ONLY valid JSON matching this schema:
            {
                "sentiment": "Positive" | "Neutral" | "Negative",
                "speakers": ["string"],
                "topics": ["string"],
                "transcript": "string",
                "documentType": "string (optional)",
                "vendorName": "string (optional)",
                "clientName": "string (optional)",
                "totalAmount": number (optional),
                "currency": "string (optional)",
                "dueDate": "ISO date string (optional)",
                "interestRate": number (optional),
                "latePaymentCharge": number (optional)
            }
        `;

        const completion = await openai.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: "You are a precise JSON extractor." },
                { role: "user", content: prompt }
            ],
            temperature: 0.1,
            response_format: { type: "json_object" }
        });

        const analysisData = JSON.parse(completion.choices[0].message.content);
        console.log("Analysis Result:", JSON.stringify(analysisData, null, 2));
        console.log("✓ SUCCESS: Groq Audio Analysis pipeline works!");

    } catch (error) {
        console.error("✗ FAILED: Groq Audio Analysis failed");
        console.error(error);
    }
}

testGroqAudio();
