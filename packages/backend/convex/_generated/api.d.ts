/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as healthApiCommon from "../healthApiCommon.js";
import type * as healthCheck from "../healthCheck.js";
import type * as healthDomain from "../healthDomain.js";
import type * as healthHttpHandlers from "../healthHttpHandlers.js";
import type * as healthInternal from "../healthInternal.js";
import type * as healthOpenApi from "../healthOpenApi.js";
import type * as healthSummary from "../healthSummary.js";
import type * as healthSummaryHttpHandlers from "../healthSummaryHttpHandlers.js";
import type * as healthSummaryInternal from "../healthSummaryInternal.js";
import type * as healthTypes from "../healthTypes.js";
import type * as healthWriteIntentHttpHandlers from "../healthWriteIntentHttpHandlers.js";
import type * as healthWriteIntentsInternal from "../healthWriteIntentsInternal.js";
import type * as http from "../http.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  healthApiCommon: typeof healthApiCommon;
  healthCheck: typeof healthCheck;
  healthDomain: typeof healthDomain;
  healthHttpHandlers: typeof healthHttpHandlers;
  healthInternal: typeof healthInternal;
  healthOpenApi: typeof healthOpenApi;
  healthSummary: typeof healthSummary;
  healthSummaryHttpHandlers: typeof healthSummaryHttpHandlers;
  healthSummaryInternal: typeof healthSummaryInternal;
  healthTypes: typeof healthTypes;
  healthWriteIntentHttpHandlers: typeof healthWriteIntentHttpHandlers;
  healthWriteIntentsInternal: typeof healthWriteIntentsInternal;
  http: typeof http;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
