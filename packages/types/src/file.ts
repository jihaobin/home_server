export interface FileRecordBase {
	id: string;
	originalName: string;
	fileName: string;
	fileSize: number;
	mimeType: string;
	fileType: string;
	fileUrl: string;
	uploadedAt: Date;
	blurhash?: string;
}

export interface FileUploadResponse extends FileRecordBase {}

export interface FileDownloadUrlResponse {
	fileUrl: string;
	fileName: string;
	mimeType: string;
	fileSize: number;
	expiresIn: number;
}

export interface FileThumbnailResponse {
	thumbnailUrl: string;
	fileName: string;
	expiresIn: number;
}

export interface FileListItem extends FileRecordBase {
	accessCount: number;
}

export interface FileListResponse {
	success: boolean;
	data?: FileListItem[];
	error?: string;
}

export interface FileInfo extends FileListItem {
	thumbnailUrl?: string;
}

export interface FileInfoResponse {
	success: boolean;
	data?: FileInfo;
	error?: string;
}