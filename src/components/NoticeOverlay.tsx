import type { NoticeMessage } from '../../shared/contracts/publicServer'
import type { Translate } from '../lib/i18n'
import './NoticeOverlay.css'

interface Props {
  notice: NoticeMessage | null
  onDismiss: (notice: NoticeMessage) => void
  onOpenControlCenter: () => void
  t: Translate
}

function formatNoticeDate(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

export function NoticeOverlay({ notice, onDismiss, onOpenControlCenter, t }: Props) {
  if (!notice) return null

  return (
    <div className={`notice-overlay ${notice.kind}`} role="dialog" aria-modal="true" aria-label={notice.title}>
      <div className="notice-card">
        <div className="notice-beam" />
        <div className="notice-head">
          <div>
            <div className="notice-eyebrow">{notice.kind === 'warning' ? t('notice.eyebrow.warning') : t('notice.eyebrow.realtime')}</div>
            <h2>{notice.title}</h2>
          </div>
          {notice.dismissible !== false && (
            <button className="notice-close" onClick={() => onDismiss(notice)} aria-label={t('common.close')}>&times;</button>
          )}
        </div>
        {notice.imageUrl && <img className="notice-image" src={notice.imageUrl} alt="" />}
        <p className="notice-body">{notice.body}</p>
        <div className="notice-meta">
          <span>{notice.force ? t('notice.meta.force') : t('notice.meta.soft')}</span>
          {notice.expiresAt && <span>{t('notice.meta.expires')}: {formatNoticeDate(notice.expiresAt)}</span>}
        </div>
        <div className="notice-actions">
          <button className="btn btn-primary" onClick={() => onDismiss(notice)}>
            {notice.dismissible === false ? t('notice.action.ackSession') : t('notice.action.dismiss')}
          </button>
          <button className="btn btn-secondary" onClick={onOpenControlCenter}>
            {t('notice.action.control')}
          </button>
        </div>
      </div>
    </div>
  )
}
