import { convertToCoreMessages, Message, streamText } from "ai";
import { z } from "zod";
import axios from "axios";

import { geminiProModel } from "@/ai";
import { auth } from "@/app/(auth)/auth";
import { generateUUID } from "@/lib/utils";
import { deleteChatById, getChatById, saveChat } from "@/db/queries";

// Define the API-calling functions directly
async function getTripEstimate(pickupCoordinates: string, dropoffCoordinates: string) {
  try {
    const response = await axios.post(`${process.env.API_BASE_URL}/delivery/trip/estimate`, {
      origins: [pickupCoordinates],
      destinations: [dropoffCoordinates],
    });
    return response.data;
  } catch (error) {
    throw new Error("Failed to get trip estimate");
  }
}

async function requestRide({ pickupCoordinates, dropoffCoordinates }: { pickupCoordinates: string; dropoffCoordinates: string }) {
  try {
    const response = await axios.post(`${process.env.API_BASE_URL}/delivery/trip/request`, {
      pickup: pickupCoordinates,
      dropoff: dropoffCoordinates,
      type: "ride",
    });
    return response.data;
  } catch (error) {
    throw new Error("Failed to request ride");
  }
}

// Define the SearchResult type
type SearchResult = {
  id: string;
  title: string;
  description: string;
  price: string;
  imageUrl: string;
  condition: string;
  deliverable: boolean;
  shopName: string;
};

async function searchProductsAndServices({ query }: { query: string }): Promise<{ results: SearchResult[] }> {
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
    const searchResults: SearchResult[] = advertisements.map((ad: any) => ({
      id: ad.id,
      title: ad.title,
      description: ad.description,
      price: `${ad.price} ${ad.currency}`,
      imageUrl: ad.imageUrl[0], // Use the first image as the thumbnail
      condition: ad.condition,
      deliverable: ad.deliverable,
      shopName: ad.shopInfo.name,
    }));

    return { results: searchResults };
  } catch (error) {
    console.error("Failed to fetch advertisements:", error);
    throw new Error("Failed to search products and services");
  }
}

export async function POST(request: Request) {
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
      - You assist users in booking rides on Bantu Soko.
      - You assist users in buying products and services on Bantu Soko.
      - Unasadia watu kununua vitu mtandaoni.
      - Unasaidia watu kupata usafiri wa taxi mtandao.
      - Wewe unaitwa Jamaa.
      - Your name is Jamaa.
      - You are under Mswahili Technologies https://mswahili.com.
      - Ndugu yako ni Bantu Soko.
      - Your sibling is Bantu Soko.
      - Mswahili Technologies ndio aliekuunda.
      - You speak only Swahili and English.
      - You are from Tanzania.
      - Unatokea Tanzania.
      - Once the user says what they want, proceed to search for the product or service.
      - Keep your responses concise.
      - Show images of proposed listings.
      - Today's date is ${new Date().toLocaleDateString()}.
      - Ask for pickup and drop-off locations to provide a ride estimate.
      - Once the user confirms, proceed to book the ride.
    `,
    messages: coreMessages,
    tools: {
      getRideEstimate: {
        description: "Get a ride estimate for the user",
        parameters: z.object({
          pickupLocation: z.string().describe("Pickup address or location"),
          dropoffLocation: z.string().describe("Drop-off address or location"),
        }),
        execute: async ({ pickupLocation, dropoffLocation }) => {
          // Step 1: Get ride estimate
          const estimate = await getTripEstimate(pickupLocation, dropoffLocation);
          return {
            estimatedPrice: estimate.fee,
            estimatedTimeOfArrival: estimate.eta,
            message: `The estimated fare is ${estimate.fee} TZS, and the estimated time of arrival is ${estimate.eta}. Do you want to proceed with the ride?`,
          };
        },
      },
      confirmRide: {
        description: "Confirm and book the ride for the user",
        parameters: z.object({
          pickupLocation: z.string().describe("Pickup address or location"),
          dropoffLocation: z.string().describe("Drop-off address or location"),
        }),
        execute: async ({ pickupLocation, dropoffLocation }) => {
          // Step 2: Request ride
          const rideRequest = await requestRide({ pickupCoordinates: pickupLocation, dropoffCoordinates: dropoffLocation });
          return {
            driverName: rideRequest.driver.name,
            vehicleDetails: rideRequest.vehicle.details,
            estimatedTimeOfArrival: rideRequest.eta,
            message: `Your ride has been booked! Driver ${rideRequest.driver.name} will arrive in a ${rideRequest.vehicle.details}. ETA: ${rideRequest.eta}.`,
          };
        },
      },
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
              (result: SearchResult) => `
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