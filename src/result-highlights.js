import { formatCode, stripEndingPunctuation } from './utils.js'

function toTextValue(value) {
  if (value == null) return ''

  if (typeof value === 'object') {
    return stripEndingPunctuation(String(value.text ?? value.label ?? value.value ?? '').trim())
  }

  return stripEndingPunctuation(String(value).trim())
}

function buildDimensionSalience(item) {
  const percentage = Number(item?.percentage ?? 0)
  // 距离中点越远（越极端）越突出；同等距离时 score 更高的优先
  const distance = Math.abs(percentage - 50)
  const weight = Number(item?.score ?? 0) * 0.1
  return distance + weight
}

export function getHighlightTags(result, limit = 3) {
  return (Array.isArray(result?.hero?.tags) ? result.hero.tags : [])
    .map(toTextValue)
    .filter(Boolean)
    .slice(0, limit)
}

export function getHighlightDimensions(result, limit = 4) {
  const items = (Array.isArray(result?.dimensions) ? result.dimensions : [])
    .filter(Boolean)
    .map((item) => ({
      ...item,
      salience: buildDimensionSalience(item),
      label: stripEndingPunctuation(item.summaryLabel ?? item.shortLabel ?? item.label ?? item.id ?? ''),
    }))
    // 主排序：salience 降序（极端维度优先）；次排序：percentage 降序（H > L 同等 salience 时）；三排序：score 降序
    .sort(
      (left, right) =>
        right.salience - left.salience ||
        right.percentage - left.percentage ||
        right.score - left.score,
    )

  // 尽量保证结果中同时包含高分（H）和低分（L）维度，避免全部是同一 level
  // 策略：先取 salience 最高的 limit 个，但如果全部是同一 levelCode，
  // 则尝试用不同 levelCode 的最高 salience 项替换最后一个
  const selected = items.slice(0, limit)

  if (selected.length >= 2) {
    const levelCodes = new Set(selected.map((d) => d.levelCode))
    if (levelCodes.size === 1) {
      // 所有选中项都是同一 level，尝试找一个不同 level 的项替换最后一个
      const differentLevel = items.find((d) => d.levelCode !== selected[0].levelCode)
      if (differentLevel) {
        selected[selected.length - 1] = differentLevel
      }
    }
  }

  return selected.map(({ salience, ...item }) => item)
}

export function getComparisonHero(result) {
  const hero = result?.secondaryHero || result?.hero || {}
  const titleText = hero?.data?.alias
    ?? hero?.data?.name
    ?? hero?.data?.title
    ?? hero.alias
    ?? ''
  const title = titleText
    ? stripEndingPunctuation(titleText)
    : formatCode(hero.code)

  return {
    title,
    code: formatCode(hero.code),
    isComparison: Boolean(result?.secondaryHero),
  }
}

export function getShareCardStats(result) {
  const confidence = result?.meta?.confidence ?? result?.hero?.confidence ?? 0
  const exactMatches = result?.hero?.data?.exactMatches
    ?? result?.raw?.bestNormal?.exactMatches
    ?? 0
  const totalDimensions = Array.isArray(result?.dimensions) ? result.dimensions.length : 0
  const comparison = getComparisonHero(result)

  return [
    {
      label: '匹配度',
      value: `${confidence}%`,
      tone: 'accent',
    },
    {
      label: '精准命中',
      value: totalDimensions > 0 ? `${exactMatches}/${totalDimensions} 维` : `${exactMatches} 维`,
      tone: 'default',
    },
    {
      label: '常规命中',
      value: comparison.title || comparison.code || '未命中',
      note: comparison.isComparison && comparison.code && comparison.code !== comparison.title
        ? comparison.code
        : '',
      tone: comparison.isComparison ? 'accent-soft' : 'default',
    },
  ]
}

export function getPosterQuote(result) {
  return stripEndingPunctuation(String(result?.hero?.badge || '').trim())
}

export function getPosterComparison(result) {
  const comparison = getComparisonHero(result)

  if (!comparison.isComparison) {
    return null
  }

  return comparison
}
