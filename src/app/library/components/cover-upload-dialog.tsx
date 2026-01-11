"use client";

import { useCallback, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Source {
    id: string;
    title: string;
}

interface CoverUploadDialogProps {
    isOpen: boolean;
    source: Source | null;
    onOpenChange: (open: boolean) => void;
    onSaved: () => void;
}

export function CoverUploadDialog({
    isOpen,
    source,
    onOpenChange,
    onSaved,
}: CoverUploadDialogProps) {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [saving, setSaving] = useState(false);

    const resetState = useCallback(() => {
        setSelectedFile(null);
        setPreviewUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return null;
        });
        setSaving(false);
    }, []);

    useEffect(() => {
        if (!isOpen) {
            resetState();
        }
    }, [isOpen, resetState]);

    useEffect(() => {
        return () => {
            resetState();
        };
    }, [resetState]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            toast.error("Выберите изображение");
            return;
        }
        setSelectedFile(file);
        setPreviewUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return URL.createObjectURL(file);
        });
    };

    const handleSave = async () => {
        if (!source?.id || !selectedFile) {
            toast.error("Выберите изображение");
            return;
        }
        setSaving(true);
        try {
            const formData = new FormData();
            formData.append("file", selectedFile);
            const response = await fetch(`/api/sources/${source.id}/cover`, {
                method: "POST",
                body: formData,
            });
            const data = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(data?.error || "Failed to update cover");
            }
            toast.success("Обложка обновлена");
            onSaved();
            onOpenChange(false);
        } catch (error) {
            console.error("Error updating cover:", error);
            const message =
                error instanceof Error ? error.message : "Не удалось обновить обложку";
            toast.error(message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="flex w-full flex-col border-border bg-background sm:max-w-2xl">
                <DialogHeader className="shrink-0">
                    <DialogTitle className="text-foreground">
                        Обновить обложку
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        Выберите изображение для обложки
                    </DialogDescription>
                </DialogHeader>
                <div className="mt-4 space-y-4">
                    <label className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground">
                        Выбрать файл обложки
                        <Input
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            disabled={saving}
                            className="hidden"
                        />
                    </label>
                    {previewUrl && (
                        <div className="flex justify-center">
                            <div className="relative aspect-[3/4] w-48 overflow-hidden rounded-xl border border-border bg-muted/20 shadow-sm sm:w-56">
                                <img
                                    src={previewUrl}
                                    alt="Предпросмотр обложки"
                                    className="h-full w-full object-cover"
                                />
                            </div>
                        </div>
                    )}
                </div>
                <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={saving}
                    >
                        Отмена
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSave}
                        disabled={!selectedFile || saving}
                    >
                        {saving ? "Сохранение..." : "Сохранить"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
