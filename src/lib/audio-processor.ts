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
// ... inside src/lib/audio-processor.ts

export async function transcribeAudio(
    audioPath: string,
    languageCode: string = 'hi'
): Promise<string> {
    // 1. Setup Paths
    const absolutePath = path.resolve(audioPath);
    const outputDir = path.dirname(absolutePath);
    const fileName = path.basename(absolutePath);
    const fileNameNoExt = path.parse(absolutePath).name;

    console.log(`🎙️ Transcribing: ${fileName}`);

    // 2. PRE-CLEANUP: Delete potential old output files to prevent "Skipping"
    const potentialFiles = [
        path.join(outputDir, `${fileNameNoExt}.json`),
        path.join(outputDir, `${fileName}.json`),
        path.join(outputDir, `${fileNameNoExt}.wav.json`)
    ];

    potentialFiles.forEach(f => {
        if (fs.existsSync(f)) {
            try { fs.unlinkSync(f); } catch (e) { /* ignore */ }
        }
    });

    return new Promise((resolve, reject) => {
        // 3. Command: Added --language to force translation if needed
        const command = `whisper "${absolutePath}" --model medium --language ${languageCode === 'hi-IN' ? 'hi' : 'en'} --task translate --output_format json --output_dir "${outputDir}" --verbose False`;

        console.log(`🚀 Executing: ${command}`);

        // 0. Inject FFmpeg Path
        const ffmpegPath = getFFmpegPath();
        const ffmpegDir = path.dirname(ffmpegPath);

        // Append FFmpeg directory to existing PATH
        const env = {
            ...process.env,
            PATH: `${ffmpegDir}${path.delimiter}${process.env.PATH}`
        };

        import('child_process').then(({ exec }) => {
            exec(command, {
                maxBuffer: 1024 * 1024 * 10,
                env: env // Pass the modified environment
            }, (error, stdout, stderr) => {
                if (error) {
                    console.error('❌ Whisper CLI Error:', error.message);
                    // Don't reject yet, sometimes it writes the file anyway
                }

                // 4. Find the new file
                let foundFile = null;
                for (const p of potentialFiles) {
                    if (fs.existsSync(p)) {
                        foundFile = p;
                        break;
                    }
                }

                try {
                    if (foundFile) {
                        const jsonContent = fs.readFileSync(foundFile, 'utf-8');
                        fs.unlinkSync(foundFile); // Cleanup
                        const result = JSON.parse(jsonContent);
                        resolve(result.text.trim());
                    } else {
                        // Fallback: Check stdout, but filter out "Skipping" messages
                        const cleanStdout = stdout.trim();
                        if (cleanStdout && !cleanStdout.startsWith("Skipping")) {
                            resolve(cleanStdout);
                        } else {
                            throw new Error("Whisper skipped processing or failed to generate output.");
                        }
                    }
                } catch (err: any) {
                    reject(err);
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