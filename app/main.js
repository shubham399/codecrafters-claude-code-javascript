import OpenAI from "openai";
import { readFile } from "fs/promises";
import { writeFile } from "fs";

async function Read(filePath) {
    const content = await readFile(filePath, "utf8");
    return content;
}
async function Write(filePath, content) {
    const content = await writeFile(filePath, content);
    return content;
}

async function main() {
    const [, , flag, prompt] = process.argv;
    const apiKey = process.env.OPENROUTER_API_KEY;
    const baseURL =
        process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";

    if (!apiKey) {
        throw new Error("OPENROUTER_API_KEY is not set");
    }
    if (flag !== "-p" || !prompt) {
        throw new Error("error: -p flag is required");
    }

    const client = new OpenAI({
        apiKey: apiKey,
        baseURL: baseURL,
    });

    const messages = [{ role: "user", content: prompt }];
    while (true) {
        const response = await client.chat.completions.create({
            model: "anthropic/claude-haiku-4.5",
            messages,
            tools: [{
                "type": "function",
                "function": {
                    "name": "Read",
                    "description": "Read and return the contents of a file",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "file_path": {
                                "type": "string",
                                "description": "The path to the file to read"
                            }
                        },
                        "required": ["file_path"]
                    }
                },
            }, {
                "type": "function",
                "function": {
                    "name": "Write",
                    "description": "Write content to a file",
                    "parameters": {
                        "type": "object",
                        "required": ["file_path", "content"],
                        "properties": {
                            "file_path": {
                                "type": "string",
                                "description": "The path of the file to write to"
                            },
                            "content": {
                                "type": "string",
                                "description": "The content to write to the file"
                            }
                        }
                    }
                }
            }
            ]
        });

        if (!response.choices || response.choices.length === 0) {
            throw new Error("no choices in response");
        }

        // You can use print statements as follows for debugging, they'll be visible when running tests.
        console.error("Logs from your program will appear here!");
        const { message } = response.choices[0];
        messages.push(message);
        if (!message.tool_calls || message.tool_calls.length === 0) {
            console.log(message.content);
            break;
        }
        if (message.tool_calls && message.tool_calls.length > 0) {
            const tool = message.tool_calls[0];
            const fnName = tool.function.name;
            const fnArgs = JSON.parse(tool.function.arguments);
            if (fnName === "Read") {
                const data = await Read(fnArgs.file_path);
                messages.push({
                    role: "tool",
                    tool_call_id: tool.id,
                    content: data,
                });
            }
            if (fnName === "Write") {
                await Write(fnArgs.file_path, fnArgs.content);
                messages.push({
                    role: "tool",
                    tool_call_id: tool.id,
                    content: "Created the file",
                });
            }
        }
    }
}


main();
