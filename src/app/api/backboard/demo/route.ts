import { NextRequest, NextResponse } from "next/server";
import { BackboardClient } from "backboard-sdk";

export async function POST(req: NextRequest) {
    try {
        const { message } = await req.json();

        if (!message) {
            return NextResponse.json(
                { error: "Message is required" },
                { status: 400 }
            );
        }

        const apiKey = process.env.BACKBOARD_API_KEY;

        if (!apiKey) {
            return NextResponse.json(
                { error: "BACKBOARD_API_KEY is not configured" },
                { status: 500 }
            );
        }

        const client = new BackboardClient({ apiKey });

        // 1. Create Assistant (The Brain)
        // In production, you would typically create this once and reuse the ID.
        const assistant = await client.createAssistant({
            name: "Demo Assistant",
            system_prompt: "You remain helpful and concise.",
        });

        if (!assistant?.assistantId) {
            throw new Error("Failed to create assistant");
        }

        // 2. Create Thread (The Conversation)
        const thread = await client.createThread(assistant.assistantId);

        if (!thread?.threadId) {
            throw new Error("Failed to create thread");
        }

        // 3. Send Message (The Interaction)
        const response = await client.addMessage(thread.threadId, {
            content: message,
            llm_provider: "openai", // Default
            model_name: "gpt-4o", // Default
            memory: "Auto",
            stream: false,
        });

        return NextResponse.json({
            response: (response as any).content,
            assistantId: assistant.assistantId,
            threadId: thread.threadId,
        });
    } catch (error: any) {
        console.error("Backboard Demo Error:", error);
        return NextResponse.json(
            { error: error.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}
