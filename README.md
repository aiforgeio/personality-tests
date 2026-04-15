# GBTI

`GBTI` 现在是一个“单测试部署、可复用骨架”的静态人格测试宿主。当前默认挂载的是 `gbti` 测试包，同时仓内也内置了 `sbti` 标准 pack；部署时只需要切 `data/active-test.json` 即可切换当前活动测试。

当前内置：

- `gbti`：30 道常规题 + 2 道特殊题，16 个结果人格
- `sbti`：30 道常规题 + 2 道特殊题，27 个结果人格
- 统一 `dimension-pattern-matcher` 评分器
- 模板化结果页、懒加载分享图、pack 本地图像资源

## 目录

- `data/active-test.json`：当前生效的测试包入口
- `data/tests/<id>/manifest.json`：测试包元信息、结果模板、分享配置、评分器声明
- `data/tests/<id>/questions.json`：常规题库
- `data/tests/<id>/special-questions.json`：静态插题与条件题
- `data/tests/<id>/outcomes.json`：结果档案
- `data/tests/<id>/dimensions.json`：维度顺序、解释与分档规则
- `data/tests/<id>/patterns.json`：常规人格 pattern
- `src/test-pack/`：测试包 schema 与本地数据源
- `src/scorers/`：评分器注册层与 `dimension-pattern-matcher`
- `src/results/template.js`：标准 `ResultViewModel` 和模板区块构建
- `src/app-controller.js`：宿主流程控制
- `src/quiz.js`：答题 UI
- `src/result.js`：模板化结果页渲染
- `src/share.js`：分享图生成
- `scripts/generate-packs.mjs`：从 `GBTI-test/gbti` 与 `SBTI-test` 提取 pack 数据
- `scripts/validate.mjs`：schema、flow、scorer 与结果模型校验

## 说明

默认运行方式仍然是纯前端静态站，不需要后端就能支撑多人同时访问。结果计算全部在浏览器本地完成，后续如果要加统计、存档或后台管理，再把数据源和上报接口接到 API 即可。
