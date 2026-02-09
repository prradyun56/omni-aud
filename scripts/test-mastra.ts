
import { analyzeAudio } from '../src/lib/mastra';
import path from 'path';
import dotenv from 'dotenv';
import process from 'process';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

async function testMastra() {
    try {
        const filePath = path.join(process.cwd(), 'sample_financial_audio.wav');
        console.log('Testing audio analysis with:', filePath);
        console.log('API Key present:', !!process.env.GROQ_API_KEY);

        const result = await analyzeAudio(filePath, 'audio/wav');
        console.log('Analysis Result:', JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Test failed:', error);
    }
}

testMastra();
