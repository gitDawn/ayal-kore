// Auto-generated TypeScript types from Codata workspace spec
// Re-generate by calling workspaces-getApiUsage after spec changes

/** Free-form JSON column value — commonly an array or object; shape is app-defined. */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export interface Users {
  /** Server-generated UUID (client may supply on POST; server generates if omitted). */
  id: string; // User id.
  /** Free-form JSON — commonly an array or object; shape is app-defined. */
  providers: Json; // Linked sign-in providers for this user.
  /** ISO 8601 string (e.g. "2026-05-05T09:30:00.000Z"). Parse with new Date(value). */
  lastSignInAt?: string | null; // Last successful sign-in across any provider.
  /** Unique — the backend rejects duplicate values with 409. Give every row a distinct value. */
  email?: string | null; // account-linking key across providers.
  /** ISO 8601 string (e.g. "2026-05-05T09:30:00.000Z"). Parse with new Date(value). */
  lastPasswordResetAt?: string | null; // Last password-reset.
  /** Read-only. ISO 8601 string (e.g. "2026-05-05T09:30:00.000Z"). Parse with new Date(value). */
  readonly createdAt: string; // Account creation timestamp.
}

/** Fields for creating or updating a Users. Excludes server-managed timestamps. */
export type UsersInput = Omit<Users, 'createdAt' | 'id'> & { id?: string };

export interface InventoryVersionSnapshotFiles {
  /** Server-generated UUID (client may supply on POST; server generates if omitted). */
  id: string; // Auto-generated primary key
  /** Read-only. Server-managed. */
  readonly name: string; // Original file name
  /** Read-only. Server-managed. */
  readonly byteSize: number; // File size in bytes
  /** Read-only. Server-managed. */
  readonly filePath: string; // Directory path the file was uploaded under, relative to the asset prefix. Empty string when uploaded at the root.
  /** Read-only. Server-managed. */
  readonly fileType: string; // MIME type (e.g., audio/mpeg)
  /** Read-only. Server-managed. Free-form JSON — commonly an array or object; shape is app-defined. */
  readonly metadata: Json; // Free-form metadata object supplied by the client on upload. Defaults to {}.
  /** Read-only. ISO 8601 string (e.g. "2026-05-05T09:30:00.000Z"). Parse with new Date(value). */
  readonly createdAt: string; // Upload timestamp
  /** Read-only. ISO 8601 string (e.g. "2026-05-05T09:30:00.000Z"). Parse with new Date(value). */
  readonly updatedAt: string; // Last modification timestamp
}

/**
 * Request body for `POST /inventoryVersionSnapshotFiles/upload/{filename}` (step 1 of the two-step upload flow).
 */
export interface InventoryVersionSnapshotFilesUploadRequest {
  /** Optional subdirectory path within the asset prefix to store the file under */
  directoryPath: string;
  /** Optional custom metadata to associate with the uploaded file */
  metadata: Record<string, unknown>;
}
/** Alias kept for compatibility: for S3_PREFIX assets, InventoryVersionSnapshotFilesInput is the upload request payload. */
export type InventoryVersionSnapshotFilesInput = InventoryVersionSnapshotFilesUploadRequest;

export interface InventoryVersion {
  /** Server-generated UUID (client may supply on POST; server generates if omitted). */
  id: string; // Primary key
  snapshotFile: { ids: string[] };
  rowCount: number;
  sourceFileName?: string | null;
  note?: string | null;
  /** Read-only. ISO 8601 string (e.g. "2026-05-05T09:30:00.000Z"). Parse with new Date(value). */
  readonly createdAt: string;
}

/** Fields for creating or updating a InventoryVersion. Excludes server-managed timestamps. */
export type InventoryVersionInput = Omit<InventoryVersion, 'createdAt' | 'id'> & { id?: string };

// List response envelopes (runtime returns { data, pagination })
export interface UsersList {
  data: Users[];
  pagination: {
    pageOffset: number;
    pageLimit: number;
    /** Reserved for future pagination metadata; not currently emitted by the runtime. */
    total?: number;
    /** Reserved for future pagination metadata; not currently emitted by the runtime. */
    hasMore?: boolean;
  };
}
export interface InventoryVersionSnapshotFilesList {
  data: InventoryVersionSnapshotFiles[];
  pagination: {
    pageOffset: number;
    pageLimit: number;
    /** Reserved for future pagination metadata; not currently emitted by the runtime. */
    total?: number;
    /** Reserved for future pagination metadata; not currently emitted by the runtime. */
    hasMore?: boolean;
  };
}
export interface InventoryVersionList {
  data: InventoryVersion[];
  pagination: {
    pageOffset: number;
    pageLimit: number;
    /** Reserved for future pagination metadata; not currently emitted by the runtime. */
    total?: number;
    /** Reserved for future pagination metadata; not currently emitted by the runtime. */
    hasMore?: boolean;
  };
}

// Presign response types (two-step file storage)
/**
 * Response for POST /inventoryVersionSnapshotFiles/upload/{filename}.
 * Two-step upload pattern — see x-presigned-url-usage in the OpenAPI schema.
 * `uploadUrl`: send an HTTP PUT to this URL (AWS S3 Object Storage).
 * The URL expires after `expiresIn` seconds.
 */
export interface InventoryVersionSnapshotFilesUploadResponse {
  /** A temporary presigned URL for uploading the file directly to S3 object storage. Send an HTTP PUT request to this URL with the raw file content as the body and the appropriate Content-Type header. This URL points to an external storage service — do NOT send the request back to this API. */
  uploadUrl: string;
  /** Number of seconds until the presigned URL expires. */
  expiresIn: number;
  /** Metadata-record ID linking the uploaded object to its record — keep it. Later download and delete operations reference the file by this id. */
  id: string;
}

/**
 * Response for GET /inventoryVersionSnapshotFiles/{id}/download.
 * Two-step download pattern — see x-presigned-url-usage in the OpenAPI schema.
 * `downloadUrl`: send an HTTP GET to this URL (AWS S3 Object Storage).
 * The URL expires after `expiresIn` seconds.
 */
export interface InventoryVersionSnapshotFilesDownloadResponse {
  /** A temporary presigned URL for downloading the file directly from S3 object storage. Send an HTTP GET request to this URL to receive the raw file content. This URL points to an external storage service — do NOT send the request back to this API. */
  downloadUrl: string;
  /** Number of seconds until the presigned URL expires. */
  expiresIn: number;
  /** Metadata-record ID of the file being downloaded — keep it. Delete and metadata operations reference the file by this id. */
  id: string;
}
