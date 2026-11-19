import { Image as ImageIcon, Megaphone } from "lucide-react";
import { useState } from "react";
import { ChangelogContent, changelogDate, changelogHeading, isBannerUrl } from "@/types/changelog";
import { muted, panel } from "./ui";

function Banner({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <p className="flex items-center gap-2 text-sm text-amber-200"><ImageIcon size={16} /> Banner konnte nicht geladen werden.</p>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="Changelog-Banner" referrerPolicy="no-referrer" onError={() => setFailed(true)}
      className="max-h-80 w-full rounded-md object-contain" />
  );
}

export function ChangelogPreview({ content, date, role, channel, editing = false }: {
  content: ChangelogContent; date?: Date; role?: string; channel?: string; editing?: boolean;
}) {
  return (
    <aside id="changelog-preview" className={`${panel} space-y-4`} aria-label="Discord-Vorschau">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><Megaphone size={16} className="text-[var(--gp-mint)]" /> Discord-Vorschau</h2>
        {channel && <span className={`break-all text-xs ${muted}`}>#{channel}</span>}
      </div>
      {content.ping && content.roleId && <div className="space-y-1 rounded-lg bg-[#282930] p-3 text-sm">
        <p className="break-words"><span className="rounded bg-[#5865f2]/30 px-1.5 py-0.5 font-medium text-[#d5d8ff]">@{role ?? content.roleId}</span></p>
        <p className="text-xs text-[#b6b7c4]">Separate Nachricht vor der Ankündigung</p>
      </div>}
      <div className="space-y-4 break-words rounded-lg border border-white/10 border-l-4 bg-[#282930] px-4 py-4 text-[#ebecf2]"
        style={{ borderLeftColor: content.color }}>
        <div className="space-y-2">
          <h3 className="text-xl font-bold leading-tight">{changelogHeading(content) || "Changelog-Titel"}</h3>
          {content.intro && <p className="whitespace-pre-wrap text-sm leading-relaxed">{content.intro}</p>}
        </div>
        {isBannerUrl(content.banner) && <Banner key={content.banner} url={content.banner} />}
        <hr className="border-white/15" />
        {content.sections.length === 0 && <p className="text-sm text-[#b6b7c4]">Hier erscheinen deine Abschnitte.</p>}
        {content.sections.map((section, index) => (
          <div key={index} className="space-y-1.5">
            <h4 className="font-semibold">{section.emoji} {section.title || "Abschnittstitel"}</h4>
            {section.description && <p className="whitespace-pre-wrap text-sm leading-relaxed">{section.description}</p>}
            {section.entries.some(Boolean) && <ul className="list-disc space-y-0.5 pl-5 text-sm leading-relaxed">
              {section.entries.filter(Boolean).map((entry, index) => <li key={index}>{entry}</li>)}
            </ul>}
          </div>
        ))}
        <hr className="border-white/15" />
        <div className="space-y-1 text-xs text-[#b6b7c4]">
          {date && <p>{changelogDate(content.language, date)}</p>}
          {content.footer && <p>{content.footer}</p>}
        </div>
      </div>
      {editing && <p className={`text-xs ${muted}`}>Das Datum wird beim Versand gesetzt.</p>}
    </aside>
  );
}
