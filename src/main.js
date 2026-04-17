import { createAppController } from './app-controller.js'
import './style.css'

const TEST_SHELL_HTML = `
  <section id="page-intro" class="page active" aria-label="欢迎页">
    <div class="bg-orbs" aria-hidden="true">
      <div class="bg-orb bg-orb-1"></div>
      <div class="bg-orb bg-orb-2"></div>
      <div class="bg-orb bg-orb-3"></div>
    </div>

    <div class="intro-shell">
      <div class="card intro-card glass-card">
        <div class="intro-eyebrow" id="intro-eyebrow"></div>
        <h1 class="intro-title" id="intro-title"></h1>
        <p class="intro-subtitle" id="intro-subtitle"></p>
        <div class="intro-stats-badge" id="intro-stats-line"></div>
        <p class="intro-secondary-note" id="intro-secondary-note"></p>
        <div class="intro-social-proof">
          <span class="social-proof-icon">🔥</span>
          <span class="social-proof-text">已有 <strong>12,847</strong> 人完成测试</span>
        </div>
        <div class="intro-actions">
          <button id="btn-start" class="btn btn-primary btn-pulse btn-large">
            <span class="btn-text">开始测试</span>
            <span class="btn-icon">→</span>
          </button>
        </div>
        <div class="intro-trust" id="intro-trust"></div>
      </div>

      <div class="intro-grid intro-facts" id="intro-facts"></div>
      <div class="intro-grid intro-benefits" id="intro-benefits"></div>
      <div class="intro-spotlight-section" id="intro-spotlight-section">
        <div class="section-label">示例结果预览</div>
        <div class="intro-grid intro-spotlight" id="intro-spotlight"></div>
      </div>
      <div class="intro-footer">
        <p class="intro-note" id="intro-note"></p>
      </div>
    </div>
  </section>

  <section id="page-quiz" class="page" aria-label="答题页">
    <div class="quiz-wrapper">
      <div class="quiz-header">
        <div class="progress-bar" role="progressbar" aria-label="答题进度">
          <div class="progress-fill" id="progress-fill"></div>
        </div>
        <div class="progress-info">
          <span class="progress-text" id="progress-text">0 / 30</span>
          <span class="progress-percent" id="progress-percent">0%</span>
        </div>
      </div>

      <div class="card quiz-card glass-card" id="quiz-card">
        <div class="question-kicker" id="question-kicker">第 1 题</div>
        <div class="question-area">
          <p class="question-caption" id="question-caption"></p>
          <p class="question-text" id="question-text"></p>
          <p class="question-description" id="question-description"></p>
        </div>
        <div class="options" id="options" role="group" aria-label="选项"></div>
        <div class="quiz-footer" id="quiz-footer">
          <div class="question-mode-note" id="question-mode-note"></div>
          <div class="quiz-nav">
            <button id="btn-prev-question" class="btn btn-ghost btn-back" aria-label="返回上一题">
              <span class="btn-back-icon">←</span>
              <span>上一题</span>
            </button>
            <div class="quiz-hint">选择即跳转</div>
          </div>
        </div>
      </div>

      <div class="swipe-hint" id="swipe-hint" aria-hidden="true">
        <span>← 右滑返回上一题</span>
      </div>
    </div>
  </section>

  <section id="page-loading" class="page" aria-label="分析中" aria-live="polite">
    <div class="loading-container">
      <div class="loading-animation" aria-hidden="true">
        <div class="loading-orbit loading-orbit-outer">
          <div class="loading-planet loading-planet-1"></div>
        </div>
        <div class="loading-orbit loading-orbit-mid">
          <div class="loading-planet loading-planet-2"></div>
        </div>
        <div class="loading-core">
          <span class="loading-core-icon">📊</span>
        </div>
      </div>

      <div class="loading-messages" id="loading-messages">
        <p class="loading-message" data-index="0">正在分析你的性格特征</p>
        <p class="loading-message" data-index="1">正在匹配测试结果类型</p>
        <p class="loading-message" data-index="2">正在计算维度分布</p>
        <p class="loading-message" data-index="3">即将揭晓你的专属结果</p>
      </div>

      <div class="loading-progress-bar">
        <div class="loading-progress-fill" id="loading-progress-fill"></div>
      </div>
    </div>
  </section>

  <section id="page-result" class="page" aria-label="测试结果">
    <div class="result-wrapper">
      <div class="result-share-card" id="result-share-card">
        <div class="share-card-orbs" aria-hidden="true">
          <div class="share-orb share-orb-1"></div>
          <div class="share-orb share-orb-2"></div>
        </div>

        <div class="share-card-header">
          <span class="share-card-badge" id="share-card-badge">你的结果类型是</span>
        </div>

        <div class="result-hero-grid" id="result-hero-grid">
          <div class="result-hero-image-wrap" id="result-hero-image-wrap"></div>
          <div class="result-hero-summary" id="result-hero-summary"></div>
        </div>

        <div class="result-key-stats" id="result-key-stats"></div>

        <div class="result-inline-share" id="result-inline-share">
          <div class="result-inline-share-copy">
            <p class="result-inline-share-title" id="result-inline-share-title">这个结果很适合发给朋友对照一下</p>
            <p class="result-inline-share-body" id="result-inline-share-body">生成结果海报发给朋友，看看你们分别更像哪一种类型。</p>
          </div>
          <button id="btn-inline-download" class="btn btn-primary btn-inline-share">
            <span class="btn-icon-left">🖼️</span>
            <span>生成结果海报</span>
          </button>
        </div>

        <div class="result-tags-section" id="result-tags-section"></div>

        <div class="result-chart-section" id="result-chart-section">
          <div class="chart-title">十五维度分布</div>
          <div class="dimension-chart" id="dimension-chart"></div>
        </div>

        <div class="share-card-footer">
          <div class="share-card-qr" aria-label="扫码测试">
            <div class="qr-placeholder" id="qr-placeholder">
              <span class="qr-icon" id="qr-icon-fallback">📱</span>
            </div>
            <span class="qr-label">扫码测测你是什么型</span>
          </div>
          <div class="share-card-watermark">人格测试</div>
        </div>
      </div>

      <div class="result-detail-sections" id="result-detail-sections"></div>

      <div class="result-actions" id="result-actions" data-state="expanded" aria-expanded="true">
        <div class="result-actions-copy" id="result-actions-copy">
          <p class="result-actions-title" id="result-actions-title">觉得这个结果不错？</p>
          <p class="result-actions-body" id="result-actions-body">先生成结果海报，发给朋友扫码一起测</p>
        </div>
        <div class="result-actions-row">
          <button id="btn-download" class="btn btn-primary btn-action">
            <span class="btn-icon-left">🖼️</span>
            <span>保存结果海报</span>
          </button>
          <button id="btn-share" class="btn btn-secondary btn-action">
            <span class="btn-icon-left">🔗</span>
            <span>分享链接</span>
          </button>
        </div>
        <button id="btn-restart" class="btn btn-ghost btn-action">
          <span class="btn-icon-left">🔄</span>
          <span>再测一次</span>
        </button>
      </div>
    </div>
  </section>
`

function ensureTestShell(appRoot) {
  if (!appRoot) return
  if (document.getElementById('page-quiz')) return
  appRoot.innerHTML = TEST_SHELL_HTML
}

const appRoot = document.getElementById('app')
const manifestPath = appRoot?.dataset?.manifestPath || ''
const autoStart = appRoot?.dataset?.autoStart === 'true'

if (manifestPath) {
  ensureTestShell(appRoot)
}

const app = createAppController({ manifestPath, autoStart })

app.init()
