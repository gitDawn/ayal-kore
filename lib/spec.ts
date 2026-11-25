// lib/spec.ts — GENERATED workspace spec (assets + endpoints).
// The shell's client-side asset proxy (app/api/[asset]/**) + resolver
// (lib/api.ts) read this at request time so dataClient(<Asset>) works.
// Overwrites the placeholder stub; regenerate after spec changes.

export interface SpecField { name: string; storageRef?: 'id'; storageAsset?: string; }
export interface SpecAsset { name: string; category?: string; visibility?: string; access?: string | Record<string, string[]>; fields?: SpecField[]; primaryKey?: string; }
export interface SpecEndpoint { method: string; path: string; operationId?: string; }
export interface Spec { assets: SpecAsset[]; endpoints: SpecEndpoint[]; }

export const spec: Spec = {
  "assets": [
    {
      "name": "Users",
      "category": "AUTH_SERVICE",
      "primaryKey": "id"
    },
    {
      "name": "InventoryVersionSnapshotFiles",
      "category": "S3_PREFIX",
      "visibility": "private"
    },
    {
      "name": "InventoryVersion",
      "category": "TABLE",
      "visibility": "shared",
      "access": {
        "create": [
          "role:staff"
        ],
        "read": [
          "anyone"
        ],
        "update": [
          "role:staff"
        ],
        "delete": [
          "role:staff"
        ]
      },
      "fields": [
        {
          "name": "snapshotFile",
          "storageRef": "id",
          "storageAsset": "InventoryVersionSnapshotFiles"
        }
      ],
      "primaryKey": "id"
    }
  ],
  "endpoints": [
    {
      "method": "GET",
      "path": "/inventoryVersions"
    },
    {
      "method": "GET",
      "path": "/inventoryVersions/{id}"
    },
    {
      "method": "POST",
      "path": "/inventoryVersions"
    },
    {
      "method": "PUT",
      "path": "/inventoryVersions/{id}"
    },
    {
      "method": "DELETE",
      "path": "/inventoryVersions/{id}"
    },
    {
      "method": "POST",
      "path": "/inventoryVersionSnapshotFiles/upload/{filename}"
    },
    {
      "method": "GET",
      "path": "/inventoryVersionSnapshotFiles/{id}/download"
    },
    {
      "method": "GET",
      "path": "/inventoryVersionSnapshotFiles"
    },
    {
      "method": "GET",
      "path": "/inventoryVersionSnapshotFiles/{id}/metadata"
    },
    {
      "method": "DELETE",
      "path": "/inventoryVersionSnapshotFiles/{id}"
    }
  ]
};

export default spec;
