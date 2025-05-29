
// src/ai/flows/extract-data-from-receipt.ts
'use server';
/**
 * @fileOverview Extracts data from a receipt or bill using AI.
 *
 * - extractData - A function that handles the data extraction process.
 * - ExtractDataInput - The input type for the extractData function.
 * - ExtractDataOutput - The return type for the extractData function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExtractDataInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of a receipt or bill, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractDataInput = z.infer<typeof ExtractDataInputSchema>;

const ExtractDataOutputSchema = z.object({
  date: z.string().describe('The earliest relevant date of service, transaction, or purchase from the document, formatted strictly as YYYY-MM-DD. Example: 2024-03-15.'),
  provider: z.string().describe('The name of the provider.'),
  patient: z.string().describe('The name of the patient.'),
  cost: z.number().describe('The total cost on the receipt or bill.'),
  dateOfPayment: z.string().describe('The date of payment, formatted strictly as YYYY-MM-DD. For receipts, if an explicit payment date is found, use it; otherwise, use the Date of Service/Transaction. For bills or other documents where a payment date is not distinct, use the Date of Service/Transaction.'),
});
export type ExtractDataOutput = z.infer<typeof ExtractDataOutputSchema>;

export async function extractData(input: ExtractDataInput): Promise<ExtractDataOutput> {
  return extractDataFlow(input);
}

const extractDataPrompt = ai.definePrompt({
  name: 'extractDataPrompt',
  input: {schema: ExtractDataInputSchema},
  output: {schema: ExtractDataOutputSchema},
  prompt: `You are an expert data extraction specialist.

You will be provided with an image of a receipt or bill. You will extract the
following information from the document:

- Date of Service/Transaction: Identify the date related to the actual service, purchase, or transaction. If multiple dates are present (e.g., print date, due date, order date, service date), prioritize the *earliest date* that appears to be the actual service or transaction date. Ensure the date is formatted strictly as YYYY-MM-DD. For example, if the receipt shows 'March 15, 2024' as the transaction date, you should output '2024-03-15'. If the year is not explicitly mentioned but is clearly the current year or can be inferred, use that year.
- Provider: The name of the provider.
- Patient: The name of the patient.
- Cost: The total cost on the receipt or bill.
- Date of Payment:
  - If the document is clearly a receipt and explicitly states a "Date of Payment" or similar (which might be the same as or different from the Date of Service/Transaction), extract this date.
  - If the document is a receipt but no explicit "Date of Payment" is found, use the value you determined for "Date of Service/Transaction" as the "Date of Payment".
  - If the document is primarily a bill and not a payment receipt, use the value you determined for "Date of Service/Transaction" as the "Date of Payment".
  Format this date strictly as YYYY-MM-DD.

Here is the document:

{{media url=photoDataUri}}

Please provide the extracted data in JSON format.
`,
});

const extractDataFlow = ai.defineFlow(
  {
    name: 'extractDataFlow',
    inputSchema: ExtractDataInputSchema,
    outputSchema: ExtractDataOutputSchema,
  },
  async input => {
    const {output} = await extractDataPrompt(input);
    return output!;
  }
);

