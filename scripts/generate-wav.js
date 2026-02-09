
const fs = require('fs');
const path = require('path');

function writeWavFile(filename, durationSeconds, sampleRate = 44100, frequency = 440) {
    const numChannels = 1;
    const bytesPerSample = 2; // 16-bit
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const numSamples = sampleRate * durationSeconds;
    const dataSize = numSamples * blockAlign;
    const bufferSize = 36 + 8 + dataSize; // Header is 44 bytes

    const buffer = Buffer.alloc(bufferSize);

    // RIFF chunk descriptor
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataSize, 4); // ChunkSize
    buffer.write('WAVE', 8);

    // fmt sub-chunk
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
    buffer.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(16, 34); // BitsPerSample

    // data sub-chunk
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);

    // Generate sine wave data
    for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const amplitude = 32760; // Slightly less than max 16-bit
        const value = Math.sin(2 * Math.PI * frequency * t) * amplitude;
        buffer.writeInt16LE(Math.floor(value), 44 + i * 2);
    }

    const filePath = path.join(process.cwd(), filename);
    fs.writeFileSync(filePath, buffer);
    console.log(`Generated ${filename} (${durationSeconds}s, ${frequency}Hz)`);
    return filePath;
}

try {
    writeWavFile('sample_financial_audio.wav', 3, 44100, 440);
} catch (error) {
    console.error('Error generating WAV file:', error);
}
