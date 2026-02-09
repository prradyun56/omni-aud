/**
 * Test script for audio processing pipeline
 * Run with: npx tsx scripts/test-audio-processing.ts
 */

import { processAudioComplete, SUPPORTED_LANGUAGES, cleanupTempFiles } from '../src/lib/audio-processor';
import fs from 'fs';
import path from 'path';

async function testAudioProcessing() {
    console.log('🧪 Testing Audio Processing Pipeline\n');
    console.log('═'.repeat(60));

    // Find a test audio file
    const testFiles = [
        './debt_collection_call.wav',
        './financial_conversation.wav',
        './sample_financial_audio.wav',
    ];

    let testFile: string | null = null;
    for (const file of testFiles) {
        if (fs.existsSync(file)) {
            testFile = file;
            break;
        }
    }

    if (!testFile) {
        console.log('❌ No test audio files found');
        console.log('   Please ensure you have audio files in the project root');
        return;
    }

    console.log(`📁 Test File: ${testFile}`);
    console.log(`📏 File Size: ${(fs.statSync(testFile).size / 1024).toFixed(2)} KB\n`);

    try {
        // Test 1: Check if Google Cloud credentials are configured
        console.log('Test 1: Checking Google Cloud credentials...');
        const hasCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
        if (hasCredentials) {
            console.log('✅ Google Cloud credentials configured');
            console.log(`   Path: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}\n`);
        } else {
            console.log('⚠️  Google Cloud credentials not configured');
            console.log('   Will use Groq Whisper fallback\n');
        }

        // Test 2: Process the audio file
        console.log('Test 2: Processing audio file...');
        console.log('   This may take 15-30 seconds...\n');

        const startTime = Date.now();

        const result = await processAudioComplete(testFile, 'en-IN');

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log('═'.repeat(60));
        console.log('✅ AUDIO PROCESSING SUCCESSFUL!\n');
        console.log(`⏱️  Processing Time: ${duration} seconds`);
        console.log(`📝 Transcript Length: ${result.transcript.length} characters\n`);

        console.log('Transcript Preview:');
        console.log('─'.repeat(60));
        const preview = result.transcript.substring(0, 500);
        console.log(preview);
        if (result.transcript.length > 500) {
            console.log('... (truncated)');
        }
        console.log('─'.repeat(60));

        console.log('\n📂 Generated Files:');
        console.log(`   WAV: ${path.basename(result.wavPath)}`);
        console.log(`   Clean: ${path.basename(result.cleanPath)}\n`);

        // Test 3: Verify cleanup works
        console.log('Test 3: Testing file cleanup...');
        cleanupTempFiles(result.tempFiles);
        console.log('✅ Cleanup successful\n');

        console.log('═'.repeat(60));
        console.log('🎉 ALL TESTS PASSED!\n');

        console.log('Next Steps:');
        console.log('1. Upload an M4A file through your app');
        console.log('2. Check the Inngest dashboard for processing status');
        console.log('3. Verify transcription in MongoDB\n');

    } catch (error: any) {
        console.log('═'.repeat(60));
        console.log('❌ TEST FAILED\n');
        console.error('Error:', error.message);

        if (error.message.includes('GOOGLE_APPLICATION_CREDENTIALS')) {
            console.log('\n💡 Solution: Set up Google Cloud credentials');
            console.log('   See: google_cloud_setup.md for instructions');
        }

        if (error.message.includes('API has not been used')) {
            console.log('\n💡 Solution: Enable Speech-to-Text API in Google Cloud Console');
        }

        console.log('\n⚠️  Note: If Google Cloud is not configured, the system will');
        console.log('   automatically fall back to Groq Whisper in production.');
    }
}

// Display supported languages
function displaySupportedLanguages() {
    console.log('\n📚 Supported Languages:');
    console.log('─'.repeat(60));
    Object.entries(SUPPORTED_LANGUAGES).forEach(([name, code]) => {
        console.log(`   ${name.padEnd(20)} → ${code}`);
    });
    console.log('─'.repeat(60));
}

// Run tests
console.log('\n');
testAudioProcessing()
    .then(() => {
        displaySupportedLanguages();
    })
    .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
