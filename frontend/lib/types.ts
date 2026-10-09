/**
 * Friendly names for the backend schemas. The shapes come from `api-types.ts`, which is
 * generated from the FastAPI OpenAPI document (`npm run gen:types`), so they cannot drift
 * from the backend by hand-editing.
 */
import type { components } from "./api-types";

type Schemas = components["schemas"];

export type User = Schemas["UserOut"];
export type Person = Schemas["PersonOut"];
export type Tag = Schemas["TagOut"];
export type Participant = Schemas["ParticipantOut"];
export type MeetingListItem = Schemas["MeetingListItem"];
export type MeetingDetail = Schemas["MeetingDetail"];
export type MeetingStatus = Schemas["MeetingStatus"];
export type MeetingSource = Schemas["MeetingSource"];
export type Summary = Schemas["SummaryOut"];
export type Chapter = Schemas["ChapterOut"];
export type ActionItem = Schemas["ActionItemOut"];
export type Transcript = Schemas["TranscriptOut"];
export type TranscriptSegment = Schemas["TranscriptSegmentOut"];
export type Soundbite = Schemas["SoundbiteOut"];
export type SearchResults = Schemas["SearchOut"];

export type Page<T> = { items: T[]; total: number; page: number; limit: number };

export type AuthResult = Schemas["AuthOut"];
export type AuthConfig = Schemas["AuthConfigOut"];
export type UserSettings = Schemas["UserSettings"];
export type ApiKey = Schemas["ApiKeyOut"];
export type ApiKeyCreated = Schemas["ApiKeyCreated"];
export type Integration = Schemas["IntegrationOut"];
export type EmailLog = Schemas["EmailLogOut"];
export type EmailLogDetail = Schemas["EmailLogDetail"];
export type SecurityOverview = Schemas["SecurityOverview"];
export type Tasks = Schemas["TasksOut"];
export type Task = Schemas["TaskOut"];
export type Analytics = Schemas["AnalyticsOut"];
export type AskResult = Schemas["AskOut"];
export type AskSource = Schemas["AskSource"];
export type TranscriptSearch = Schemas["TranscriptSearchOut"];
