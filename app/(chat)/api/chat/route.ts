import { convertToCoreMessages, Message, streamText } from "ai";
import { z } from "zod";
import { extractPDFTextFromFile } from "@/lib/pdf-utils";
import { geminiProModel } from "@/ai";
import { auth } from "@/app/(auth)/auth";
import { deleteChatById, getChatById, saveChat } from "@/db/queries";
import { formatUCCResponse,findBestMatch } from '@/lib/response-utils';

// Disable static optimization
export const dynamic = "force-dynamic";
export const maxDuration = 30; // 30s timeout

function extractRelevantSection(text: string, query: string): string {
  // Implement smart extraction:
  const keywords = {
    'computing': 'COMPUTING PROGRAMS SECTION',
    'business': 'BUSINESS SCHOOL SECTION',
    'fees': 'TUITION AND FEES SECTION'
  };

  const section = findBestMatch(text, query, keywords);
  return section || 'General information about UCC programs';
}

export async function POST(request: Request) {
  try {
    const { id, messages }: { id: string; messages: Array<Message> } =
      await request.json();

    const session = await auth();
    if (!session) return new Response("Unauthorized", { status: 401 });

    const coreMessages = convertToCoreMessages(messages)
      .filter(message => message.content.length > 0);

    const result = await streamText({
      model: geminiProModel,
      system: `
You are the official UCC (University of Computing Center) Helpdesk assistant. Follow these rules strictly:

1. Identity:
- Always respond as "UCC Helpdesk"
- Never mention you're an AI

2. Content Rules:
- Only answer about UCC programs/services
- For program queries, ALWAYS include:
  • Duration (e.g., "2 years full-time")
  • Core modules (3-5 key subjects)
  • Entry requirements (minimum qualifications)
  • Career prospects (2-3 job roles)

3. Style:
- Use professional but friendly tone
- Format clearly with bullet points when listing
`,
      messages: coreMessages,
      tools: {
        searchPDF: {
          description: "Search UCC prospectus PDF",
          parameters: z.object({
            query: z.string().describe("Question about UCC")
          }),
          execute: async ({ query }) => {
            try {
              const pdfText = await extractPDFTextFromFile("prospectus.pdf");
              if (!pdfText) throw new Error();
              
              return {
                message: formatUCCResponse(pdfText, query)
              };
            } catch {
              return {
                message: "UCC Helpdesk is currently updating our program records. " +
                         "Please visit https://ucc.co.tz/programs for latest information."
              };
            }
          }
        }
      },
      onFinish: async ({ responseMessages }) => {
        if (session.user?.id) {
          await saveChat({
            id,
            messages: [...coreMessages, ...responseMessages],
            userId: session.user.id,
          }).catch(error => console.error("Chat save failed:", error));
        }
      }
    });

    return result.toDataStreamResponse({});
  } catch (error) {
    console.error("Chat endpoint error:", error);
    return new Response("Service unavailable. Please try again later.", {
      status: 503
    });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const session = await auth();

    if (!id) return new Response("Not Found", { status: 404 });
    if (!session?.user) return new Response("Unauthorized", { status: 401 });

    const chat = await getChatById({ id });
    if (chat.userId !== session.user.id) {
      return new Response("Unauthorized", { status: 403 });
    }

    await deleteChatById({ id });
    return new Response("Chat deleted", { status: 200 });

  } catch (error) {
    console.error("Delete error:", error);
    return new Response("Processing error", { status: 500 });
  }
}