import fs from "node:fs/promises";
import { getMimeType } from "@/adapters/file-storage";

interface AttachmentViewerProps {
  filePath: string;
}

export async function AttachmentViewer({ filePath }: AttachmentViewerProps) {
  let fileData: Buffer;
  try {
    fileData = await fs.readFile(filePath);
  } catch {
    return <p className="text-sm text-muted-foreground">Arquivo não encontrado</p>;
  }

  const mimeType = getMimeType(filePath);
  const base64 = fileData.toString("base64");
  const dataUrl = `data:${mimeType};base64,${base64}`;

  if (mimeType === "application/pdf") {
    return <iframe src={dataUrl} className="h-[70vh] w-full rounded-md border" title="Anexo" />;
  }

  if (mimeType.startsWith("image/")) {
    /* Using img because the source is a base64 data URL from local files,
       which is not supported by next/image */
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={dataUrl} alt="Anexo" className="max-h-[70vh] w-full rounded-md object-contain" />
    );
  }

  return (
    <p className="text-sm text-muted-foreground">Tipo de arquivo não suportado para preview</p>
  );
}
