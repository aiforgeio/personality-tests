import fs from 'node:fs/promises'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '../..')
const hostRoot = path.resolve(__dirname, '..')

const LEVEL_RULES = [
  { code: 'L', label: 'L', min: -999999, max: 4 },
  { code: 'M', label: 'M', min: 4, max: 5 },
  { code: 'H', label: 'H', min: 5, max: 999999 },
]

const PACK_SPECS = [
  {
    id: 'gbti',
    sourceHtmlPath: path.join(repoRoot, 'GBTI-test/gbti/index.html'),
    sourceImageDir: path.join(repoRoot, 'GBTI-test/gbti/image'),
    outputDir: path.join(hostRoot, 'data/tests/gbti'),
    display: {
      introEyebrow: 'GBTI · 股民人格测试',
      introTitle: '测一测，你在股市里是「股神」还是「接盘侠」？',
      subtitle: '3 分钟快速评估你的交易风格与风险倾向，得到更清晰的投资行为画像。',
      statsLine: '30 道维度题 · 16 种交易人格 · 即测即出结果',
      estimatedDurationLabel: '预计 3-4 分钟',
      secondaryNote: '几分钟快速认识你的交易风格、风险偏好和操作习惯。',
      trustBadges: ['完全免费', '即测即看结果', '无需登录'],
      benefits: [
        { title: '题目接地气', text: '围绕追涨、止损、回撤、消息面等真实场景设计，不是空泛心理题。' },
        { title: '结果更有层次', text: '不只给你一个类型名，还会给出维度分布和命中理由，方便理解自己。' },
        { title: '娱乐但有启发', text: '轻松有梗的同时，帮你识别常见交易习惯，复盘时更容易抓住关键问题。' },
      ],
      spotlightCodes: ['TEN_JQKA', 'DEFENDER_A', 'GURU'],
      disclaimer: '本测试仅供娱乐，不构成投资建议。请根据自身风险承受能力进行决策。',
      startButtonLabel: '立即开始测试',
      restartButtonLabel: '重新测试',
      downloadButtonLabel: '保存分享图片',
    },
    meta: {
      browserTitle: 'GBTI 股民人格测试',
      description: '30 道题、15 个维度、16 种交易人格的趣味测试。',
      version: '2.0.0',
    },
    flow: {
      mode: 'conditional',
      shuffleQuestions: true,
      staticInsertions: [
        { questionId: 'margin_gate_q1', strategy: 'random-slot', minIndex: 1 },
      ],
    },
    specialLogic: {
      gateQuestionId: 'margin_gate_q1',
      gateValues: [3],
      insertQuestionId: 'margin_gate_q2',
      insertAfterQuestionId: 'margin_gate_q1',
      triggerQuestionId: 'margin_gate_q2',
      triggerValue: 2,
      hiddenTypeCode: 'TEN_JQKA',
      fallbackTypeCode: 'WATCHER',
      similarityFloor: 55,
    },
    shareConfig: {
      title: 'GBTI 股民人格测试',
      linkCopyText: '来测测你的股民人格类型',
      footer: 'GBTI · 股民人格测试 · 仅供娱乐',
      rankingTitle: '常规人格 TOP 3',
      rankingLimit: 3,
      badgeLabel: '匹配度',
      filenamePrefix: 'GBTI',
    },
    resultTemplate: {
      sections: [
        { id: 'hero-art', type: 'image-panel', group: 'hero-top', card: true },
        { id: 'hero-summary', type: 'hero-summary', group: 'hero-top', card: true },
        { id: 'stats', type: 'stats-inline', source: 'meta.stats' },
        { id: 'tags', type: 'tag-list', title: '人格标签', source: 'hero.tags', card: true },
        { id: 'reasons', type: 'bullet-list', title: '命中理由', source: 'hero.reasons', card: true },
        { id: 'scenes', type: 'bullet-list', title: '典型场景', source: 'hero.scenes', card: true },
        { id: 'mantras', type: 'bullet-list', title: '你常挂嘴边', source: 'hero.mantras', card: true },
        { id: 'tips', type: 'bullet-list', title: '给你的提醒', source: 'hero.tips', card: true },
        { id: 'dimensions', type: 'dimension-list', title: '十五维度分布', source: 'dimensions' },
      ],
      disclaimer: {
        source: 'pack.display.disclaimer',
      },
    },
    profileMode: 'gbti',
  },
  {
    id: 'sbti',
    sourceHtmlPath: path.join(repoRoot, 'SBTI-test/index.html'),
    sourceImageDir: path.join(repoRoot, 'SBTI-test/image'),
    outputDir: path.join(hostRoot, 'data/tests/sbti'),
    display: {
      introEyebrow: 'SBTI · 抽象人格测试',
      introTitle: 'MBTI 已经过时，SBTI 来了。',
      subtitle: '30 道题、15 个维度，帮你看看自己到底更像哪一种抽象人格。',
      statsLine: '30 道维度题 · 27 种人格结果 · 即测即出结果',
      estimatedDurationLabel: '预计 3-4 分钟',
      secondaryNote: '三四分钟完成测试，看看你更像哪一种抽象人格。',
      trustBadges: ['免费体验', '即测即出结果', '可保存结果图'],
      benefits: [
        { title: '题目更有代入感', text: '围绕日常反应、关系感受和行为偏好设计，回答起来更容易进入状态。' },
        { title: '结果更有记忆点', text: '每种人格都有清晰形象和一句话描述，方便分享和对照。' },
        { title: '维度分析更直观', text: '除了主人格，还能看到十五维度倾向，理解结果更完整。' },
      ],
      spotlightCodes: ['CTRL', 'DRUNK', 'HHHH'],
      disclaimer: '本测试仅供娱乐，不构成任何现实评判、医疗建议、招聘依据或恋爱审判。',
      startButtonLabel: '开始测试',
      restartButtonLabel: '重新测试',
      downloadButtonLabel: '保存分享图片',
    },
    meta: {
      browserTitle: 'SBTI 人格测试',
      description: '30 道题、15 个维度、27 种结果的趣味人格测试。',
      version: '2.0.0',
    },
    flow: {
      mode: 'conditional',
      shuffleQuestions: true,
      staticInsertions: [
        { questionId: 'drink_gate_q1', strategy: 'random-slot', minIndex: 1 },
      ],
    },
    specialLogic: {
      gateQuestionId: 'drink_gate_q1',
      gateValues: [3],
      insertQuestionId: 'drink_gate_q2',
      insertAfterQuestionId: 'drink_gate_q1',
      triggerQuestionId: 'drink_gate_q2',
      triggerValue: 2,
      hiddenTypeCode: 'DRUNK',
      fallbackTypeCode: 'HHHH',
      similarityFloor: 60,
    },
    shareConfig: {
      title: 'SBTI 人格测试',
      linkCopyText: '来测测你的抽象人格类型',
      footer: 'SBTI · 人格测试 · 仅供娱乐',
      rankingTitle: '常规人格 TOP 3',
      rankingLimit: 3,
      badgeLabel: '匹配度',
      filenamePrefix: 'SBTI',
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
    profileMode: 'sbti',
  },
]

function createDir(filePath) {
  return fs.mkdir(filePath, { recursive: true })
}

async function writeJson(filePath, value) {
  await createDir(path.dirname(filePath))
  await fs.writeFile(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8')
}

async function emptyDir(dirPath) {
  await fs.rm(dirPath, { recursive: true, force: true })
  await createDir(dirPath)
}

function extractConstExpression(source, name) {
  const marker = `const ${name} =`
  const start = source.indexOf(marker)
  if (start < 0) {
    throw new Error(`Unable to find ${name}`)
  }

  const expressionStart = start + marker.length
  let index = expressionStart
  while (/\s/.test(source[index])) {
    index += 1
  }

  const opening = source[index]
  const closing = opening === '{' ? '}' : opening === '[' ? ']' : null
  if (!closing) {
    throw new Error(`Unsupported expression opener for ${name}: ${opening}`)
  }

  let depth = 0
  let quote = null
  let escaped = false

  for (let cursor = index; cursor < source.length; cursor += 1) {
    const char = source[cursor]

    if (quote) {
      if (escaped) {
        escaped = false
        continue
      }

      if (char === '\\') {
        escaped = true
        continue
      }

      if (char === quote) {
        quote = null
      }
      continue
    }

    if (char === '\'' || char === '"' || char === '`') {
      quote = char
      continue
    }

    if (char === opening) {
      depth += 1
      continue
    }

    if (char === closing) {
      depth -= 1
      if (depth === 0) {
        return source.slice(index, cursor + 1)
      }
    }
  }

  throw new Error(`Unable to parse ${name}`)
}

function evaluateLiteral(expression, label) {
  return vm.runInNewContext(`(${expression})`, {}, { filename: `${label}.vm` })
}

async function parseSource(sourceHtmlPath, names) {
  const source = await fs.readFile(sourceHtmlPath, 'utf8')
  return Object.fromEntries(
    names.map((name) => {
      const expression = extractConstExpression(source, name)
      return [name, evaluateLiteral(expression, name)]
    }),
  )
}

function normalizeQuestions(questions, { special = false } = {}) {
  return questions.map((question) => ({
    id: question.id,
    prompt: question.text ?? question.prompt ?? '',
    description: question.description ?? '',
    caption: question.caption ?? '',
    dim: question.dim ?? '',
    special: question.special ?? special,
    kind: question.kind ?? 'single',
    options: (question.options || []).map((option, index) => ({
      id: option.id ?? `option-${index + 1}`,
      label: option.label ?? '',
      value: option.value ?? index + 1,
    })),
  }))
}

function toReasonList(reasons) {
  if (!reasons || typeof reasons !== 'object') {
    return []
  }

  return [
    reasons.main ? `主导因子：${reasons.main}` : '',
    reasons.second ? `第二标签：${reasons.second}` : '',
    reasons.third ? `第三标签：${reasons.third}` : '',
    reasons.judge ? `人格判断：${reasons.judge}` : '',
  ].filter(Boolean)
}

function normalizeOutcomes({
  typeLibrary,
  typeImages,
  typeProfiles = {},
  profileMode,
}) {
  return Object.values(typeLibrary).map((type) => {
    const profile = typeProfiles[type.code] || {}

    return {
      code: type.code,
      alias: type.cn ?? '',
      badge: type.intro ?? '',
      brief: type.desc ?? '',
      note: profile.remark ?? '',
      image: typeImages[type.code]
        ? `./images/${path.basename(typeImages[type.code])}`
        : '',
      tags: Array.isArray(profile.tags) ? profile.tags : [],
      scenes: Array.isArray(profile.scenes) ? profile.scenes : [],
      mantras: Array.isArray(profile.mantras) ? profile.mantras : [],
      tips: Array.isArray(profile.tips) ? profile.tips : [],
      reasons: toReasonList(profile.reasons),
      profileMode,
    }
  })
}

function normalizeDimensions(dimensionMeta, dimensionOrder, explanations) {
  const meta = Object.fromEntries(
    Object.entries(dimensionMeta).map(([dimensionId, info]) => [
      dimensionId,
      {
        label: info.name ?? info.label ?? dimensionId,
        model: info.model ?? '',
      },
    ]),
  )

  const sumToLevel = Object.fromEntries(
    dimensionOrder.map((dimensionId) => [dimensionId, LEVEL_RULES]),
  )

  return {
    order: dimensionOrder,
    meta,
    explanations,
    sumToLevel,
  }
}

function patternToDimensions(pattern, dimensionOrder) {
  const levels = String(pattern || '').replace(/-/g, '').split('')
  return Object.fromEntries(
    dimensionOrder.map((dimensionId, index) => [dimensionId, levels[index] ?? 'M']),
  )
}

function normalizePatterns(patterns, dimensionOrder) {
  return {
    normalTypes: patterns.map((pattern) => ({
      code: pattern.code,
      dimensions: patternToDimensions(pattern.pattern, dimensionOrder),
    })),
  }
}

async function copyImages(sourceImageDir, targetImageDir, referencedPaths) {
  await createDir(targetImageDir)
  const fileNames = [...new Set(referencedPaths.map((filePath) => path.basename(filePath)))]

  await Promise.all(
    fileNames.map((fileName) => {
      const sourcePath = path.join(sourceImageDir, fileName)
      const targetPath = path.join(targetImageDir, fileName)
      return fs.copyFile(sourcePath, targetPath)
    }),
  )
}

function buildManifest(spec) {
  return {
    id: spec.id,
    scorerId: 'dimension-pattern-matcher',
    questionsPath: './questions.json',
    outcomesPath: './outcomes.json',
    specialQuestionsPath: './special-questions.json',
    dimensionsPath: './dimensions.json',
    patternsPath: './patterns.json',
    meta: spec.meta,
    display: spec.display,
    flow: spec.flow,
    specialLogic: spec.specialLogic,
    assets: {
      posterMode: 'image',
    },
    resultTemplate: spec.resultTemplate,
    shareConfig: spec.shareConfig,
  }
}

async function generatePack(spec) {
  const parsed = await parseSource(spec.sourceHtmlPath, [
    'dimensionMeta',
    'questions',
    'specialQuestions',
    'TYPE_LIBRARY',
    'TYPE_IMAGES',
    'NORMAL_TYPES',
    'DIM_EXPLANATIONS',
    'dimensionOrder',
    ...(spec.profileMode === 'gbti' ? ['TYPE_PROFILES'] : []),
  ])

  const questions = normalizeQuestions(parsed.questions)
  const specialQuestions = normalizeQuestions(parsed.specialQuestions, { special: true })
  const outcomes = normalizeOutcomes({
    typeLibrary: parsed.TYPE_LIBRARY,
    typeImages: parsed.TYPE_IMAGES,
    typeProfiles: parsed.TYPE_PROFILES,
    profileMode: spec.profileMode,
  })
  const dimensions = normalizeDimensions(parsed.dimensionMeta, parsed.dimensionOrder, parsed.DIM_EXPLANATIONS)
  const patterns = normalizePatterns(parsed.NORMAL_TYPES, parsed.dimensionOrder)
  const manifest = buildManifest(spec)

  await emptyDir(spec.outputDir)
  await Promise.all([
    writeJson(path.join(spec.outputDir, 'manifest.json'), manifest),
    writeJson(path.join(spec.outputDir, 'questions.json'), questions),
    writeJson(path.join(spec.outputDir, 'special-questions.json'), specialQuestions),
    writeJson(path.join(spec.outputDir, 'outcomes.json'), outcomes),
    writeJson(path.join(spec.outputDir, 'dimensions.json'), dimensions),
    writeJson(path.join(spec.outputDir, 'patterns.json'), patterns),
    copyImages(spec.sourceImageDir, path.join(spec.outputDir, 'images'), Object.values(parsed.TYPE_IMAGES)),
  ])
}

async function main() {
  for (const spec of PACK_SPECS) {
    await generatePack(spec)
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
