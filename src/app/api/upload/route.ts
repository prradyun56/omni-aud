import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import FinancialDocument from '@/models/FinancialDocument';
import { inngest } from '@/lib/inngest/client';
import fs from 'fs/promises';
import path from 'path';

export async function POST(req: NextRequest) {
    try {
        await connectToDatabase();

        // Parse form data
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const userId = formData.get('userId') as string | null;

        if (!file) {
            return NextResponse.json(
                { error: 'No file provided' },
                { status: 400 }
            );
        }

        // Validate file type
        const allowedTypes = [
            'application/pdf',
            'image/png',
            'image/jpeg',
            'text/plain',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'audio/mpeg',
            'audio/wav',
            'audio/mp3' // Sometimes mp3 is uploaded as audio/mp3
        ];

        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json(
                { error: 'Invalid file type. Allowed: PDF, PNG, JPG, TXT, DOCX, MP3, WAV' },
                { status: 400 }
            );
        }

        // Create upload directory if it doesn't exist
        const uploadDir = path.join(process.cwd(), 'public', 'uploads');
        try {
            await fs.mkdir(uploadDir, { recursive: true });
        } catch (error) {
            console.error('Error creating upload directory:', error);
        }

        // Save file to disk
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Create unique filename
        const timestamp = Date.now();
        const fileName = `${timestamp}-${file.name}`;
        const filePath = path.join(uploadDir, fileName);

        await fs.writeFile(filePath, buffer);

        // Create database record with PROCESSING status
        const document = await FinancialDocument.create({
            fileName: file.name,
            fileUrl: `/uploads/${fileName}`,
            fileType: file.type,
            userId: userId || undefined,
            status: 'PROCESSING',
            uploadedAt: new Date(),
        });

        // Trigger background processing with Inngest based on file type
        const isAudio = file.type.startsWith('audio/');
        const eventName = isAudio ? 'app/audio.uploaded' : 'app/document.uploaded';

        await inngest.send({
            name: eventName,
            data: {
                documentId: document._id.toString(),
                filePath: filePath,
                fileName: file.name,
                fileType: file.type,
            },
        });

        return NextResponse.json({
            success: true,
            documentId: document._id.toString(),
            message: 'File uploaded successfully and processing started',
        });

    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json(
            {
                error: 'Failed to upload file',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
