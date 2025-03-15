import { convertToCoreMessages, Message, streamText } from "ai";
import { z } from "zod";
import axios from "axios";

import { geminiProModel } from "@/ai";
import { auth } from "@/app/(auth)/auth";
import { deleteChatById, getChatById, saveChat } from "@/db/queries";

// Define the SearchResult type
type SearchResultProduct = {
  id: string;
  title: string;
  description: string;
  price: string;
  imageUrl: string;
  condition: string;
  deliverable: boolean;
  shopName: string;
};

type SearchResultEvents = {
  id: string;
  title: string;
  description: string;
  eventType: string;
  imageUrl: string;
  dateTime: string;
  address: string;
  price: string;
  plannerInfo: string;
};

async function searchProductsAndServices({ query }: { query: string }): Promise<{ results: SearchResultProduct[] }> {
  try {
    // Call the API with the user's query
    const response = await axios.get(`${process.env.API_BASE_URL}/advertisement/listing/list`, {
      params: {
        title: query, // Pass the user's query as a query parameter
      },
    });

    // Extract the content from the response
    const advertisements = response.data.content;

    // Map the API response to the desired format
    const SearchResultProduct: SearchResultProduct[] = advertisements.map((ad: any) => ({
      id: ad.id,
      title: ad.title,
      description: ad.description,
      price: `${ad.price} ${ad.currency}`,
      imageUrl: ad.imageUrl[0], // Use the first image as the thumbnail
      condition: ad.condition,
      deliverable: ad.deliverable,
      shopName: ad.shopInfo.name,
    }));

    return { results: SearchResultProduct };
  } catch (error) {
    console.error("Failed to fetch advertisements:", error);
    throw new Error("Failed to search products and services");
  }
}

async function searchEvents({ query }: { query: string }): Promise<{ results: SearchResultEvents[] }> {
  try {
    // Call the API with the user's query
    const response = await axios.get(`${process.env.API_BASE_URL}/events/event/list`, {
      params: {
        title: query, // Pass the user's query as a query parameter
      },
    });

    // Extract the content from the response
    const events = response.data.content;

    // Map the API response to the desired format
    const SearchResultEvents: SearchResultEvents[] = events.map((ad: any) => ({
      id: ad.id,
      title: ad.title,
      description: ad.description,
      eventType: ad.eventType,
      price: `${ad.price} ${ad.currency}`,
      imageUrl: ad.imageUrl[0], // Use the first image as the thumbnail
      plannerInfo: ad.plannerInfo.name,
    }));

    return { results: SearchResultEvents };
  } catch (error) {
    console.error("Failed to fetch events:", error);
    throw new Error("Failed to search Events");
  }
}

export async function POST(request: Request) {
  const currentDate = new Date().toLocaleDateString();

  const { id, messages }: { id: string; messages: Array<Message> } =
    await request.json();

  const session = await auth();

  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const coreMessages = convertToCoreMessages(messages).filter(
    (message) => message.content.length > 0
  );

  const result = await streamText({
    model: geminiProModel,
    system: `
      - Today's date is ${currentDate}.
      - Don't mention you are from Google but from Bantu Soko
      - You help people find products, services and events within Bantu Soko
      - Your name is Jamaa.
      - Bantu Soko created you
      - You speak only Swahili and English.
      - You are from Tanzania.
      - Keep your responses concise.
      - Show images of proposed listings.
      - Dont show raw data from APIs like structured or unstructured data
    `,
    messages: coreMessages,
    tools: {
      searchProductsAndServices: {
        description: "Search for products or services based on the user's query",
        parameters: z.object({
          query: z.string().describe("The user's search query"),
        }),
        execute: async ({ query }) => {
          const searchResults = await searchProductsAndServices({ query });

          // Format the results for display
          const formattedMessage = searchResults.results
            .map(
              (result: SearchResultProduct) => `
**${result.title}**  
${result.description}  
**Price:** ${result.price}  
**Condition:** ${result.condition}  
**Deliverable:** ${result.deliverable ? "Yes" : "No"}  
**Shop:** ${result.shopName}  
![Thumbnail](${result.imageUrl})  
`
            )
            .join("\n\n");

          return {
            results: searchResults.results,
            message: `Here are the search results for "${query}":\n\n${formattedMessage}`,
          };
        },
      },
      searchEvents: {
        description: "Search for events based on the user's query",
        parameters: z.object({
          query: z.string().describe("The user's search query"),
        }),
        execute: async ({ query }) => {
          const searchResults = await searchEvents({ query });

          // Format the results for display
          const formattedMessage = searchResults.results
            .map(
              (result: SearchResultEvents) => `
**${result.title}**  
${result.description}  
**Price:** ${result.price}  
**address:** ${result.address}  
**Type:** ${result.eventType}  
**Orgniser:** ${result.plannerInfo}  
![Thumbnail](${result.imageUrl})  
`
            )
            .join("\n\n");

          return {
            results: searchResults.results,
            message: `Here are the search results for "${query}":\n\n${formattedMessage}`,
          };
        },
      },
    },
    onFinish: async ({ responseMessages }) => {
      if (session.user && session.user.id) {
        try {
          // Save the chat (if needed)
          await saveChat({
            id,
            messages: [...coreMessages, ...responseMessages],
            userId: session.user.id,
          });
        } catch (error) {
          console.error("Failed to save chat");
        }
      }
    },
    experimental_telemetry: {
      isEnabled: true,
      functionId: "stream-text",
    },
  });

  return result.toDataStreamResponse({});
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new Response("Not Found", { status: 404 });
  }

  const session = await auth();

  if (!session || !session.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const chat = await getChatById({ id });

    if (chat.userId !== session.user.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    await deleteChatById({ id });

    return new Response("Chat deleted", { status: 200 });
  } catch (error) {
    return new Response("An error occurred while processing your request", {
      status: 500,
    });
  }
}