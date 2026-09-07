/** ChatGPT / Codex authorization card backed by the generic Remote seam. */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import type {
  AuthorizationAttemptSnapshot, AuthorizationListEntry,
} from '@deepseek-ai/dsh-api-remotes/client'
import type { TypertClientRemote } from '@deepseek-ai/dsh-typert-protocol'
import styles from './ModelsSection.module.css'
import type { en } from './locales.ts'

const CODEX_KEY = 'llm-pi-ai/openai-codex'

/** Props for the login card; the Remote never returns token values. */
export interface ChatGptAuthCardProps {
  /** Browser-safe authorization Remote face. */
  remote: TypertClientRemote['authorization']
  /** Models namespace translation. */
  t: (key: keyof typeof en) => string
}

/** Render login state and interactive browser/device methods for ChatGPT. */
export function ChatGptAuthCard({ remote, t }: ChatGptAuthCardProps): ReactNode {
  const [entry, setEntry] = useState<AuthorizationListEntry | null>(null)
  const [attempt, setAttempt] = useState<AuthorizationAttemptSnapshot | null>(null)
  const [answer, setAnswer] = useState('')
  const [error, setError] = useState<string | null>(null)
  const watchAbort = useRef<AbortController | null>(null)

  const refresh = (): void => {
    void remote.list().then((result) => {
      if (!result.ok) {
        setError(`${result.error.code}: ${result.error.message}`)
        return
      }
      setEntry(result.value.entries.find(candidate => String(candidate.key) === CODEX_KEY) ?? null)
    })
  }

  useEffect(() => {
    refresh()
    return () => { watchAbort.current?.abort() }
  }, [])
  useEffect(() => { setAnswer('') }, [attempt?.promptId])

  const begin = (method: string): void => {
    if (entry === null) return
    setError(null)
    void remote.begin({ key: entry.key, method }).then(async (result) => {
      if (!result.ok) {
        setError(`${result.error.code}: ${result.error.message}`)
        return
      }
      const controller = new AbortController()
      watchAbort.current?.abort()
      watchAbort.current = controller
      for await (const frame of remote.watch({ attemptId: result.value.attemptId }, controller.signal)) {
        setAttempt(frame.value)
        if (frame.value.status === 'authorized') refresh()
      }
    }).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : String(reason))
    })
  }

  const cancel = (): void => {
    if (attempt === null) return
    void remote.cancel({ attemptId: attempt.attemptId })
  }

  const logout = (): void => {
    if (entry === null) return
    setError(null)
    void remote.logout({ key: entry.key }).then((result) => {
      if (!result.ok) setError(`${result.error.code}: ${result.error.message}`)
      refresh()
    })
  }

  const respond = (value: string): void => {
    if (attempt?.promptId === undefined) return
    void remote.respond({ attemptId: attempt.attemptId, promptId: attempt.promptId, answer: value })
      .then((result) => {
        if (!result.ok) setError(`${result.error.code}: ${result.error.message}`)
        else setAnswer('')
      })
  }

  if (entry === null) return null
  const running = attempt?.status === 'running'
  return (
    <section className={styles['authCard']} aria-labelledby="chatgpt-auth-title">
      <div className={styles['rowHead']}>
        <span>
          <strong id="chatgpt-auth-title" className={styles['rowName']}>{t('chatgpt.title')}</strong>
          <span className={styles['authBackend']}>{t('chatgpt.compatBackend')}</span>
        </span>
        <span className={styles['authStatus']} data-configured={entry.configured}>
          {entry.configured ? t('chatgpt.connected') : t('chatgpt.disconnected')}
        </span>
      </div>
      <p className={styles['intro']}>{t('chatgpt.description')}</p>
      {attempt?.notice === undefined ? null : (
        <div className={styles['authNotice']} role="status">
          <span>{attempt.notice.message}</span>
          {attempt.notice.url === undefined ? null : (
            <a href={attempt.notice.url} target="_blank" rel="noreferrer">{t('chatgpt.openLogin')}</a>
          )}
          {attempt.notice.code === undefined ? null : <code>{attempt.notice.code}</code>}
        </div>
      )}
      {attempt?.status === 'failed' ? <p className={styles['error']}>{attempt.error}</p> : null}
      {attempt?.prompt === undefined ? null : (
        <div className={styles['authPrompt']}>
          <span className={styles['fieldLabel']}>{attempt.prompt.message}</span>
          {attempt.prompt.kind === 'select'
            ? (
              <div className={styles['rowActions']}>
                {attempt.prompt.options.map(option => (
                  <button
                    key={option.id}
                    type="button"
                    className={styles['secondaryButton']}
                    title={option.description}
                    onClick={() => { respond(option.id) }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )
            : (
              <form onSubmit={(event) => { event.preventDefault(); respond(answer) }}>
                <input
                  className={styles['input']}
                  type={attempt.prompt.kind === 'secret' ? 'password' : 'text'}
                  autoComplete="off"
                  aria-label={attempt.prompt.message}
                  placeholder={attempt.prompt.placeholder}
                  value={answer}
                  onChange={(event) => { setAnswer(event.target.value) }}
                />
                <button type="submit" className={styles['primaryButton']} disabled={answer === ''}>
                  {t('chatgpt.respond')}
                </button>
              </form>
            )}
        </div>
      )}
      {error === null ? null : <p className={styles['error']}>{error}</p>}
      <div className={styles['rowActions']}>
        {running
          ? <button type="button" className={styles['secondaryButton']} onClick={cancel}>{t('chatgpt.cancel')}</button>
          : entry.methods.map((method, index) => (
            <button
              key={method.id}
              type="button"
              className={index === 0 ? styles['primaryButton'] : styles['secondaryButton']}
              onClick={() => { begin(method.id) }}
            >
              {method.label}
            </button>
          ))}
        {entry.configured && !running
          ? <button type="button" className={styles['dangerButton']} onClick={logout}>{t('chatgpt.logout')}</button>
          : null}
      </div>
    </section>
  )
}
