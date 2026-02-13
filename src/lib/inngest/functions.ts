import { inngest } from './client';
import { connectToDatabase } from '../mongoose';
import FinancialDocument from '../../models/FinancialDocument';
import { extractFinancialData } from '../mastra';
import { processAudioComplete, cleanupTempFiles, SUPPORTED_LANGUAGES } from '../audio-processor';
import fs from 'fs';
import path from 'path';
import { Ollama } from 'ollama'; // Local LLM
import OpenAI from 'openai'; // Keep OpenAI for legacy textual docs if needed, but we use Ollama for audio

// Background function to process financial documents (PDF/Images)
export const processFinancialDocument = inngest.createFunction(
    {
        id: 'process-financial-document',
        name: 'Process Financial Document with AI',
        throttle: {
            limit: 5,
            period: '1m',
        },
    },
    { event: 'app/document.uploaded' },
    async ({ event, step }) => {
        const { documentId, filePath } = event.data;

        // Step 1: Read the file content
        const fileContent = await step.run('read-file', async () => {
            try {
                if (!fs.existsSync(filePath)) {
                    throw new Error(`File not found at path: ${filePath}`);
                }
                return await fs.promises.readFile(filePath, 'utf-8');
            } catch (error: any) {
                console.error('Error reading file:', error);
                throw new Error(`Failed to read uploaded file: ${error.message}`);
            }
        });

        // Step 2: Extract data using AI (Mastra)
        const extractedData = await step.run('extract-data-with-ai', async () => {
            try {
                return await extractFinancialData(fileContent);
            } catch (error: any) {
                console.error('Error extracting data:', error);
                throw new Error(`AI Extraction Failed: ${error.message}`);
            }
        });

        // Step 3: Update database with extracted data
        await step.run('update-database', async () => {
            await connectToDatabase();

            try {
                const updateResult = await FinancialDocument.findByIdAndUpdate(documentId, {
                    status: 'COMPLETED',
                    documentType: extractedData.documentType,
                    invoiceNumber: extractedData.invoiceNumber,
                    invoiceDate: extractedData.invoiceDate
                        ? new Date(extractedData.invoiceDate)
                        : undefined,
                    dueDate: extractedData.dueDate
                        ? new Date(extractedData.dueDate)
                        : undefined,
                    vendorName: extractedData.vendorName,
                    vendorAddress: extractedData.vendorAddress,
                    clientName: extractedData.clientName,
                    clientAddress: extractedData.clientAddress,
                    subtotal: extractedData.subtotal,
                    taxAmount: extractedData.taxAmount,
                    totalAmount: extractedData.totalAmount,
                    currency: extractedData.currency,
                    lineItems: extractedData.lineItems,
                    processedAt: new Date(),
                });

                if (!updateResult) {
                    throw new Error(`Document with ID ${documentId} not found`);
                }

                return { success: true };
            } catch (error: any) {
                console.error('Error updating database:', error);

                // Mark document as failed
                await FinancialDocument.findByIdAndUpdate(documentId, {
                    status: 'FAILED',
                    processingError: error instanceof Error ? error.message : 'Unknown error',
                    processedAt: new Date(),
                });

                throw error;
            }
        });

        return { documentId, status: 'completed' };
    }
);

// Background function for audio processing with enhanced M4A support and Google Cloud transcription
export const processFinancialAudio = inngest.createFunction(
    {
        id: 'process-financial-audio-enhanced',
        name: 'Process Financial Audio (M4A + Indian Languages)',
        throttle: {
            limit: 2,
            period: '1m',
        },
    },
    { event: 'app/audio.uploaded' },
    async ({ event, step }) => {
        const { documentId, filePath, language = 'hi-IN' } = event.data;
        let tempFiles: string[] = [];

        try {
            // Step 1: Process Audio (Convert + Denoise + Transcribe)
            const audioResult = await step.run('process-audio-pipeline', async () => {
                try {
                    if (!fs.existsSync(filePath)) {
                        throw new Error(`Audio file not found at path: ${filePath}`);
                    }

                    console.log(`🎵 Processing audio file locally: ${filePath}`);

                    // Call local pipeline (Convert -> Denoise -> Whisper CLI)
                    const result = await processAudioComplete(filePath, language);

                    if (!result.transcript || result.transcript.trim().length === 0) {
                        throw new Error('Transcription resulted in empty text');
                    }

                    return {
                        transcript: result.transcript,
                        cleanPath: result.cleanPath,
                        tempFiles: result.tempFiles
                    };
                } catch (error: any) {
                    console.error('Audio processing error:', error);
                    throw new Error(`Failed to process audio: ${error.message}`);
                }
            });

            // Step 2: Analyze transcript with Ollama (Local Llama 3.2)
            const analysisData = await step.run('analyze-transcript', async () => {
                try {
                    console.log('🤖 Analyzing transcript with Local Ollama (Anti-Gravity)...');

                    const ollama = new Ollama(); // connects to localhost:11434 by default

                    const SYSTEM_PROMPT = `
You are a highly intelligent financial analyst AI. Your task is to extract structured financial data from a conversation transcript.

**STRICT OUTPUT RULES:**
1.  **Output ONLY valid JSON.**
2.  Do NOT include markdown formatting (like \`\`\`json ... \`\`\`).
3.  Do NOT include any introductory or concluding text.
4.  If a field is not mentioned, use null or an empty array [].
5.  **Sentiment** must be one of: "Positive", "Neutral", "Negative".

**DATA SCHEMAS:**
- **Money:** formatted as string (e.g., "₹5 Lakhs", "$500").
- **Date:** formatted as YYYY-MM-DD if possible, else original text.

**REQUIRED JSON STRUCTURE:**
{
  "summary": "1-2 sentence summary of the financial discussion.",
  "key_figures": [{"item": "Description", "value": "Amount/Value", "context": "Context"}],
  "dates": ["YYYY-MM-DD", "Deadline description"],
  "risks": ["Risk 1", "Risk 2"],
  "action_items": ["Action 1", "Action 2"],
  "sentiment": "Neutral",
  "speakers": ["Name 1", "Name 2"],
  "topics": ["Topic 1", "Topic 2"],
  "intent": "Primary purpose of call",
  "financialEvents": ["Event description"],
  "emotionalState": "Calm/Angry/Confused",
  "complianceNotes": ["Note 1"],
  "documentType": "Audio Call",
  "vendorName": null,
  "clientName": null,
  "totalAmount": null,
  "currency": "USD",
  "dueDate": null
}
`;

                    const response = await ollama.chat({
                        model: 'llama3.2', // Ensure this model is pulled
                        messages: [
                            { role: 'system', content: SYSTEM_PROMPT },
                            { role: 'user', content: `Analyze the following transcript:\n\n"${audioResult.transcript}"` }
                        ],
                        format: 'json', // Enforce JSON mode
                        stream: false
                    });

                    const responseText = response.message.content;
                    console.log("Raw Ollama Response:", responseText);

                    // Robust JSON Parsing
                    let analysis;
                    try {
                        // 1. Try direct parse
                        analysis = JSON.parse(responseText);
                    } catch (e) {
                        console.warn("⚠️ Direct JSON parse failed. Attempting cleanup...");
                        // 2. Try stripping markdown code blocks
                        const cleanText = responseText.replace(/```json\n|\n```|```/g, '').trim();
                        try {
                            analysis = JSON.parse(cleanText);
                        } catch (e2) {
                            console.error("❌ Failed to parse JSON even after cleanup.", e2);
                            throw new Error("Invalid JSON extraction from LLM.");
                        }
                    }

                    console.log('✅ Analysis complete');
                    return analysis;

                } catch (error: any) {
                    console.error('Analysis error:', error);
                    // Provide a partial result so we don't fail the whole job
                    return {
                        summary: "Analysis failed due to LLM error. Please review the transcript manually.",
                        processingError: error.message,
                        // Return empty defaults to avoid DB update failures
                        sentiment: "Neutral",
                        speakers: [],
                        topics: [],
                        financialEvents: [],
                        complianceNotes: []
                    };
                }
            });

            // Step 3: Update database
            await step.run('update-database', async () => {
                console.log('🔄 Connecting to database for update...');
                await connectToDatabase();
                console.log('✅ Database connected.');

                try {
                    console.log('📄 Updating document:', documentId);

                    // Normalize sentiment to match Schema Enum
                    let sentiment = analysisData.sentiment;
                    const validSentiments = ['Positive', 'Neutral', 'Negative'];

                    if (sentiment && typeof sentiment === 'string' && sentiment.trim().length > 0) {
                        // Capitalize first letter, lowercase rest
                        sentiment = sentiment.charAt(0).toUpperCase() + sentiment.slice(1).toLowerCase();
                        if (!validSentiments.includes(sentiment)) {
                            console.warn(`⚠️ Invalid sentiment "${analysisData.sentiment}" received. Defaulting to Neutral.`);
                            sentiment = 'Neutral';
                        }
                    } else {
                        // Default to Neutral if missing or empty string to avoid Validation Error
                        sentiment = 'Neutral';
                    }

                    // Helper to normalize array fields (handle strings, arrays of objects, etc.)
                    const normalizeStringArray = (input: any): string[] => {
                        if (!input) return [];

                        let arr = input;
                        // specific handling if it's a string looking like an array
                        if (typeof input === 'string') {
                            try {
                                const parsed = JSON.parse(input);
                                if (Array.isArray(parsed)) arr = parsed;
                                else return [input];
                            } catch (e) {
                                return [input];
                            }
                        }

                        if (!Array.isArray(arr)) {
                            return [String(arr)];
                        }

                        return arr.map((item: any) => {
                            if (typeof item === 'string') return item;
                            if (typeof item === 'object' && item !== null) {
                                // Extract common fields if present, else stringify
                                const distinctValues = [item.description, item.amount, item.value, item.item, item.risk, item.action]
                                    .filter(v => v && typeof v === 'string' || typeof v === 'number');

                                if (distinctValues.length > 0) {
                                    return distinctValues.join(': ');
                                }
                                return JSON.stringify(item);
                            }
                            return String(item);
                        });
                    };

                    const updateData = {
                        status: 'COMPLETED',
                        // Store transcript
                        transcript: audioResult.transcript,
                        // Store audio analysis
                        sentiment: sentiment,
                        speakers: normalizeStringArray(analysisData.speakers),
                        topics: normalizeStringArray(analysisData.topics),
                        // Store financial data
                        documentType: analysisData.documentType || 'Audio Call',
                        vendorName: analysisData.vendorName,
                        clientName: analysisData.clientName,
                        totalAmount: analysisData.totalAmount,
                        currency: analysisData.currency || 'USD',
                        dueDate: analysisData.dueDate,
                        // Store call analysis
                        intent: typeof analysisData.intent === 'string' ? analysisData.intent : JSON.stringify(analysisData.intent),
                        financialEvents: normalizeStringArray(analysisData.financialEvents),
                        emotionalState: analysisData.emotionalState,
                        complianceNotes: normalizeStringArray(analysisData.complianceNotes),
                        processedAt: new Date(),
                        enhancedAudioUrl: audioResult.cleanPath ? `/uploads/${path.basename(audioResult.cleanPath)}` : undefined,
                    };

                    console.log('📝 Update payload:', JSON.stringify(updateData, null, 2));

                    const updateResult = await FinancialDocument.findByIdAndUpdate(documentId, updateData, { new: true, runValidators: true });

                    if (!updateResult) {
                        throw new Error(`Document with ID ${documentId} not found during update`);
                    }

                    console.log('✅ Database updated successfully:', updateResult._id);
                    return { success: true, id: updateResult._id };
                } catch (error: any) {
                    console.error('❌ Error updating database (Audio):', error);
                    console.error('Stack:', error.stack);

                    // Mark document as failed
                    try {
                        await FinancialDocument.findByIdAndUpdate(documentId, {
                            status: 'FAILED',
                            processingError: error instanceof Error ? error.message : 'Unknown error during DB update',
                            processedAt: new Date(),
                        });
                        console.log('⚠️ Document marked as FAILED in DB.');
                    } catch (markError) {
                        console.error('🔥 CRITICAL: Failed to mark document as FAILED:', markError);
                    }

                    throw error;
                }
            });

            // Step 4: Cleanup temporary files
            await step.run('cleanup', async () => {
                if (tempFiles.length > 0) {
                    // IMPORTANT: Do NOT delete the 'cleanPath' file as we are now serving it
                    // Filter out the cleanPath from tempFiles before deleting
                    const filesToDelete = tempFiles.filter(f => f !== audioResult.cleanPath);
                    cleanupTempFiles(filesToDelete);
                }
            });

            return {
                documentId,
                status: 'completed',
                transcriptLength: audioResult.transcript.length,
            };

        } catch (error: any) {
            // Cleanup on error
            if (tempFiles.length > 0) {
                cleanupTempFiles(tempFiles);
            }
            throw error;
        }
    }
);
