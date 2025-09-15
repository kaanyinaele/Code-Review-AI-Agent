import { stepCountIs, streamText } from "ai";
import { google } from "@ai-sdk/google";
import { SYSTEM_PROMPT } from "./prompts";
import { getFileChangesInDirectoryTool, generateCommitMessageTool, generateMarkdownFileTool } from "./tools";

const requireEnv = (name: string) => {
  const v = process.env[name];
  if (!v || v.trim().length === 0) {
    console.warn(`[warn] Missing env '${name}'. Make sure your Google API key is configured.`);
  }
  return v;
};

requireEnv("GOOGLE_API_KEY"); // or GOOGLE_GENERATIVE_AI_API_KEY depending on setup

const codeReviewAgent = async (prompt: string) => {
  const result = streamText({
    model: google("models/gemini-2.5-flash"),
    prompt,
    system: SYSTEM_PROMPT,
    tools: {
      getFileChangesInDirectoryTool,
      generateCommitMessageTool,
      generateMarkdownFileTool,
    },
    stopWhen: stepCountIs(10),
  });

  for await (const chunk of result.textStream) {
    process.stdout.write(chunk);
  }
};

const ROOT_DIR = process.env.ROOT_DIR || "../my-agent";
await codeReviewAgent(
  `Review the code changes in '${ROOT_DIR}' directory. Provide file-by-file feedback and suggestions. If helpful, propose a Conventional Commit message and a short change summary as Markdown.`,
);