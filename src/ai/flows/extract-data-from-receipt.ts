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
  date: z.string().describe('The date on the receipt or bill (YYYY-MM-DD).'),
  provider: z.string().describe('The name of the provider.'),
  patient: z.string().describe('The name of the patient.'),
  cost: z.number().describe('The total cost on the receipt or bill.'),
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
following information from the receipt or bill:

- Date: The date on the receipt or bill (YYYY-MM-DD).
- Provider: The name of the provider.
- Patient: The name of the patient.
- Cost: The total cost on the receipt or bill.

Here is the receipt or bill:

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
