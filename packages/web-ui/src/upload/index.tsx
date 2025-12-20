'use client';

import { useRef, useState } from 'react';
import { UploadCloud, ImageIcon, X } from 'lucide-react';
import { Button } from '../components/button';
import { cn } from '../lib/utils';

export type UploadValue = {
    id: string;
    url: string;
    name?: string;
    mimeType?: string;
};

export type UploadFieldProps = {
    label?: string;
    description?: string;
    value: UploadValue | null;
    onChange: (value: UploadValue | null) => void;
    onUpload: (file: File) => Promise<UploadValue>;
    accept?: string;
    disabled?: boolean;
    emptyText?: string;
    helperText?: string;
    className?: string;
    onError?: (error: Error) => void;
};

export function UploadField({
    label,
    description,
    value,
    onChange,
    onUpload,
    accept,
    disabled,
    emptyText = '支持拖拽或点击上传文件',
    helperText,
    className,
    onError,
}: UploadFieldProps) {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    const handleTriggerFile = () => {
        inputRef.current?.click();
    };

    const handleFileChange = async (
        event: React.ChangeEvent<HTMLInputElement>,
    ) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const uploaded = await onUpload(file);
            onChange(uploaded);
        } catch (error) {
            onError?.(error as Error);
        } finally {
            setIsUploading(false);
            event.target.value = '';
        }
    };

    return (
        <div className={cn('space-y-2', className)}>
            {label ? (
                <div className="text-sm font-medium text-foreground">
                    {label}
                </div>
            ) : null}
            {description ? (
                <p className="text-xs text-muted-foreground">{description}</p>
            ) : null}
            <div
                className={cn(
                    'rounded-lg border border-dashed',
                    'transition-colors',
                    disabled ? 'opacity-60' : 'hover:border-foreground/30',
                )}
            >
                {value ? (
                    <div className="flex items-center gap-3 p-4">
                        <PreviewBadge value={value} />
                        <div className="flex-1 min-w-0 space-y-0.5">
                            <p className="text-sm font-medium leading-tight break-all">
                                {value.name ?? '已上传文件'}
                            </p>
                            <p className="text-xs text-muted-foreground break-all">
                                {value.mimeType ?? value.url}
                            </p>
                        </div>
                        <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => onChange(null)}
                            disabled={disabled || isUploading}
                            aria-label="移除文件"
                        >
                            <X className="size-4" />
                        </Button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-3 px-4 py-6 text-center">
                        <div className="rounded-full bg-primary/10 p-3 text-primary">
                            <UploadCloud className="size-6" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-foreground">
                                {emptyText}
                            </p>
                            {helperText ? (
                                <p className="text-xs text-muted-foreground">
                                    {helperText}
                                </p>
                            ) : null}
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleTriggerFile}
                            disabled={disabled || isUploading}
                        >
                            {isUploading ? '上传中...' : '选择文件'}
                        </Button>
                    </div>
                )}
                <input
                    ref={inputRef}
                    type="file"
                    className="hidden"
                    accept={accept}
                    onChange={handleFileChange}
                    disabled={disabled || isUploading}
                />
            </div>
        </div>
    );
}

function PreviewBadge({ value }: { value: UploadValue }) {
    const isImage = isImageUrl(value.url) || value.mimeType?.startsWith('image');

    if (!isImage) {
        return (
            <div className="flex size-12 items-center justify-center rounded-md bg-muted">
                <ImageIcon className="size-5 text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="relative size-12 overflow-hidden rounded-md border border-border bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={value.url}
                alt={value.name ?? '上传文件'}
                className="size-full object-cover"
            />
        </div>
    );
}

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'];

function isImageUrl(url?: string | null) {
    if (!url) return false;
    const lower = url.toLowerCase();
    return IMAGE_EXTENSIONS.some((ext) => lower.includes(ext));
}
