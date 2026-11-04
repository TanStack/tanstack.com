import type { SkillVersion } from '../core/skills'
import './skills.css'

export function SkillPreview({
  skill,
  unsaved = false,
}: {
  skill: Pick<SkillVersion, 'version' | 'document' | 'origin' | 'kodyOrigin'>
  unsaved?: boolean
}) {
  const document = skill.document
  return (
    <div className="skill-preview">
      <div className="skill-preview-heading">
        <strong>{document.name}</strong>
        <span>
          {unsaved
            ? 'Unsaved'
            : skill.kodyOrigin
              ? 'Synced skill'
              : `${skill.origin?.installationName ?? 'Personal'} · v${skill.version}`}
        </span>
      </div>
      <p>{document.description}</p>
      <pre className="skill-instructions">{document.instructions}</pre>
      {(document.license ||
        document.compatibility ||
        document.allowedTools ||
        Object.keys(document.metadata ?? {}).length > 0) && (
        <details className="skill-metadata">
          <summary>File metadata</summary>
          <dl>
            {document.license && (
              <>
                <dt>License</dt>
                <dd>{document.license}</dd>
              </>
            )}
            {document.compatibility && (
              <>
                <dt>Compatibility</dt>
                <dd>{document.compatibility}</dd>
              </>
            )}
            {document.allowedTools && (
              <>
                <dt>Declared tools</dt>
                <dd>{document.allowedTools}. This does not grant access.</dd>
              </>
            )}
            {Object.entries(document.metadata ?? {}).map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </div>
  )
}
