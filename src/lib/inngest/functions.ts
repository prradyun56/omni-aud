import { inngest } from './client';
import { connectToDatabase } from '../mongoose';
import FinancialDocument from '../../models/FinancialDocument';
import { extractFinancialData } from '../mastra';
import { processAudioComplete, cleanupTempFiles, SUPPORTED_LANGUAGES } from '../audio-processor';
import fs from 'fs';
import OpenAI from 'openai';

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

                    console.log(`🎵 Processing audio file: ${filePath}`);
                    console.log(`🌐 Language: ${language}`);

                    // Use Hugging Face for transcription (or fallback to Groq)
                    let transcript = '';
                    let usedHuggingFace = false;

                    try {
                        // Try Hugging Face Inference API first (FREE + Indian languages)
                        const result = await processAudioComplete(filePath, language);
                        transcript = result.transcript;
                        tempFiles = result.tempFiles;
                        usedHuggingFace = true;
                        console.log('✅ Used Hugging Face Inference API');
                    } catch (hfError: any) {
                        console.warn('⚠️ Hugging Face transcription failed, falling back to Groq Whisper');
                        console.warn('Error:', hfError.message);

                        // Fallback to Groq Whisper (English only, but works without extra credentials)
                        const apiKey = process.env.GROQ_API_KEY;
                        if (!apiKey) {
                            throw new Error('Both Hugging Face and Groq credentials are missing');
                        }

                        const openai = new OpenAI({
                            apiKey: apiKey,
                            baseURL: "https://api.groq.com/openai/v1",
                            timeout: 120 * 1000,
                        });

                        // Use original file or converted WAV if available
                        const audioFile = fs.existsSync(filePath.replace(/\.(m4a|mp3)$/i, '.wav'))
                            ? filePath.replace(/\.(m4a|mp3)$/i, '.wav')
                            : filePath;

                        const transcription = await openai.audio.transcriptions.create({
                            file: fs.createReadStream(audioFile),
                            model: "whisper-large-v3",
                            response_format: "json",
                        });

                        transcript = transcription.text;
                        usedHuggingFace = false;
                        console.log('✅ Used Groq Whisper (fallback)');
                    }

                    if (!transcript || transcript.trim().length === 0) {
                        throw new Error('Transcription resulted in empty text');
                    }

                    return { transcript, usedHuggingFace };
                } catch (error: any) {
                    console.error('Audio processing error:', error);
                    throw new Error(`Failed to process audio: ${error.message}`);
                }
            });

            // Step 2: Analyze transcript with Groq Llama
            const analysisData = await step.run('analyze-transcript', async () => {
                try {
                    const apiKey = process.env.GROQ_API_KEY;
                    if (!apiKey) {
                        throw new Error('GROQ_API_KEY is missing');
                    }

                    const openai = new OpenAI({
                        apiKey: apiKey,
                        baseURL: "https://api.groq.com/openai/v1",
                    });

                    console.log('🤖 Analyzing transcript with Groq Llama...');

                    const prompt = `
                        You are an expert financial audio analyst. Analyze the following transcript of a financial conversation.
                        
                        Transcript:
                        "${audioResult.transcript}"

                        Extract the following structured data:
                        - Sentiment: 'Positive', 'Neutral', or 'Negative'
                        - Speakers: Identify speakers (e.g., "Agent", "Customer", "Debtor")
                        - Topics: Key financial topics discussed
                        - Financial Details: Document type, vendor/client names, amounts, currency, dates
                        
                        - **Call Analysis**:
                            - Intent: What is the main purpose of this call?
                            - Financial Events: List specific events like promises to pay, disputes, payments made
                            - Emotional State: Describe the emotional state of the speakers
                            - Compliance Notes: Note any compliance checks (recording disclosure, warnings)

                        Return ONLY valid JSON matching this schema:
                        {
                            "sentiment": "Positive" | "Neutral" | "Negative",
                            "speakers": ["string"],
                            "topics": ["string"],
                            "documentType": "string (optional)",
                            "vendorName": "string (optional)",
                            "clientName": "string (optional)",
                            "totalAmount": number (optional),
                            "currency": "string (optional)",
                            "dueDate": "ISO date string (optional)",
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
                    const analysis = JSON.parse(responseText);

                    console.log('✅ Analysis complete');
                    return analysis;
                } catch (error: any) {
                    console.error('Analysis error:', error);
                    throw new Error(`Failed to analyze transcript: ${error.message}`);
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
                    cleanupTempFiles(tempFiles);
                }
            });

            return {
                documentId,
                status: 'completed',
                transcriptLength: audioResult.transcript.length,
                usedHuggingFace: audioResult.usedHuggingFace
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
