import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ILineItem {
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
}

export interface IFinancialDocument extends Document {
    fileName: string;
    fileUrl?: string;
    fileType: string;
    uploadedAt: Date;
    status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
    userId?: string;

    // Extracted Data
    documentType?: string;
    invoiceNumber?: string;
    invoiceDate?: Date;
    dueDate?: Date;
    vendorName?: string;
    vendorAddress?: string;
    clientName?: string;
    clientAddress?: string;
    subtotal?: number;
    taxAmount?: number;
    totalAmount?: number;
    currency?: string;
    lineItems?: ILineItem[];

    // Audio Analysis Data
    transcript?: string;
    sentiment?: 'Positive' | 'Neutral' | 'Negative';
    speakers?: string[];
    topics?: string[];

    // Call Analysis Data
    intent?: string;
    financialEvents?: string[];
    emotionalState?: string;
    complianceNotes?: string[];

    // Metadata
    processingError?: string;
    processedAt?: Date;
}

const LineItemSchema = new Schema({
    description: { type: String, required: true },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    totalPrice: { type: Number, required: true },
}, { _id: false });

const FinancialDocumentSchema = new Schema<IFinancialDocument>({
    fileName: { type: String, required: true },
    fileUrl: { type: String },
    fileType: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
    status: {
        type: String,
        enum: ['PROCESSING', 'COMPLETED', 'FAILED'],
        default: 'PROCESSING',
        required: true
    },
    userId: { type: String, index: true },

    // Extracted Data
    documentType: { type: String },
    invoiceNumber: { type: String },
    invoiceDate: { type: Date },
    dueDate: { type: Date },
    vendorName: { type: String },
    vendorAddress: { type: String },
    clientName: { type: String },
    clientAddress: { type: String },
    subtotal: { type: Number },
    taxAmount: { type: Number },
    totalAmount: { type: Number },
    currency: { type: String, default: 'USD' },
    lineItems: [LineItemSchema],

    // Audio Analysis Data
    transcript: { type: String },
    sentiment: { type: String, enum: ['Positive', 'Neutral', 'Negative'] },
    speakers: [{ type: String }],
    topics: [{ type: String }],

    // Call Analysis Data
    intent: { type: String },
    financialEvents: [{ type: String }],
    emotionalState: { type: String },
    complianceNotes: [{ type: String }],

    // Metadata
    processingError: { type: String },
    processedAt: { type: Date },
}, {
    timestamps: true,
    collection: 'financial_documents'
});

// Create indexes for efficient querying
FinancialDocumentSchema.index({ status: 1, uploadedAt: -1 });
FinancialDocumentSchema.index({ userId: 1, uploadedAt: -1 });

// Prevent model recompilation in development
const FinancialDocument: Model<IFinancialDocument> =
    mongoose.models.FinancialDocument ||
    mongoose.model<IFinancialDocument>('FinancialDocument', FinancialDocumentSchema);

export default FinancialDocument;
