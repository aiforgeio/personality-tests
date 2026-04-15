# GBTI

参照 `SBTI` 项目骨架实现的静态 `GBTI` 页面，使用当前线上站点提取出的：

- `20` 道题
- `14` 种人格档案
- 本地 `effect` 累加评分逻辑
- `confidence` 计算公式

## 目录

- `data/questions.json`：提取后的 20 道题
- `data/types.json`：提取后的 14 种人格
- `data/config.json`：页面显示与评分配置
- `src/engine.js`：GBTI 评分引擎
- `src/quiz.js`：答题流程
- `src/result.js`：结果页渲染
- `src/share.js`：Canvas 分享图
- `src/chart.js`：14 人格分数条图渲染
- `scripts/validate.mjs`：数据与引擎一致性校验

## 说明

本项目不复用 `SBTI` 的 15 维匹配模型，只复用它的轻量静态页结构与模块拆分方式。
