import { ExternalLink, PlayCircle } from "lucide-react";
import { toEmbedUrl } from "@/lib/utils";

export function VideoEmbed({ url, title }: { url?: string; title: string }) {
  if (!url) return null;
  const embed = toEmbedUrl(url);
  if (embed) {
    return (
      <div className="aspect-video overflow-hidden rounded-2xl bg-slate-900">
        <iframe
          src={embed}
          title={title}
          className="size-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 rounded-2xl bg-slate-900 px-4 py-4 text-white transition hover:bg-slate-800"
    >
      <PlayCircle className="size-8 text-sun-400" />
      <span className="flex-1">
        <span className="block text-sm font-semibold">Abrir vídeo de demonstração</span>
        <span className="block truncate text-xs text-slate-400">{url}</span>
      </span>
      <ExternalLink className="size-4 text-slate-400" />
    </a>
  );
}
