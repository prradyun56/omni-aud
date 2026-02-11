# Omni-Audit: Zero-Cost Local Financial Intelligence

🚀 **A completely private, offline, and free financial audio analysis system.**

This project uses **Ollama** (for reasoning) and **Whisper** (for hearing) to process financial conversations, debt collection calls, and negotiations without sending a single byte of data to the cloud.

## 🌟 Features

- **100% Local & Private**: No data leaves your machine. Perfect for sensitive financial data.
- **Zero Cost**: Runs on your consumer hardware (CPU/GPU). No API bills.
- **"Anti-Gravity" Extraction**: Specialized prompt engine to filter "heavy" small talk and extract "lift" (key financial events).
- **Multi-Modal**: Handles Audio (.wav, .m4a, .mp3) and Documents (PDFs).
- **Indian Language Support**: Native support for Hindi/Indian English accents via Whisper.
- **Smart Dashboard**: Real-time visualization of call sentiment, intent, and compliance.

---

## 🛠️ Prerequisites

Before running, ensure you have the following installed:

1.  **Node.js** (v18 or higher)
2.  **Python 3.10+** (for Whisper)
3.  **FFmpeg**: Essential for audio processing.
    *   *Windows*: `winget install ffmpeg` (or download from [ffmpeg.org](https://ffmpeg.org) and add to PATH).
4.  **Ollama**: The local LLM runner.
    *   Download from [ollama.com](https://ollama.com).
    *   **Pull the Model**: Run the following in your terminal:
        ```bash
        ollama pull llama3.2
        ```

---

## ⚡ Installation

1.  **Clone & Install Dependencies**:
    ```bash
    git clone <repo-url>
    cd devsoc2
    npm install
    ```

2.  **Install Python Dependencies (for Whisper)**:
    ```bash
    pip install -U openai-whisper setuptools-rust
    ```
    *(Note: You may need `torch` installed with CUDA support if you have an NVIDIA GPU for faster processing).*

3.  **Environment Setup**:
    Copy `.env.local.example` to `.env.local`.
    *   `MONGODB_URI`: Your local or Atlas MongoDB connection string.
    *   `GROQ_API_KEY`: (Optional) Only used if you switch back to cloud fallback.
    *   *Note: Ollama requires no API key.*

---

## 🚀 How to Run

You need 3 terminal windows to run the full stack:

### Terminal 1: Background AI Server (Inngest)
This handles the heavy lifting (transcription & analysis) so your UI never freezes.
```bash
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```
*Access Dashboard: http://localhost:8288*

### Terminal 2: Frontend (Next.js)
The main user interface.
```bash
npm run dev
```
*Access App: http://localhost:3000*

### Terminal 3: Ollama (If not running)
Make sure your local brain is active.
```bash
ollama serve
```

---

## 🧪 Testing the System

1.  Open **[http://localhost:3000/dashboard](http://localhost:3000/dashboard)**.
2.  Drag & Drop a financial audio file (e.g., `debt_collection_call.wav`).
3.  Watch the status change from **PROCESSING** to **COMPLETED**.
4.  Click the document to see:
    *   **Call Analysis**: Intent, Financial Events, Emotional State.
    *   **Enhanced Audio**: Toggle between original and noise-reduced versions.
    *   **Chat**: Ask questions like "How much did he promise to pay?"

---

## 🧩 Architecture

| Component | Technology | Role |
| :--- | :--- | :--- |
| **Ears** | **Whisper (Local)** | Transcribes audio with high accuracy (incl. accents). |
| **Brain** | **Ollama (Llama 3.2)** | Analyzes text for intent, fraud, and financial data. |
| **Nervous System** | **Inngest** | Orchestrates the multi-step pipeline (Convert -> Denoise -> Transcribe -> Analyze). |
| **Database** | **MongoDB** | Stores structured results and history. |
| **UI** | **Next.js + Lucide** | Provides a premium, responsive verification interface. |

---

## ⚠️ Common Issues

<<<<<<< HEAD
*   **"Ollama connection refused"**: Make sure `ollama serve` is running.
*   **"FFmpeg not found"**: Ensure `ffmpeg` is in your system's PATH environment variable. Restart terminals after installing.
*   **"Inngest event not triggering"**: Ensure the Inngest dev server (Terminal 1) is running AND connected to `http://localhost:3000/api/inngest`.
=======
### Future File Storage
Replace local disk storage with cloud storage:
- AWS S3
- Cloudflare R2
- UploadThing
- Vercel Blob

### Environment Variables
Update `.env.local` with production values:
- Real MongoDB cluster URI
- Production Inngest keys from https://app.inngest.com
- Production OpenAI API key with billing enabled

### Deploy to Vercel
```bash
vercel deploy
```

## Challenge Extensions

### Audio Processing (Challenge 1)
The system includes a placeholder for audio processing. To implement:

1. Use the `processFinancialAudio` function in `lib/inngest/functions.ts`
2. Add Whisper API for transcription
3. Modify Mastra prompts to extract speakers and sentiment
4. Update schema to store audio-specific data

### Advanced Features
- Batch processing
- Discrepancy detection
- Email notifications (Future)
- Webhook integrations

## Troubleshooting

**Issue**: MongoDB connection fails
- Check your `MONGODB_URI` in `.env.local`
- Ensure MongoDB cluster allows connections from your IP

**Issue**: Inngest jobs not running
- Make sure `npx inngest-cli@latest dev` is running
- Check Inngest dashboard at http://localhost:8288

**Issue**: AI extraction fails
- Verify `OPENAI_API_KEY` is valid
- Check OpenAI API quota and billing

## License

MIT
>>>>>>> acab201f8a529d097ffff6e635924a7639b3b371
