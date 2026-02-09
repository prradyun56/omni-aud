# Omni-audit - Financial Document Intelligence System

🚀 AI-powered financial document processing using Next.js, MongoDB, Mastra, and Inngest.

## Features

- **AI Document Extraction**: Automatically extract structured data from invoices, receipts, and financial documents
- **Background Processing**: Asynchronous AI processing using Inngest to avoid timeouts
- **Real-time Dashboard**: Track document processing status with live updates
- **Premium UI**: Modern, responsive interface with drag-and-drop file uploads
- **Comprehensive Data**: Extract vendor/client info, line items, totals, dates, and more

## Tech Stack

- **Frontend**: Next.js 14+ (App Router), React, TypeScript
- **Backend**: Next.js API Routes
- **Database**: MongoDB with Mongoose
- **AI**: Mastra + Zod Schema + OpenAI GPT-4
- **Background Jobs**: Inngest
- **UI**: Lucide React icons, date-fns

## Project Structure

```
/src
 ├── /lib
 │    ├── mastra.ts          # AI Agent & Zod Schema
 │    ├── mongoose.ts        # Database connection
 │    └── /inngest
 │         ├── client.ts     # Inngest client
 │         └── functions.ts  # Background workers
 ├── /models
 │    └── FinancialDocument.ts # MongoDB Schema
 ├── /components
 │    ├── FinancialReview.tsx  # Document detail view
 │    └── FileUpload.tsx       # Upload component
 ├── /app
 │    ├── /api
 │    │    ├── /upload         # File upload endpoint
 │    │    ├── /inngest        # Background jobs webhook
 │    │    └── /documents      # Fetch documents endpoint
 │    └── /dashboard
 │         ├── page.tsx        # Document listing
 │         └── [id]/page.tsx   # Document detail
```

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Copy `.env.local.example` to `.env.local` and configure:

```env
MONGODB_URI="mongodb+srv://..."
OPENAI_API_KEY="sk-..."
INNGEST_EVENT_KEY="local"
INNGEST_SIGNING_KEY="local"
```

### 3. Start the Development Server

Start Next.js:
```bash
npm run dev
```

In a **separate terminal**, start Inngest dev server:
```bash
npx inngest-cli@latest dev
```

This opens the Inngest dashboard at http://localhost:8288 to monitor background jobs.

### 4. Access the Application

- **Dashboard**: http://localhost:3000/dashboard
- **Inngest Dashboard**: http://localhost:8288

## How It Works

1. **Upload**: User uploads a financial document via drag-and-drop
2. **Storage**: File is saved locally (or to S3 in production)
3. **Queue**: Document record created in MongoDB with "PROCESSING" status
4. **Trigger**: Inngest background job is triggered
5. **AI Extraction**: Mastra agent with GPT-4 extracts structured data
6. **Update**: Database is updated with extracted information
7. **Display**: Dashboard shows results with real-time polling

## Security Checklist

- [ ] Add `userId` to all MongoDB queries for multi-tenant security
- [ ] Implement authentication (NextAuth, Clerk, etc.)
- [ ] Configure CORS and rate limiting for API routes
- [ ] Move file storage to AWS S3 or UploadThing for production
- [ ] Add input validation and sanitization
- [ ] Set up proper error logging (Sentry, LogRocket, etc.)

## Production Deployment

### File Storage
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
- Multiple file upload
- Batch processing
- Export to Excel/CSV
- Discrepancy detection
- Email notifications
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
