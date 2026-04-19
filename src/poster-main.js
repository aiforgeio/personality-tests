import {
  cleanupPosterSessions,
  isWeChatBrowser,
  readPosterSession,
  removePosterSession,
  resolvePosterHomeUrl,
} from './poster-storage.js'

function setText(element, value) {
  if (!element) return
  const text = String(value ?? '').trim()
  element.textContent = text
  element.hidden = !text
}

const els = {
  back: document.getElementById('poster-save-back'),
  kicker: document.getElementById('poster-save-kicker'),
  title: document.getElementById('poster-save-title'),
  body: document.getElementById('poster-save-body'),
  wechatNote: document.getElementById('poster-save-wechat-note'),
  imageWrap: document.getElementById('poster-save-stage'),
  image: document.getElementById('poster-save-image'),
  empty: document.getElementById('poster-save-empty'),
}

const params = new URLSearchParams(window.location.search)
const token = params.get('token') || ''
const sessionRecord = readPosterSession(token)
const fallbackHref = sessionRecord?.returnUrl || resolvePosterHomeUrl()

cleanupPosterSessions({ keepTokens: token ? [token] : [] })

if (els.back) {
  els.back.href = fallbackHref
  els.back.addEventListener('click', (event) => {
    removePosterSession(token)

    if (window.history.length > 1) {
      event.preventDefault()
      window.history.back()
    }
  })
}

if (sessionRecord?.dataUrl && els.image) {
  document.title = `${sessionRecord.title || '人格测试'}海报`
  els.image.src = sessionRecord.dataUrl
  els.image.hidden = false
  if (els.imageWrap) els.imageWrap.hidden = false
  if (els.empty) els.empty.hidden = true

  setText(els.kicker, '海报已生成')
  setText(els.title, '长按图片保存到相册')
  setText(els.body, '图片已经准备好，长按下方海报即可保存到手机。')

  if (isWeChatBrowser()) {
    setText(els.wechatNote, '如果在微信里仍保存失败，请点右上角在浏览器打开后再保存。')
  }
} else {
  document.title = '海报未找到'
  if (els.imageWrap) els.imageWrap.hidden = true
  if (els.empty) els.empty.hidden = false
  setText(els.kicker, '海报已失效')
  setText(els.title, '请返回结果页重新生成')
  setText(els.body, '这个保存页只会在你刚生成海报后短暂可用。')
  setText(els.wechatNote, '')

  if (els.back) {
    els.back.textContent = '返回首页'
  }
}
