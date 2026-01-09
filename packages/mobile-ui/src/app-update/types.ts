import type { AppUpdateCheckResponse } from "@repo/types";

export type UpdateStatus =
    | "idle"
    | "checking"
    | "available"
    | "downloading"
    | "downloaded"
    | "installing"
    | "error";

export type DownloadProgress = {
    percent: number;
    downloadedBytes?: number;
    totalBytes?: number;
    localUri?: string | null;
};

export type ResolvedUpdateInfo =
    | (AppUpdateCheckResponse & {
          currentVersion: string;
          checkedAt?: number;
      })
    | undefined;
