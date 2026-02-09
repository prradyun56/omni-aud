import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import fs from 'fs';
import path from 'path';

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

/**
 * Convert M4A/MP3 audio to WAV format optimized for speech recognition
 * @param inputPath Path to input audio file
 * @returns Path to converted WAV file
 */
export async function convertToWAV(inputPath: string): Promise<string> {
    const ext = path.extname(inputPath).toLowerCase();

    // If already WAV, return as-is
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
            .audioChannels(1)        // Mono - speech doesn't need stereo
            .audioBitrate('256k')    // Good quality
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
 * @param inputPath Path to input WAV file
 * @returns Path to cleaned audio file
 */
export async function reduceNoise(inputPath: string): Promise<string> {
    const outputPath = inputPath.replace('.wav', '_clean.wav');

    console.log('🔇 Applying noise reduction filters...');

    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .audioFilters([
                'highpass=f=200',      // Remove low-frequency rumble (AC, traffic)
                'lowpass=f=3000',      // Remove high-frequency hiss
                'afftdn=nf=-25',       // FFT-based denoising
            ])
            .on('end', () => {
                console.log('✅ Noise reduction complete:', outputPath);
                resolve(outputPath);
            })
            .on('error', (err) => {
                console.error('❌ Noise reduction failed:', err.message);
                // If noise reduction fails, return original
                console.log('⚠️ Falling back to original audio');
                resolve(inputPath);
            })
            .save(outputPath);
    });
}

/**
 * Transcribe audio using Hugging Face Inference API (100% FREE!)
 * Supports AI4Bharat models for Indian languages
 * 
 * @param audioPath Path to WAV audio file
 * @param languageCode Language code (e.g., 'hi-IN' for Hindi, 'ta-IN' for Tamil)
 * @returns Transcribed text
 */
export async function transcribeAudio(
    audioPath: string,
    languageCode: string = 'hi-IN'
): Promise<string> {
    console.log(`🎙️ Transcribing audio (${languageCode})...`);

    try {
        const HF_TOKEN = process.env.HUGGINGFACE_API_TOKEN;

        if (!HF_TOKEN) {
            throw new Error(
                'HUGGINGFACE_API_TOKEN not found. Get your free token from https://huggingface.co/settings/tokens'
            );
        }

        // Map language codes to AI4Bharat models
        const modelMap: Record<string, string> = {
            'hi-IN': 'ai4bharat/whisper-medium-hi',      // Hindi
            'ta-IN': 'ai4bharat/whisper-medium-ta',      // Tamil
            'te-IN': 'ai4bharat/whisper-medium-te',      // Telugu
            'en-IN': 'openai/whisper-large-v3',          // English/Hinglish
            'bn-IN': 'openai/whisper-large-v3',          // Bengali (fallback)
            'mr-IN': 'openai/whisper-large-v3',          // Marathi (fallback)
            'gu-IN': 'openai/whisper-large-v3',          // Gujarati (fallback)
        };

        const model = modelMap[languageCode] || 'openai/whisper-large-v3';

        console.log(`   Using model: ${model}`);

        // Read audio file as buffer
        const audioBuffer = fs.readFileSync(audioPath);

        // Call Hugging Face Inference API
        const response = await fetch(
            `https://api-inference.huggingface.co/models/${model}`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${HF_TOKEN}`,
                },
                body: audioBuffer,
            }
        );

        if (!response.ok) {
            const errorText = await response.text();

            // Handle model loading (first request might take longer)
            if (response.status === 503) {
                console.log('⏳ Model is loading, retrying in 20 seconds...');
                await new Promise(resolve => setTimeout(resolve, 20000));

                // Retry once
                const retryResponse = await fetch(
                    `https://api-inference.huggingface.co/models/${model}`,
                    {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${HF_TOKEN}`,
                        },
                        body: audioBuffer,
                    }
                );

                if (!retryResponse.ok) {
                    throw new Error(`Hugging Face API error: ${retryResponse.status} - ${await retryResponse.text()}`);
                }

                const retryResult = await retryResponse.json();
                const transcript = retryResult.text || '';

                console.log('✅ Transcription complete (after retry)');
                console.log(`   Transcript length: ${transcript.length} characters`);

                return transcript;
            }

            throw new Error(`Hugging Face API error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        const transcript = result.text || '';

        if (!transcript || transcript.trim().length === 0) {
            console.log('⚠️ No transcription results returned');
            return '';
        }

        console.log('✅ Transcription complete');
        console.log(`   Transcript length: ${transcript.length} characters`);

        return transcript;

    } catch (error: any) {
        console.error('❌ Transcription error:', error.message);

        // Provide helpful error messages
        if (error.message.includes('HUGGINGFACE_API_TOKEN')) {
            throw new Error(
                'Hugging Face token not configured. Get your free token from: https://huggingface.co/settings/tokens'
            );
        }

        if (error.message.includes('401') || error.message.includes('403')) {
            throw new Error(
                'Invalid Hugging Face token. Please check your HUGGINGFACE_API_TOKEN in .env.local'
            );
        }

        throw new Error(`Failed to transcribe audio: ${error.message}`);
    }
}

/**
 * Complete audio processing pipeline
 * Converts format → Reduces noise → Transcribes
 * 
 * @param filePath Path to audio file (M4A, MP3, or WAV)
 * @param languageCode Language code for transcription
 * @returns Object containing transcript and paths to generated files
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
        // Step 1: Convert to WAV
        const wavPath = await convertToWAV(filePath);
        if (wavPath !== filePath) {
            tempFiles.push(wavPath);
        }

        // Step 2: Reduce noise
        const cleanPath = await reduceNoise(wavPath);
        if (cleanPath !== wavPath) {
            tempFiles.push(cleanPath);
        }

        // Step 3: Transcribe
        const transcript = await transcribeAudio(cleanPath, languageCode);

        console.log('✅ Audio processing pipeline complete!');

        return {
            transcript,
            wavPath,
            cleanPath,
            tempFiles,
        };

    } catch (error: any) {
        // Cleanup temp files on error
        for (const file of tempFiles) {
            try {
                if (fs.existsSync(file)) {
                    fs.unlinkSync(file);
                }
            } catch (cleanupError) {
                console.error('Failed to cleanup temp file:', file);
            }
        }

        throw error;
    }
}

/**
 * Cleanup temporary audio files
 * @param files Array of file paths to delete
 */
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

/**
 * Get supported language codes
 * https://cloud.google.com/speech-to-text/docs/speech-to-text-supported-languages
 */
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
