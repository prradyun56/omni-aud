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
 * Transcribe audio using local Whisper CLI
 * Requires 'whisper' to be in system PATH
 */
export async function transcribeAudio(
    audioPath: string,
    languageCode: string = 'hi' // Default to Hindi for now, but Whisper auto-detects
): Promise<string> {
    console.log(`🎙️ Transcribing audio locally (${languageCode})...`);

    return new Promise((resolve, reject) => {
        // Construct Whisper command
        // --model medium: Good balance of speed/accuracy
        // --task translate: Translate to English
        // --output_format json: Easy to parse
        const command = `whisper "${audioPath}" --model medium --task translate --output_format json --verbose False`;

        console.log(`   Command: ${command}`);

        import('child_process').then(({ exec }) => {
            exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
                if (error) {
                    console.error('❌ Whisper CLI error:', error.message);
                    reject(error);
                    return;
                }

                try {
                    // Whisper outputs JSON to a file or stdout? 
                    // CLI usually saves to file. Let's check if we can read the JSON file.
                    // The --output_format json flage saves a .json file
                    const jsonPath = audioPath + '.json';

                    if (fs.existsSync(jsonPath)) {
                        const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
                        const result = JSON.parse(jsonContent);

                        // Cleanup json file
                        fs.unlinkSync(jsonPath);

                        // Also cleanup other formats if generated (txt, srt, etc if default)
                        // But we specified only json. 
                        // Note: Whisper CLI might generate other files depending on version.

                        const transcript = result.text || '';
                        console.log('✅ Transcription complete');
                        resolve(transcript.trim());
                    } else {
                        // Fallback: try to parse stdout if file not found (some versions output to stdout)
                        // But usually it writes to file.
                        console.warn('⚠️ JSON file not found, checking stdout...');
                        resolve(stdout.trim());
                    }

                } catch (parseError) {
                    console.error('❌ Failed to parse transcript:', parseError);
                    reject(parseError);
                }
            });
        });
    });
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