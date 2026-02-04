/**
 * @fileoverview Uploads REST API internal handlers.
 * Provides file upload URL generation for the public API.
 *
 * @module api/v1/uploads
 * @requires seal:documents:write scope for upload operations
 */

import { internalMutation } from "../../_generated/server";

/**
 * Generate a temporary upload URL for file storage.
 * The returned URL can be used to upload a file directly to Convex storage.
 *
 * @internal
 * @returns Temporary upload URL valid for a short period
 */
export const generateUploadUrl = internalMutation({
  args: {},
  handler: async (ctx): Promise<string> => {
    return await ctx.storage.generateUploadUrl();
  },
});
