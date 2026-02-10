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
You are the "Anti-Gravity" Financial Extractor. Your sole purpose is to distill financial truth from noisy transcripts.

**INPUT CONTEXT:**
You will receive a transcription of a conversation (originally in Hindi/Indian English). It may contain translation artifacts, informal grammar ("Hinglish"), and irrelevant small talk.

**YOUR MISSION:**
1.  **Filter Gravity:** Eliminate all "heavy" useless data: greetings, weather talk, personal anecdotes, polite filler (e.g., "Namaste", "Chai piyenge?", "How are the kids?").
2.  **Extract Lift:** Extract ONLY the following financial entities:
    * **Monetary Values:** Convert all formats (Lakhs, Crores, k, M) into a standardized format (e.g., "₹50 Lakhs").
    * **Dates/Deadlines:** Specific timeframes mentioned.
    * **Entities:** Company names, bank names, stakeholders.
    * **Action Items:** Specific financial commitments or next steps.

**OUTPUT FORMAT:**
Return strictly a JSON object. Do not speak to me. Do not add markdown blocks. Just the raw JSON.

{
  "summary": "A 1-sentence executive summary of the financial topic.",
  "key_figures": [
    {"item": "Revenue Target", "value": "₹5 Crores", "context": "Mentioned by Sharma ji for Q3"}
  ],
  "dates": ["2024-03-31 (Year End closing)"],
  "risks": ["Potential delay in RBI approval"],
  "action_items": ["Submit audit report by Friday"],
  "sentiment": "Positive/Neutral/Negative",
  "speakers": ["Speaker 1", "Speaker 2"],
  "topics": ["Audit", "Payment", "Deadline"]
}
`;

                    const response = await ollama.chat({
                        model: 'llama3.2', // Ensure this model is pulled
                        messages: [
                            { role: 'system', content: SYSTEM_PROMPT },
                            { role: 'user', content: `Transcript:\n"${audioResult.transcript}"` }
                        ],
                        format: 'json', // Enforce JSON mode
                        stream: false
                    });

                    const responseText = response.message.content;
                    console.log("Raw Ollama Response:", responseText);

                    const analysis = JSON.parse(responseText);
                    console.log('✅ Analysis complete');
                    return analysis;

                } catch (error: any) {
                    console.error('Analysis error:', error);
                    // Provide a partial result so we don't fail the whole job
                    return {
                        summary: "Analysis failed due to LLM error.",
                        processingError: error.message
                    };
                }
            });

            // Step 3: Update database
            await step.run('update-database', async () => {
                await connectToDatabase();

                try {
                    const updateResult = await FinancialDocument.findByIdAndUpdate(documentId, {
                        status: 'COMPLETED',
                        // Store transcript
                        transcript: audioResult.transcript,
                        // Store audio analysis
                        sentiment: analysisData.sentiment,
                        speakers: analysisData.speakers,
                        topics: analysisData.topics,
                        // Store financial data
                        documentType: analysisData.documentType || 'Audio Call',
                        vendorName: analysisData.vendorName,
                        clientName: analysisData.clientName,
                        totalAmount: analysisData.totalAmount,
                        currency: analysisData.currency || 'USD',
                        dueDate: analysisData.dueDate,
                        // Store call analysis
                        intent: analysisData.intent,
                        financialEvents: analysisData.financialEvents,
                        emotionalState: analysisData.emotionalState,
                        complianceNotes: analysisData.complianceNotes,
                        processedAt: new Date(),
                        enhancedAudioUrl: audioResult.cleanPath ? `/uploads/${path.basename(audioResult.cleanPath)}` : undefined,
                    });

                    if (!updateResult) {
                        throw new Error(`Document with ID ${documentId} not found`);
                    }

                    console.log('✅ Database updated successfully');
                } catch (error: any) {
                    console.error('Error updating database (Audio):', error);

                    // Mark document as failed
                    await FinancialDocument.findByIdAndUpdate(documentId, {
                        status: 'FAILED',
                        processingError: error instanceof Error ? error.message : 'Unknown error',
                        processedAt: new Date(),
                    });
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
