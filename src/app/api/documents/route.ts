import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import FinancialDocument from '@/models/FinancialDocument';

export async function GET(req: NextRequest) {
    try {
        await connectToDatabase();

        // Get query parameters
        const searchParams = req.nextUrl.searchParams;
        const userId = searchParams.get('userId');
        const status = searchParams.get('status');
        const limit = parseInt(searchParams.get('limit') || '50');

        // Build query
        const query: any = {};

        if (userId) {
            query.userId = userId;
        }

        if (status) {
            query.status = status;
        }

        // Fetch documents
        const documents = await FinancialDocument
            .find(query)
            .sort({ uploadedAt: -1 })
            .limit(limit)
            .lean();

        // Convert MongoDB ObjectIds to strings for JSON serialization
        const serializedDocuments = documents.map(doc => ({
            ...doc,
            _id: doc._id.toString(),
        }));

        return NextResponse.json({
            success: true,
            documents: serializedDocuments,
            count: serializedDocuments.length,
        });

    } catch (error) {
        console.error('Error fetching documents:', error);
        return NextResponse.json(
            {
                error: 'Failed to fetch documents',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
