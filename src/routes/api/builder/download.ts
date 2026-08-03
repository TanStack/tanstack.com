import { createFileRoute } from "@tanstack/react-router";
import JSZip from "jszip";
import {
  getContentDispositionHeader,
  sanitizeResponseFilename,
} from "~/utils/http-response";
import {
  builderErrorResponse,
  builderInternalErrorResponse,
  validateBuilderGetRequest,
} from "~/builder/api/request-boundary.server";

const BASE64_PREFIX = "base64::";
const MAX_BUILDER_DOWNLOAD_FEATURES = 80;
const MAX_BUILDER_DOWNLOAD_OPTIONS = 200;
const BUILDER_ID_PATTERN = /^[a-z0-9._-]{1,120}$/i;
const BUILDER_PROJECT_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]{0,119}$/;

function decodeBase64File(content: string): Uint8Array | null {
  if (content.startsWith(BASE64_PREFIX)) {
    const decoded = atob(content.slice(BASE64_PREFIX.length));

    return Uint8Array.from(decoded, (char) => char.charCodeAt(0));
  }

  return null;
}

export const Route = createFileRoute("/api/builder/download")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        try {
          const requestGuard = await validateBuilderGetRequest(request);
          if ("response" in requestGuard) {
            return requestGuard.response;
          }

          const url = new URL(request.url);
          const name = url.searchParams.get("name") || "my-tanstack-app";
          const featuresParam = url.searchParams.get("features") || "";
          const framework = url.searchParams.get("framework") || "react";
          const packageManager = url.searchParams.get("pm") || "pnpm";
          const tailwind = url.searchParams.get("tailwind") !== "false";

          const features = featuresParam
            .split(",")
            .map((f) => f.trim())
            .filter(Boolean);

          if (
            !BUILDER_PROJECT_NAME_PATTERN.test(name) ||
            features.length > MAX_BUILDER_DOWNLOAD_FEATURES ||
            features.some((feature) => !BUILDER_ID_PATTERN.test(feature))
          ) {
            return builderErrorResponse(
              "Invalid builder download request",
              400,
              requestGuard.rateLimit,
            );
          }

          // Parse feature options (keys like "drizzle.database=postgres")
          const featureOptions: Record<string, Record<string, unknown>> = {};
          let optionCount = 0;
          for (const [key, value] of url.searchParams.entries()) {
            if (key.includes(".") && value) {
              const [featureId, optionKey] = key.split(".");
              optionCount++;
              if (
                optionCount > MAX_BUILDER_DOWNLOAD_OPTIONS ||
                !BUILDER_ID_PATTERN.test(featureId) ||
                !BUILDER_ID_PATTERN.test(optionKey) ||
                value.length > 500
              ) {
                return builderErrorResponse(
                  "Invalid builder download options",
                  400,
                  requestGuard.rateLimit,
                );
              }
              if (!featureOptions[featureId]) {
                featureOptions[featureId] = {};
              }
              featureOptions[featureId][optionKey] = value;
            }
          }

          const { compileHandler } = await import("~/builder/api/compile");
          const result = await compileHandler({
            name,
            framework: framework === "solid" ? "solid" : "react",
            packageManager:
              packageManager === "bun" ||
              packageManager === "npm" ||
              packageManager === "yarn"
                ? packageManager
                : "pnpm",
            tailwind,
            features,
            featureOptions,
          });

          const zip = new JSZip();
          const zipFilename = sanitizeResponseFilename(`${name}.zip`, "app.zip");
          const rootFolderName = sanitizeResponseFilename(name, "app");
          const rootFolder = zip.folder(rootFolderName);
          if (!rootFolder) {
            throw new Error("Failed to create ZIP folder");
          }

          for (const [filePath, content] of Object.entries(result.files)) {
            // Handle base64-encoded binary files (SVGs, images, etc.)
            const binaryContent = decodeBase64File(content);
            if (binaryContent) {
              rootFolder.file(filePath, binaryContent, { binary: true });
            } else {
              rootFolder.file(filePath, content);
            }
          }

          const blob = await zip.generateAsync({ type: "arraybuffer" });

          // Cache for 1 hour on CDN, allow stale for 1 day while revalidating
          const cacheControl =
            process.env.NODE_ENV === "production"
              ? "public, max-age=3600, stale-while-revalidate=86400"
              : "no-cache";

          return new Response(blob, {
            headers: {
              "Content-Type": "application/zip",
              "Content-Disposition": getContentDispositionHeader(
                "attachment",
                zipFilename,
                "app.zip",
              ),
              "Cache-Control": cacheControl,
            },
          });
        } catch (error) {
          console.error("Error generating ZIP:", error);
          return builderInternalErrorResponse("Failed to generate ZIP");
        }
      },
    },
  },
});
