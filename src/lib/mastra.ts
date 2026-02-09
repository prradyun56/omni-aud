import { z } from 'zod';
import OpenAI from 'openai';
import { Workflow } from '@mastra/core/workflows';
import fs from 'fs';

// Zod Schema for Financial Document Extraction
export const LineItemSchema = z.object({
    description: z.string().describe('Description of the item or service'),
    quantity: z.number().describe('Quantity of items'),
    unitPrice: z.number().describe('Price per unit'),
    totalPrice: z.number().describe('Total price for this line item'),
});

export const FinancialDocumentSchema = z.object({
    documentType: z.string().describe('Type of document (e.g., Invoice, Receipt, Bill)'),
    invoiceNumber: z.string().optional().describe('Invoice or document number'),
    invoiceDate: z.string().optional().describe('Date of the invoice (ISO format)'),
    dueDate: z.string().optional().describe('Payment due date (ISO format)'),
    vendorName: z.string().optional().describe('Name of the vendor/seller'),
    vendorAddress: z.string().optional().describe('Address of the vendor'),
    clientName: z.string().optional().describe('Name of the client/buyer'),
    clientAddress: z.string().optional().describe('Address of the client'),
    subtotal: z.number().optional().describe('Subtotal amount before tax'),
    taxAmount: z.number().optional().describe('Tax amount'),
    totalAmount: z.number().describe('Total amount to be paid'),
    currency: z.string().default('USD').describe('Currency code (e.g., USD, EUR)'),
    lineItems: z.array(LineItemSchema).optional().describe('Individual line items'),
});

export const AudioAnalysisSchema = z.object({
    sentiment: z.enum(['Positive', 'Neutral', 'Negative']).describe('Overall sentiment of the discussion'),
    speakers: z.array(z.string()).describe('List of identified speakers (e.g., Speaker 1, Speaker 2, or names if available)'),
    topics: z.array(z.string()).describe('Key financial topics discussed'),
    transcript: z.string().optional().describe('Full text transcript of the audio'),
    // Financial data extracted from audio
    documentType: z.string().optional().describe('Type of financial discussion (e.g., Debt Collection, Payment Reminder, Loan Inquiry)'),
    vendorName: z.string().optional().describe('Name of the organization/company mentioned'),
    clientName: z.string().optional().describe('Name of the customer/client'),
    totalAmount: z.number().optional().describe('Total amount mentioned in the conversation'),
    currency: z.string().optional().describe('Currency code'),
    dueDate: z.string().optional().describe('Due date mentioned (ISO format)'),
    interestRate: z.number().optional().describe('Interest rate mentioned'),
    latePaymentCharge: z.number().optional().describe('Late payment fees mentioned'),

    // Call Analysis Summary
    intent: z.string().describe('Primary intent of the call (e.g., Payment Arrangement, Dispute, Inquiry)'),
    financialEvents: z.array(z.string()).describe('List of key financial events (e.g., "Promised to pay $500", " disputed charge of $20")'),
    emotionalState: z.string().describe('Detailed emotional state of the speakers (e.g., "Customer appears stressed but cooperative")'),
    complianceNotes: z.array(z.string()).describe('Compliance related notes (e.g., "Call recording disclosure mentioned", "Mini-Miranda warning given")'),
});

export const DocumentChatSchema = z.object({
    answer: z.string().describe('Answer to the user question based on the document data'),
});

export type DocumentChatData = z.infer<typeof DocumentChatSchema>;

export type FinancialDocumentData = z.infer<typeof FinancialDocumentSchema>;
export type AudioAnalysisData = z.infer<typeof AudioAnalysisSchema>;

// Create a workflow for document processing (Keeping Workflow structure for compatibility if needed elsewhere)
export const documentProcessingWorkflow = new Workflow({
    id: 'process-financial-document',
    inputSchema: z.object({
        documentId: z.string(),
        fileContent: z.string(),
    }),
    outputSchema: z.any(),
});

// Helper function to process document with Grok
export async function extractFinancialData(
    fileContent: string
): Promise<FinancialDocumentData> {
    try {
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) throw new Error('GROQ_API_KEY is missing');

        const openai = new OpenAI({
            apiKey: apiKey,
            baseURL: "https://api.groq.com/openai/v1",
        });

        const prompt = `
            You are an expert financial document analyzer. Extract structured data from this document content.
            
            Extract the following:
            - Document type and number
            - Vendor and client information
            - Dates (invoice date, due date)
            - Financial amounts (subtotal, tax, total)
            - Line items with descriptions, quantities, and prices
            - Currency

            Return ONLY valid JSON matching this schema:
            {
                "documentType": "string",
                "invoiceNumber": "string (optional)",
                "invoiceDate": "ISO date string (optional)",
                "dueDate": "ISO date string (optional)",
                "vendorName": "string (optional)",
                "vendorAddress": "string (optional)",
                "clientName": "string (optional)",
                "clientAddress": "string (optional)",
                "subtotal": number (optional),
                "taxAmount": number (optional),
                "totalAmount": number,
                "currency": "string",
                "lineItems": [{ "description": "string", "quantity": number, "unitPrice": number, "totalPrice": number }]
            }

            Document Content:
            ${fileContent}
        `;

        const result = await openai.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "user", content: prompt }
            ],
            temperature: 0.1,
        });

        const responseText = result.choices[0].message.content || '';
        const jsonString = responseText.replace(/```json\n|\n```/g, '').replace(/```/g, '').trim();

        const data = JSON.parse(jsonString);

        return data as FinancialDocumentData;

    } catch (error: any) {
        console.error('Error extracting financial data with Groq:', error);
        throw new Error(`Failed to extract financial data from document: ${error.message}`);
    }
}

// Helper function to analyze audio with Groq (Transcription -> Analysis)
export async function analyzeAudio(filePath: string, fileType: string): Promise<AudioAnalysisData> {
    try {
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            throw new Error('GROQ_API_KEY is missing');
        }

        const openai = new OpenAI({
            apiKey: apiKey,
            baseURL: "https://api.groq.com/openai/v1",
            timeout: 120 * 1000,
        });

        console.log(`Starting audio analysis for: ${filePath}`);

        // Step 1: Transcribe the audio using Groq's Whisper model
        console.log('Step 1: Transcribing audio...');
        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(filePath),
            model: "whisper-large-v3",
            response_format: "json",
        });

        const transcriptText = transcription.text;
        console.log('Transcription complete via Groq.');

        // Step 2: Analyze the transcript using Llama 3
        console.log('Step 2: Analyzing transcript...');
        const prompt = `
            You are an expert financial audio analyst. Analyze the following transcript of a financial conversation.
            
            Transcript:
            "${transcriptText}"

            Extract the following structured data:
            - Sentiment: 'Positive', 'Neutral', or 'Negative'
            - Speakers: Identify speakers (e.g., "Agent", "Customer", "debtor")
            - Topics: Key financial topics discussed
            - Financial Details: Document type, vendor/client names, amounts, currency, dates
            
            - **Call Analysis**:
                - Intent: What is the main purpose of this call? (e.g., Payment Arrangement, Dispute)
                - Financial Events: List specific events like promises to pay, disputes, payments made.
                - Emotional State: Describe the emotional state of the speakers.
                - Compliance Notes: Note any compliance checks (recording disclosure, mini-miranda).

            Return ONLY valid JSON matching this schema:
            {
                "sentiment": "Positive" | "Neutral" | "Negative",
                "speakers": ["string"],
                "topics": ["string"],
                "transcript": "string (put the full transcript here)", // Include the full transcript provided above
                "documentType": "string (optional)",
                "vendorName": "string (optional)",
                "clientName": "string (optional)",
                "totalAmount": number (optional),
                "currency": "string (optional)",
                "dueDate": "ISO date string (optional)",
                "interestRate": number (optional),
                "latePaymentCharge": number (optional),
                
                "intent": "string",
                "financialEvents": ["string"],
                "emotionalState": "string",
                "complianceNotes": ["string"]
            }
        `;

        const completion = await openai.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: "You are a precise JSON extractor." },
                { role: "user", content: prompt }
            ],
            temperature: 0.1,
            response_format: { type: "json_object" }
        });

        const responseText = completion.choices[0].message.content || '{}';
        const analysisData = JSON.parse(responseText);

        // Ensure transcript is included if the LLM missed it
        if (!analysisData.transcript) {
            analysisData.transcript = transcriptText;
        }

        return analysisData as AudioAnalysisData;

    } catch (error: any) {
        console.error('Error analyzing audio with Groq:', error);
        throw new Error(`Failed to analyze audio with Groq: ${error.message}`);
    }
}

// Helper function to chat with document using Grok
export async function chatWithDocument(
    documentData: any,
    question: string
): Promise<DocumentChatData> {
    try {
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            throw new Error('GROQ_API_KEY is missing');
        }

        const openai = new OpenAI({
            apiKey: apiKey,
            baseURL: "https://api.groq.com/openai/v1",
        });

        const prompt = `
            You are a helpful financial assistant. Answer the user's question about this financial document.
            Be concise and specific. If the information is not available in the document, say so.

            Document Data:
            ${JSON.stringify(documentData, null, 2)}

            User Question: ${question}

            Return ONLY valid JSON matching this schema:
            {
                "answer": "Your answer here"
            }
        `;

        const result = await openai.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "user", content: prompt }
            ],
            temperature: 0.3,
        });

        const responseText = result.choices[0].message.content || '';
        const jsonString = responseText.replace(/```json\n|\n```/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(jsonString);

        return { answer: data.answer };

    } catch (error: any) {
        console.error('Error chatting with document:', error);
        throw new Error(`Failed to generate answer: ${error.message}`);
    }
}
