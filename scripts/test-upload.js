
const fs = require('fs');
const path = require('path');

async function testUpload() {
    try {
        const filePath = path.join(process.cwd(), 'debt_collection_call.wav');
        if (!fs.existsSync(filePath)) {
            console.error('debt_collection_call.wav not found');
            process.exit(1);
        }

        const stats = fs.statSync(filePath);
        const fileSizeInBytes = stats.size;
        console.log(`File found: ${filePath} (${fileSizeInBytes} bytes)`);

        const fileBuffer = fs.readFileSync(filePath);
        const blob = new Blob([fileBuffer], { type: 'audio/wav' });

        const formData = new FormData();
        formData.append('file', blob, 'debt_collection_call.wav');
        // formData.append('userId', 'test-user'); // optional

        console.log('Uploading debt_collection_call.wav...');
        const response = await fetch('http://localhost:3000/api/upload', {
            method: 'POST',
            body: formData
        });

        console.log('Status:', response.status);
        const text = await response.text();
        console.log('Response text:', text);

        try {
            const data = JSON.parse(text);
            console.log('Response JSON:', JSON.stringify(data, null, 2));
        } catch (e) {
            console.log('Response is not JSON');
        }

        if (response.ok) {
            console.log('Upload successful!');
        } else {
            console.error('Upload failed');
            process.exit(1);
        }

    } catch (error) {
        console.error('Error during upload:', error);
        if (error.cause) console.error('Cause:', error.cause);
        process.exit(1);
    }
}

testUpload();
