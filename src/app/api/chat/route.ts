import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import FinancialDocument from '@/models/FinancialDocument';
import { chatWithDocument } from '@/lib/mastra';

export async function POST(request: NextRequest) {
    try {
        const { documentId, message } = await request.json();

        if (!documentId || !message) {
            return NextResponse.json(
                { error: 'documentId and message are required' },
                { status: 400 }
            );
        }

        // Connect to database and fetch document
        await connectToDatabase();
        const document = await FinancialDocument.findById(documentId).lean();

        if (!document) {
            return NextResponse.json(
                { error: 'Document not found' },
                { status: 404 }
            );
        }

        // Only allow chat on completed documents
        if (document.status !== 'COMPLETED') {
            return NextResponse.json(
                { error: 'Document is still processing or failed' },
                { status: 400 }
            );
        }

        // Get AI response
        const response = await chatWithDocument(document, message);

        return NextResponse.json({
            answer: response.answer,
            timestamp: new Date().toISOString()
        });

    } catch (error: any) {
        console.error('Chat API error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to process chat message' },
            { status: 500 }
        );
    }
}
