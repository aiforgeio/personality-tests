import fs from 'node:fs/promises'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const hostRoot = path.resolve(__dirname, '..')
const repoRoot = path.resolve(hostRoot, '..')

const ABTI_ROOT = path.join(repoRoot, 'ABTI')
const MPTI_ROOT = path.join(repoRoot, 'MPTI')
const DATA_ROOT = path.join(hostRoot, 'data', 'tests')

const TRI_LEVEL_RULES = [
  { code: 'L', label: 'L', min: Number.NEGATIVE_INFINITY, max: 4 },
  { code: 'M', label: 'M', min: 4, max: 5 },
  { code: 'H', label: 'H', min: 5, max: Number.POSITIVE_INFINITY },
]

const QUAD_LEVEL_RULES = [
  { code: 'L', label: 'L', min: Number.NEGATIVE_INFINITY, max: 2 },
  { code: 'M', label: 'M', min: 2, max: 3 },
  { code: 'H', label: 'H', min: 3, max: 4 },
  { code: 'X', label: 'X', min: 4, max: Number.POSITIVE_INFINITY },
]

function stripInfinity(rule) {
  return Object.fromEntries(
    Object.entries(rule).filter(([, value]) => Number.isFinite(value) || typeof value === 'string'),
  )
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true })
}

async function writeJson(filePath, value) {
  await ensureDir(path.dirname(filePath))
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function resetDir(dirPath) {
  await fs.rm(dirPath, { recursive: true, force: true })
  await ensureDir(dirPath)
}

function pickSummaryLabel(label, dimensionId) {
  return String(label || '')
    .replace(new RegExp(`^${dimensionId}\\s*`, 'i'), '')
    .trim() || dimensionId
}

function parsePattern(pattern, order) {
  const raw = String(pattern || '').replace(/-/g, '').trim().split('')
  return Object.fromEntries(order.map((dimensionId, index) => [dimensionId, raw[index]]))
}

function toQuestion(question) {
  return {
    id: question.id,
    prompt: question.text,
    dim: question.dim,
    kind: question.kind,
    special: Boolean(question.special),
    options: (question.options || []).map((option, index) => ({
      id: option.id ?? `option-${index + 1}`,
      label: option.label,
      value: option.value,
    })),
  }
}

function toDimensionMeta(dimensionMeta = {}) {
  return Object.fromEntries(
    Object.entries(dimensionMeta).map(([dimensionId, meta]) => [
      dimensionId,
      {
        label: meta.name || dimensionId,
        summaryLabel: pickSummaryLabel(meta.name, dimensionId),
        model: meta.model || '',
      },
    ]),
  )
}

function toOutcome(code, source, extras = {}) {
  return {
    code,
    alias: source.cn || source.alias || source.name || '',
    badge: source.intro || source.badge || '',
    brief: source.desc || source.brief || '',
    description: source.desc || source.description || '',
    note: source.note || '',
    image: extras.image || '',
    rarity: source.rarity || extras.rarity || '',
    tags: source.tags || [],
    scenes: source.scenes || [],
    mantras: source.mantras || [],
    tips: source.tips || [],
    reasons: source.reasons || [],
  }
}

function extractAbtiScript(source) {
  const startMarker = 'const dimensionMeta ='
  const endMarker = 'const app = {'
  const start = source.indexOf(startMarker)
  const end = source.indexOf(endMarker)

  if (start < 0 || end < 0 || end <= start) {
    throw new Error('Unable to locate ABTI data section')
  }

  return source.slice(start, end)
}

async function loadAbtiSource() {
  const html = await fs.readFile(path.join(ABTI_ROOT, 'index.html'), 'utf8')
  const snippet = `${extractAbtiScript(html)}
globalThis.__abti = {
  dimensionMeta,
  questions,
  specialQuestions,
  TYPE_LIBRARY,
  TYPE_IMAGES,
  NORMAL_TYPES,
  DIM_EXPLANATIONS,
  dimensionOrder,
}
`

  const context = {}
  vm.runInNewContext(snippet, context, { filename: 'ABTI/index.html' })
  return context.__abti
}

async function loadMptiSource() {
  const source = await fs.readFile(path.join(MPTI_ROOT, 'assets', 'mpti-data.js'), 'utf8')
  const context = { window: {} }
  vm.runInNewContext(source, context, { filename: 'MPTI/assets/mpti-data.js' })
  return context.window.MPTI_DATA
}

async function copyImages(sourceDir, targetDir) {
  await fs.cp(sourceDir, targetDir, {
    recursive: true,
    force: true,
  })
}

async function importAbti() {
  const data = await loadAbtiSource()
  const outputDir = path.join(DATA_ROOT, 'abti')
  await resetDir(outputDir)

  const dimensions = {
    order: data.dimensionOrder,
    meta: toDimensionMeta(data.dimensionMeta),
    explanations: data.DIM_EXPLANATIONS,
    sumToLevel: Object.fromEntries(
      data.dimensionOrder.map((dimensionId) => [dimensionId, TRI_LEVEL_RULES.map(stripInfinity)]),
    ),
  }

  const outcomes = Object.entries(data.TYPE_LIBRARY).map(([code, source]) => {
    const image = data.TYPE_IMAGES[code] || ''
    return toOutcome(code, source, { image })
  })

  const patterns = {
    normalTypes: data.NORMAL_TYPES.map((type) => ({
      code: type.code,
      dimensions: parsePattern(type.pattern, data.dimensionOrder),
    })),
  }

  const manifest = {
    id: 'abti',
    scorerId: 'dimension-pattern-matcher',
    questionsPath: './questions.json',
    outcomesPath: './outcomes.json',
    specialQuestionsPath: './special-questions.json',
    dimensionsPath: './dimensions.json',
    patternsPath: './patterns.json',
    meta: {
      browserTitle: 'ABTI 科研人格测试',
      description: '30 道题、15 个维度、26 种科研人格结果的趣味测试。',
      version: '1.0.0',
    },
    display: {
      introEyebrow: 'ABTI · 科研人格测试',
      introTitle: '测测你的科研人格',
      subtitle: '30 道科研场景题，从 5 大模型和 15 个维度看看你最像哪一种科研人格。',
      statsLine: '30 道维度题 · 26 种科研人格 · 即测即出结果',
      estimatedDurationLabel: '预计 3-4 分钟',
      secondaryNote: '围绕课题、投稿、导师、合作和焦虑状态设计，结果更有代入感。',
      trustBadges: ['免费体验', '无需登录', '可保存结果海报'],
      benefits: [
        {
          title: '科研场景更真实',
          text: '题目围绕选题、投稿、DDL、组会和学术社交展开，不是抽象性格问答。',
        },
        {
          title: '结果更像你身边的人',
          text: '每种人格都有鲜明的科研画像和一句话标签，方便对照和分享。',
        },
        {
          title: '维度解释更直观',
          text: '除了人格类型，还能看到十五个维度的强弱分布，理解结果更完整。',
        },
      ],
      spotlightCodes: ['STAR', 'PI-er', 'PAPER'],
      disclaimer: '本测试仅供娱乐，请勿将结果用于学术评价、毕业判断、职称评审或基金申请。',
      startButtonLabel: '开始测试',
      restartButtonLabel: '重新测试',
      downloadButtonLabel: '保存结果海报',
      loadingMessages: [
        '正在分析你的科研行为模式',
        '正在匹配科研人格类型',
        '正在整理十五维度分布',
        '你的科研人格即将揭晓',
      ],
    },
    flow: {
      mode: 'conditional',
      shuffleQuestions: true,
      staticInsertions: [
        { questionId: 'quit_gate_q1', strategy: 'random-slot', minIndex: 1 },
      ],
    },
    specialLogic: {
      gateQuestionId: 'quit_gate_q1',
      gateValues: [3],
      insertQuestionId: 'quit_gate_q2',
      insertAfterQuestionId: 'quit_gate_q1',
      triggerQuestionId: 'quit_gate_q2',
      triggerValue: 2,
      hiddenTypeCode: 'QUIT',
      fallbackTypeCode: '404',
      similarityFloor: 60,
    },
    assets: {
      posterMode: 'image',
    },
    resultTemplate: {
      sections: [
        { id: 'hero-art', type: 'image-panel', group: 'hero-top', card: true },
        { id: 'hero-summary', type: 'hero-summary', group: 'hero-top', card: true },
        { id: 'stats', type: 'stats-inline', source: 'meta.stats' },
        { id: 'dimensions', type: 'dimension-list', title: '十五维度分布', source: 'dimensions' },
      ],
      disclaimer: {
        source: 'pack.display.disclaimer',
      },
    },
    shareConfig: {
      title: 'ABTI 科研人格测试',
      linkCopyText: '来测测你的科研人格类型',
      promptTitle: '这个科研人格很适合发给朋友对照一下',
      promptBody: '生成结果海报发给朋友，看看你们谁更像论文机器、未来 PI 或学术坦克。',
      inlinePromptTitle: '把这张科研人格海报发给朋友对照一下',
      inlinePromptBody: '一键生成结果海报，看看你们谁更像 STAR，谁又更像 SOS。',
      inlinePrimaryActionLabel: '生成结果海报',
      primaryActionLabel: '生成海报',
      secondaryActionLabel: '分享链接',
      floatingLabel: '生成海报',
      nudgeLabel: '生成海报，发给朋友',
      revealToast: '结果海报已经准备好，发给朋友一起测测看',
      footer: 'ABTI · 科研人格测试 · 仅供娱乐',
      rankingTitle: '常规人格 TOP 3',
      rankingLimit: 3,
      badgeLabel: '匹配度',
      filenamePrefix: 'ABTI',
      badgeText: '你的科研人格是',
      qrLabel: '扫码测测你的科研人格',
    },
    features: {
      gallery: true,
      leaderboard: true,
      analytics: true,
    },
  }

  await Promise.all([
    writeJson(path.join(outputDir, 'manifest.json'), manifest),
    writeJson(path.join(outputDir, 'questions.json'), data.questions.map(toQuestion)),
    writeJson(path.join(outputDir, 'special-questions.json'), data.specialQuestions.map(toQuestion)),
    writeJson(path.join(outputDir, 'dimensions.json'), dimensions),
    writeJson(path.join(outputDir, 'patterns.json'), patterns),
    writeJson(path.join(outputDir, 'outcomes.json'), outcomes),
    copyImages(path.join(ABTI_ROOT, 'images'), path.join(outputDir, 'images')),
  ])
}

async function importMpti() {
  const data = await loadMptiSource()
  const outputDir = path.join(DATA_ROOT, 'mpti')
  await resetDir(outputDir)

  const dimensions = {
    order: data.dimensionOrder,
    meta: toDimensionMeta(data.dimensionMeta),
    explanations: data.dimExplanations,
    sumToLevel: Object.fromEntries(
      data.dimensionOrder.map((dimensionId) => [dimensionId, QUAD_LEVEL_RULES.map(stripInfinity)]),
    ),
  }

  const outcomes = Object.values(data.typeLibrary).map((source) => (
    toOutcome(source.code, source, { image: `./images/${source.code}/${source.code}.webp` })
  ))

  const patterns = {
    normalTypes: data.normalTypes.map((type) => ({
      code: type.code,
      dimensions: parsePattern(type.pattern, data.dimensionOrder),
    })),
  }

  const manifest = {
    id: 'mpti',
    scorerId: 'dimension-pattern-matcher',
    questionsPath: './questions.json',
    outcomesPath: './outcomes.json',
    specialQuestionsPath: './special-questions.json',
    dimensionsPath: './dimensions.json',
    patternsPath: './patterns.json',
    meta: {
      browserTitle: 'MPTI 导师人格测试',
      description: '18 道题、18 个维度、18 种导师人格结果的趣味测试。',
      version: '1.0.0',
    },
    display: {
      introEyebrow: 'MPTI · 导师人格测试',
      introTitle: '测一测，你的导师到底是哪种带组生物？',
      subtitle: '从学生视角出发，用 18 个维度快速勾勒一位导师最接近哪种人格画像。',
      statsLine: '18 道维度题 · 18 种导师人格 · 即测即出结果',
      estimatedDurationLabel: '预计 2-3 分钟',
      secondaryNote: '围绕带组、反馈、边界、资源和署名等真实体验设计，结果更容易对号入座。',
      trustBadges: ['免费体验', '无需登录', '可保存结果海报'],
      benefits: [
        {
          title: '视角很统一',
          text: '所有题目都从学生真实体验出发，集中看导师在推进、反馈和资源分配上的风格。',
        },
        {
          title: '四档更细',
          text: '18 个维度采用 L/M/H/X 四档差异，能把普通高位和极端高位分得更开。',
        },
        {
          title: '结果更有戏',
          text: '既能命中常规导师人格，也保留量子导师和 NULL 这种隐藏/兜底结果。',
        },
      ],
      spotlightCodes: ['GOAT', 'CTRL', 'WIFI'],
      disclaimer: '本测试仅供娱乐，请勿将结果用于正式投诉、评价、选导决策或任何现实判断。',
      startButtonLabel: '开始测试',
      restartButtonLabel: '重新测试',
      downloadButtonLabel: '保存结果海报',
      loadingMessages: [
        '正在分析这位导师的带组风格',
        '正在匹配导师人格类型',
        '正在整理十八维度观察结果',
        '这位导师的画像即将揭晓',
      ],
    },
    flow: {
      mode: 'conditional',
      shuffleQuestions: true,
      staticInsertions: [
        { questionId: 'ghost_gate_q1', strategy: 'random-slot', minIndex: 1 },
      ],
    },
    specialLogic: {
      gateQuestionId: data.specialLogic.gateQuestionId,
      gateValues: data.specialLogic.gateValues,
      insertQuestionId: data.specialLogic.insertQuestionId,
      insertAfterQuestionId: data.specialLogic.gateQuestionId,
      triggerQuestionId: data.specialLogic.triggerQuestionId,
      triggerValue: data.specialLogic.triggerValue,
      hiddenTypeCode: data.specialLogic.hiddenTypeCode,
      fallbackTypeCode: 'NULL',
      similarityFloor: 60,
    },
    assets: {
      posterMode: 'image',
    },
    resultTemplate: {
      sections: [
        { id: 'hero-art', type: 'image-panel', group: 'hero-top', card: true },
        { id: 'hero-summary', type: 'hero-summary', group: 'hero-top', card: true },
        { id: 'stats', type: 'stats-inline', source: 'meta.stats' },
        { id: 'dimensions', type: 'dimension-list', title: '十八维度分布', source: 'dimensions' },
      ],
      disclaimer: {
        source: 'pack.display.disclaimer',
      },
    },
    shareConfig: {
      title: 'MPTI 导师人格测试',
      linkCopyText: '来测测你的导师人格类型',
      promptTitle: '这个导师人格很适合发给朋友对照一下',
      promptBody: '生成结果海报发给朋友，看看你们的导师更像 GOAT、CTRL 还是量子 WIFI。',
      inlinePromptTitle: '把这张导师人格海报发给朋友对照一下',
      inlinePromptBody: '一键生成结果海报，看看谁的导师更像 GOAT，谁又更像 NULL。',
      inlinePrimaryActionLabel: '生成结果海报',
      primaryActionLabel: '生成海报',
      secondaryActionLabel: '分享链接',
      floatingLabel: '生成海报',
      nudgeLabel: '生成海报，发给朋友',
      revealToast: '结果海报已经准备好，发给朋友一起对照导师人格',
      footer: 'MPTI · 导师人格测试 · 仅供娱乐',
      rankingTitle: '常规人格 TOP 3',
      rankingLimit: 3,
      badgeLabel: '匹配度',
      filenamePrefix: 'MPTI',
      badgeText: '你抽到的导师人格是',
      qrLabel: '扫码测测导师人格',
    },
    features: {
      gallery: true,
      leaderboard: true,
      analytics: true,
    },
  }

  await Promise.all([
    writeJson(path.join(outputDir, 'manifest.json'), manifest),
    writeJson(path.join(outputDir, 'questions.json'), data.questions.map(toQuestion)),
    writeJson(path.join(outputDir, 'special-questions.json'), data.specialQuestions.map(toQuestion)),
    writeJson(path.join(outputDir, 'dimensions.json'), dimensions),
    writeJson(path.join(outputDir, 'patterns.json'), patterns),
    writeJson(path.join(outputDir, 'outcomes.json'), outcomes),
    copyImages(path.join(MPTI_ROOT, 'images'), path.join(outputDir, 'images')),
  ])
}

async function main() {
  await importAbti()
  await importMpti()
  console.log('Imported legacy ABTI and MPTI packs into GBTI/data/tests.')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
