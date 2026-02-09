import { connectToDatabase } from '@/lib/mongoose';
import FinancialDocument from '@/models/FinancialDocument';
import FinancialReview from '@/components/FinancialReview';
import { notFound } from 'next/navigation';

interface PageProps {
    params: Promise<{ id: string }> | { id: string };
}

export default async function DocumentDetailPage({ params }: PageProps) {
    // Await params if it's a promise (Next.js 15+)
    const resolvedParams = await params;
    const { id } = resolvedParams;

    await connectToDatabase();

    // Fetch document data directly from database (server-side)
    const doc = await FinancialDocument.findById(id).lean();

    if (!doc) {
        return notFound();
    }

    // Transform MongoDB object to plain JSON for React client component
    const serializedDoc = JSON.parse(JSON.stringify(doc));

    return (
        <FinancialReview
            pdfUrl={doc.fileUrl || `/uploads/${doc._id}.pdf`}
            initialData={serializedDoc}
        />
    );
}

// Generate metadata for the page
export async function generateMetadata({ params }: PageProps) {
    const resolvedParams = await params;
    const { id } = resolvedParams;

    await connectToDatabase();
    const doc = await FinancialDocument.findById(id).lean();

    if (!doc) {
        return {
            title: 'Document Not Found',
        };
    }

    return {
        title: `${doc.fileName} - Financial Document Review`,
        description: `Review and analyze ${doc.fileName} with AI-extracted data`,
    };
}
