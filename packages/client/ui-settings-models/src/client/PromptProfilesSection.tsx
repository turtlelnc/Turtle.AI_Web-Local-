/** Prompt Profile settings section with immutable custom revisions. */

import { useEffect, useState, type ReactNode } from 'react'
import type {
  PromptProfileDefinition, PromptProfileDraft, PromptProfileId,
} from '@deepseek-ai/dsh-api-remotes/client'
import type { TypertClientRemote } from '@deepseek-ai/dsh-typert-protocol'
import styles from './ModelsSection.module.css'
import type { en } from './locales.ts'

/** Injected dependencies of the Prompt Profiles settings section. */
export interface PromptProfilesSectionInjected {
  /** Session Remote owns the profile catalog and authoring verbs. */
  remote: TypertClientRemote['session']
  /** Settings Models namespace translation. */
  t: (key: keyof typeof en) => string
}

/** Slot-delivered props may be absent while dependencies activate. */
export type PromptProfilesSectionProps = Partial<PromptProfilesSectionInjected>

const EMPTY_DRAFT: PromptProfileDraft = {
  name: '',
  base: 'codex',
  additionalInstructions: '',
  behavior: { progressUpdates: 'inherit', responseDetail: 'inherit' },
}

/** Render built-in defaults plus constrained custom profile authoring. */
export function PromptProfilesSection({ remote, t }: PromptProfilesSectionProps): ReactNode {
  const [profiles, setProfiles] = useState<readonly PromptProfileDefinition[]>([])
  const [draft, setDraft] = useState<PromptProfileDraft | null>(null)
  const [editing, setEditing] = useState<PromptProfileId | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = (): void => {
    if (remote === undefined) return
    void remote.promptProfileCatalog().then((result) => {
      if (!result.ok) setError(`${result.error.code}: ${result.error.message}`)
      else setProfiles(result.value.profiles)
    })
  }
  useEffect(load, [remote])

  if (remote === undefined || t === undefined) return null

  const edit = (profile: PromptProfileDefinition): void => {
    setEditing(profile.id)
    setDraft({
      name: profile.name,
      base: profile.base,
      additionalInstructions: profile.additionalInstructions,
      behavior: { ...profile.behavior },
    })
  }

  const save = (): void => {
    if (draft === null) return
    setError(null)
    const operation = editing === null
      ? remote.createPromptProfile({ profile: draft })
      : remote.updatePromptProfile({ profileId: editing, profile: draft })
    void operation.then((result) => {
      if (!result.ok) {
        setError(`${result.error.code}: ${result.error.message}`)
        return
      }
      setDraft(null)
      setEditing(null)
      load()
    })
  }

  const remove = (profileId: PromptProfileId): void => {
    void remote.removePromptProfile({ profileId }).then((result) => {
      if (!result.ok) setError(`${result.error.code}: ${result.error.message}`)
      else load()
    })
  }

  return (
    <div className={styles['section']}>
      <h2 className={styles['title']}>{t('profiles.title')}</h2>
      <p className={styles['intro']}>{t('profiles.intro')}</p>
      <p className={styles['profileMapping']}>{t('profiles.mapping')}</p>
      <ul className={styles['rows']}>
        {profiles.map(profile => (
          <li key={`${profile.id}:${profile.revision}`} className={styles['rowCard']}>
            <div className={styles['rowHead']}>
              <span className={styles['rowIdentity']}>
                <span className={styles['rowName']}>{profile.name}</span>
                <span className={styles['rowTag']}>{profile.base}</span>
                <span className={styles['rowTag']}>{t('profiles.revisionPrefix')}{profile.revision}</span>
              </span>
              {!profile.builtIn && (
                <span className={styles['rowActions']}>
                  <button type="button" className={styles['secondaryButton']} onClick={() => { edit(profile) }}>
                    {t('edit')}
                  </button>
                  <button type="button" className={styles['dangerButton']} onClick={() => { remove(profile.id) }}>
                    {t('remove')}
                  </button>
                </span>
              )}
            </div>
            {profile.additionalInstructions === '' ? null : (
              <p className={styles['profileInstructions']}>{profile.additionalInstructions}</p>
            )}
          </li>
        ))}
      </ul>
      {draft === null
        ? (
          <button type="button" className={styles['addButton']} onClick={() => { setDraft(EMPTY_DRAFT) }}>
            {t('profiles.create')}
          </button>
        )
        : (
          <div className={styles['editor']}>
            <label className={styles['field']}>
              <span className={styles['fieldLabel']}>{t('profiles.name')}</span>
              <input
                className={styles['input']}
                value={draft.name}
                onChange={(event) => { setDraft({ ...draft, name: event.target.value }) }}
              />
            </label>
            <label className={styles['field']}>
              <span className={styles['fieldLabel']}>{t('profiles.base')}</span>
              <select
                className={`${styles['input']} ${styles['selectInput']}`}
                value={draft.base}
                onChange={(event) => { setDraft({ ...draft, base: event.target.value as PromptProfileDraft['base'] }) }}
              >
                <option value="codex">{t('profiles.base.codex')}</option>
                <option value="deepseek-harness">{t('profiles.base.deepseekHarness')}</option>
              </select>
            </label>
            <label className={styles['field']}>
              <span className={styles['fieldLabel']}>{t('profiles.instructions')}</span>
              <textarea
                className={`${styles['input']} ${styles['profileTextarea']}`}
                value={draft.additionalInstructions}
                onChange={(event) => { setDraft({ ...draft, additionalInstructions: event.target.value }) }}
              />
            </label>
            <div className={styles['rowActions']}>
              <button type="button" className={styles['secondaryButton']} onClick={() => { setDraft(null); setEditing(null) }}>
                {t('cancel')}
              </button>
              <button type="button" className={styles['primaryButton']} disabled={draft.name.trim() === ''} onClick={save}>
                {t('apply')}
              </button>
            </div>
          </div>
        )}
      {error === null ? null : <p className={styles['error']}>{error}</p>}
    </div>
  )
}
