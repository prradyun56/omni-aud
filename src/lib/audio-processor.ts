import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';

/**
 * FIXED FFmpeg Path Resolution
 * We manually construct the path to avoid the 'package.json' resolve error 
 * triggered by the standard @ffmpeg-installer import.
 */
const getFFmpegPath = () => {
    // If we are on Windows (your Acer Predator)
    if (process.platform === 'win32') {
        return path.join(
            process.cwd(),
            'node_modules',
            '@ffmpeg-installer',
            'win32-x64',
            'ffmpeg.exe'
        );
    }
    // For production/Linux (Vercel, Render, etc.)
    // These environments usually have ffmpeg pre-installed in the path
    return 'ffmpeg'; 
};

// Set the path explicitly to bypass the library's internal auto-discovery logic
ffmpeg.setFfmpegPath(getFFmpegPath());

/**
 * Convert M4A/MP3 audio to WAV format optimized for speech recognition
 */
export async function convertToWAV(inputPath: string): Promise<string> {
    const ext = path.extname(inputPath).toLowerCase();

    if (ext === '.wav') {
        console.log('✅ Audio already in WAV format');
        return inputPath;
    }

    const outputPath = inputPath.replace(/\.(m4a|mp3|mp4)$/i, '.wav');
    console.log(`🔄 Converting ${ext} to WAV format...`);

    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .toFormat('wav')
            .audioFrequency(16000)  // 16kHz - optimal for speech recognition
            .audioChannels(1)       // Mono
            .audioBitrate('256k')
            .on('end', () => {
                console.log('✅ Conversion complete:', outputPath);
                resolve(outputPath);
            })
            .on('error', (err) => {
                console.error('❌ Conversion failed:', err.message);
                reject(new Error(`Audio conversion failed: ${err.message}`));
            })
            .on('progress', (progress) => {
                if (progress.percent) {
                    console.log(`   Processing: ${Math.round(progress.percent)}% done`);
                }
            })
            .save(outputPath);
    });
}

/**
 * Apply noise reduction filters to audio using FFmpeg
 */
export async function reduceNoise(inputPath: string): Promise<string> {
    const outputPath = inputPath.replace('.wav', '_clean.wav');
    console.log('🔇 Applying noise reduction filters...');

    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .audioFilters([
                'highpass=f=200',      // Remove low-frequency rumble
                'lowpass=f=3000',     // Remove high-frequency hiss
                'afftdn=nf=-25',       // FFT-based denoising
            ])
            .on('end', () => {
                console.log('✅ Noise reduction complete:', outputPath);
                resolve(outputPath);
            })
            .on('error', (err) => {
                console.error('❌ Noise reduction failed:', err.message);
                console.log('⚠️ Falling back to original audio');
                resolve(inputPath);
            })
            .save(outputPath);
    });
}

/**
 * Transcribe audio using Hugging Face Inference API
 */
export async function transcribeAudio(
    audioPath: string,
    languageCode: string = 'hi-IN'
): Promise<string> {
    console.log(`🎙️ Transcribing audio (${languageCode})...`);

    try {
        const HF_TOKEN = process.env.HUGGINGFACE_API_TOKEN;

        if (!HF_TOKEN) {
            throw new Error('HUGGINGFACE_API_TOKEN not found in environment variables.');
        }

        const modelMap: Record<string, string> = {
            'hi-IN': 'ai4bharat/whisper-medium-hi',
            'ta-IN': 'ai4bharat/whisper-medium-ta',
            'te-IN': 'ai4bharat/whisper-medium-te',
            'en-IN': 'openai/whisper-large-v3',
            'bn-IN': 'openai/whisper-large-v3',
            'mr-IN': 'openai/whisper-large-v3',
            'gu-IN': 'openai/whisper-large-v3',
        };

        const model = modelMap[languageCode] || 'openai/whisper-large-v3';
        console.log(`   Using model: ${model}`);

        const audioBuffer = fs.readFileSync(audioPath);

        const response = await fetch(
            `https://api-inference.huggingface.co/models/${model}`,
            {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${HF_TOKEN}` },
                body: audioBuffer,
            }
        );

        if (!response.ok) {
            if (response.status === 503) {
                console.log('⏳ Model is loading, retrying in 20 seconds...');
                await new Promise(resolve => setTimeout(resolve, 20000));
                
                const retryResponse = await fetch(
                    `https://api-inference.huggingface.co/models/${model}`,
                    {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${HF_TOKEN}` },
                        body: audioBuffer,
                    }
                );
                
                if (!retryResponse.ok) throw new Error(`HF API error: ${retryResponse.status}`);
                const retryResult = await retryResponse.json();
                return retryResult.text || '';
            }
            throw new Error(`HF API error: ${response.status}`);
        }

        const result = await response.json();
        return result.text || '';

    } catch (error: any) {
        console.error('❌ Transcription error:', error.message);
        throw error;
    }
}

/**
 * Complete audio processing pipeline
 */
export async function processAudioComplete(
    filePath: string,
    languageCode: string = 'hi-IN'
): Promise<{
    transcript: string;
    wavPath: string;
    cleanPath: string;
    tempFiles: string[];
}> {
    console.log('🚀 Starting complete audio processing pipeline...');
    const tempFiles: string[] = [];

    try {
        const wavPath = await convertToWAV(filePath);
        if (wavPath !== filePath) tempFiles.push(wavPath);

        const cleanPath = await reduceNoise(wavPath);
        if (cleanPath !== wavPath) tempFiles.push(cleanPath);

        const transcript = await transcribeAudio(cleanPath, languageCode);
        console.log('✅ Audio processing pipeline complete!');

        return { transcript, wavPath, cleanPath, tempFiles };

    } catch (error: any) {
        // Cleanup on failure
        for (const file of tempFiles) {
            if (fs.existsSync(file)) fs.unlinkSync(file);
        }
        throw error;
    }
}

export function cleanupTempFiles(files: string[]): void {
    for (const file of files) {
        try {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
                console.log('🗑️ Cleaned up:', path.basename(file));
            }
        } catch (error) {
            console.error('Failed to delete temp file:', file);
        }
    }
}

export const SUPPORTED_LANGUAGES = {
    'Hindi': 'hi-IN',
    'Tamil': 'ta-IN',
    'Telugu': 'te-IN',
    'Bengali': 'bn-IN',
    'Marathi': 'mr-IN',
    'Gujarati': 'gu-IN',
    'Kannada': 'kn-IN',
    'Malayalam': 'ml-IN',
    'Punjabi': 'pa-Guru-IN',
    'Urdu': 'ur-IN',
    'English (India)': 'en-IN',
} as const;