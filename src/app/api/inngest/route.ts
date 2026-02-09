import { serve } from 'inngest/next';
import { inngest } from '../../../lib/inngest/client';
import { processFinancialDocument, processFinancialAudio } from '../../../lib/inngest/functions';

// Expose Inngest functions via HTTP endpoint
export const { GET, POST, PUT } = serve({
    client: inngest,
    functions: [
        processFinancialDocument,
        processFinancialAudio,
    ],
});
