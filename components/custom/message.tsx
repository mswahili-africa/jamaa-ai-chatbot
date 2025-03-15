"use client";

import { Attachment, ToolInvocation } from "ai";
import { motion } from "framer-motion";
import { ReactNode } from "react";
import Image from 'next/image';
import { BotIcon, UserIcon } from "./icons";
import { Markdown } from "./markdown";
import { PreviewAttachment } from "./preview-attachment";
import { Weather } from "./weather";
import { AuthorizePayment } from "../flights/authorize-payment";
import { DisplayBoardingPass } from "../flights/boarding-pass";
import { CreateReservation } from "../flights/create-reservation";
import { FlightStatus } from "../flights/flight-status";
import { ListFlights } from "../flights/list-flights";
import { SelectSeats } from "../flights/select-seats";
import { VerifyPayment } from "../flights/verify-payment";

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

export const Message = ({
  chatId,
  role,
  content,
  toolInvocations,
  attachments,
}: {
  chatId: string;
  role: string;
  content: string | ReactNode;
  toolInvocations: Array<ToolInvocation> | undefined;
  attachments?: Array<Attachment>;
}) => {
  // Check if the content is structured data (search results)
  const isStructuredData =
    typeof content === "string" &&
    content.startsWith("{") &&
    content.includes("results");

  // Parse the structured data if it exists
  const structuredData = isStructuredData
    ? (JSON.parse(content) as {
      results: SearchResult[];
      message: string;
      displayType: string;
    })
    : null;

  return (
    <motion.div
      className={`flex flex-row gap-4 px-4 w-full md:w-[500px] md:px-0 first-of-type:pt-20`}
      initial={{ y: 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
    >
      <div className="size-[24px] border rounded-sm p-1 flex flex-col justify-center items-center shrink-0 text-zinc-500">
        {role === "assistant" ? <BotIcon /> : <UserIcon />}
      </div>

      <div className="flex flex-col gap-2 w-full">
        {content && typeof content === "string" && !isStructuredData && (
          <div className="text-zinc-800 dark:text-zinc-300 flex flex-col gap-4">
            <Markdown>{content}</Markdown>
          </div>
        )}

        {isStructuredData && structuredData && (
          <div className="w-full">
            <p className="text-sm text-gray-600 mb-4">{structuredData.message}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {structuredData.results.map((result) => (
                <div
                  key={result.id}
                  className="border rounded-lg overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => {
                    // Handle click (e.g., navigate to product details)
                    console.log("Clicked on:", result.title);
                  }}
                >
                  <Image
                    src={result.imageUrl}
                    alt={result.title}
                    width={300}
                    height={200}
                    className="w-full h-48 object-cover"
                    unoptimized
                  />

                  <div className="p-4">
                    <h3 className="font-semibold text-lg">{result.title}</h3>
                    <p className="text-sm text-gray-600">{result.description}</p>
                    <p className="text-sm font-bold mt-2">{result.price}</p>
                    <p className="text-sm text-gray-600">
                      Condition: {result.condition}
                    </p>
                    <p className="text-sm text-gray-600">
                      Deliverable: {result.deliverable ? "Yes" : "No"}
                    </p>
                    <p className="text-sm text-gray-600">Shop: {result.shopName}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}


        {attachments && (
          <div className="flex flex-row gap-2">
            {attachments.map((attachment) => (
              <PreviewAttachment key={attachment.url} attachment={attachment} />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};