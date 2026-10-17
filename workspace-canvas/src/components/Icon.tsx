export function Icon({ name, className = '', fill }: { name: string; className?: string; fill?: boolean }) {
  return <span className={`ms ${fill ? 'fill ' : ''}${className}`} aria-hidden="true">{name}</span>;
}

const APP_ICON: Record<string, string> = { mail: 'mail', cal: 'calendar_month', doc: 'description', slides: 'slideshow', sheet: 'table_chart', chat: 'chat', meet: 'videocam', link: 'link', file: 'draft' };
/** Generic app icons for sample Workspace items (no product marks). */
export function AppIcon({ kind, label }: { kind: string; label?: string }) {
  return <span className={`app-ic ${kind}`} title={label} aria-hidden={label ? undefined : true}><Icon name={APP_ICON[kind] || 'description'} /></span>;
}

export const TYPE_ICON: Record<string, string> = { note: 'sticky_note_2', direction: 'explore', assumption: 'percent', format: 'aspect_ratio', source: 'article', workspace: 'alternate_email', reference: 'image', edits: 'edit_note' };
