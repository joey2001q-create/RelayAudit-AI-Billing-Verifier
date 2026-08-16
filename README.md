<div align="center">

# RelayAudit

### AI 中转站计费核验器

**用固定请求、公开价格与真实账单，核对中转站究竟扣了多少钱。**

不猜测内部路由，只核验本次请求的 Token 与扣费是否对得上。

<p>
  <a href="https://relay-billing-verifier.vercel.app"><img alt="Vercel 在线可用" src="https://img.shields.io/badge/Vercel-在线可用-000000?style=for-the-badge&amp;logo=vercel&amp;logoColor=white"></a>
  <a href="https://github.com/joey2001q-create/RelayAudit-AI-Billing-Verifier/actions/workflows/ci.yml"><img alt="持续集成" src="https://img.shields.io/github/actions/workflow/status/joey2001q-create/RelayAudit-AI-Billing-Verifier/ci.yml?branch=main&amp;style=for-the-badge&amp;label=%E6%8C%81%E7%BB%AD%E9%9B%86%E6%88%90"></a>
  <a href="LICENSE"><img alt="MIT 许可证" src="https://img.shields.io/badge/License-MIT-146c43?style=for-the-badge"></a>
  <img alt="Node.js 20 或更高版本" src="https://img.shields.io/badge/Node.js-%3E%3D20-339933?style=for-the-badge&amp;logo=node.js&amp;logoColor=white">
</p>

<p>
  <a href="https://relay-billing-verifier.vercel.app"><strong>在线体验</strong></a>
  ·
  <a href="#快速开始"><strong>快速部署</strong></a>
  ·
  <a href="#核验口径"><strong>核验原理</strong></a>
  ·
  <a href="#安全说明"><strong>安全边界</strong></a>
</p>

</div>

## 当前范围

当前版本只核验 Token 与价格，不测试速度。

中转站速度受测试地区与网络线路、节点负载与并发量、路由策略、上游服务状态、DNS 与 TLS 建连过程、测试时段等多种因素影响。单一地点或单次请求的耗时，不能代表平台的整体服务质量。

后续版本计划将速度测试作为独立维度，通过多地区、多时段、多轮次采样，分别统计首 Token 延迟、完整响应耗时、请求成功率和波动范围，避免与计费核验结论混在一起。

## 项目简介

RelayAudit 会向一个或两个 OpenAI 兼容接口发送可复现的固定测试批次，读取接口返回的 `usage`，按照公开模型价格计算标称费用，再与用户填写的平台实际消费进行核对。

整个项目公开源代码。任何人都可以检查测试语料、请求参数、usage 归一化、计价公式和报告生成过程，也可以在自己的环境中重复实验，减少选择性展示或偏向特定平台的空间。

## 核心能力

- 默认核验单个平台，也可对两个平台执行相同的语义请求。
- 提供单轮稳定性、多轮上下文、缓存复用三个测试维度。
- 实时展示当前测试维度、轮次、平台和总体完成进度。
- 默认使用内置固定语料，也可在更多设置中启用自定义语料。
- 从公开价格仓库同步 5.6 模型单价，并用 SHA-256 校验价格文件。
- 归一化常见 OpenAI 与 Anthropic 风格的 `usage` 字段。
- 计算平台账单金额、标称应扣金额、相对偏差和实测倍率。
- 导出脱敏 JSON 证据、HTML 报告和文本摘要。
- API Key 只用于当前页面发起的测试，不落盘、不进入报告。

## 选择使用方式

托管版与自部署版使用完全相同的测试语料、价格同步、usage 归一化和计费公式。

| 使用方式 | 适合场景 | API Key 传输路径 | 入口 |
| --- | --- | --- | --- |
| **Vercel 托管版** | 打开即用，无需安装 | 浏览器 → RelayAudit Vercel Function → 目标中转站 | [立即在线测试](https://relay-billing-verifier.vercel.app) |
| **源码自部署版** | 独立复核、内网接口、严格凭据控制 | 浏览器 → 用户自己的 RelayAudit 服务 → 目标中转站 | [查看公开源码](https://github.com/joey2001q-create/RelayAudit-AI-Billing-Verifier) |

> [!NOTE]
> 托管版只允许访问公网 HTTPS 中转站。需要测试本机、局域网或 HTTP 地址时，请使用源码自部署版。

## 快速开始

### 在线使用

直接打开 **[RelayAudit 托管版](https://relay-billing-verifier.vercel.app)**，填写待测平台的 Base URL 和 API Key 即可开始。

### 本地运行或部署到 Vercel

需要 Node.js 20 或更高版本。克隆一次代码后，可以选择本地运行，也可以直接部署到自己的 Vercel 账号。

```bash
git clone https://github.com/joey2001q-create/RelayAudit-AI-Billing-Verifier.git
cd RelayAudit-AI-Billing-Verifier
npm ci

# 方式一：在本机运行
npm start

# 方式二：部署到自己的 Vercel 账号
npx vercel
```

本地运行后打开 <http://127.0.0.1:4312>。也可以点击下面的按钮，一键复制仓库并部署：

[![部署到 Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fjoey2001q-create%2FRelayAudit-AI-Billing-Verifier)

## 使用流程

两种版本均按以下顺序操作：

1. 粘贴平台的 cURL、JSON 或三行配置，也可以手工填写 Base URL、API Key 和模型别名。
2. 选择 `gpt-5.6-sol`、`gpt-5.6-terra` 或 `gpt-5.6-luna`。
3. 运行标准核验或专业核验，并观察每一步请求进度。
4. 从平台消费明细中取得本次请求对应的高精度账单金额；倍率默认是 `1`，有其他倍率时自行修改。
5. 查看结论，按需导出证据。

选择 5.6 模型后，工具会从动态价格目录自动带出模型名和对应价格；普通用户无需展开“更多设置”。自定义模型时再手工填写模型名和每百万 Token 价格。README 不重复维护一份固定价格表，避免文档价格与动态数据源发生偏差。

价格来自 [`Wei-Shaw/model-price-repo`](https://github.com/Wei-Shaw/model-price-repo)。运行服务会下载价格 JSON 与对应 SHA-256，校验通过后才更新页面；网络不可用或校验失败时使用仓库内最近一次有效快照。报告会记录本次使用的是远程价格、内置快照还是用户手工价格，以及对应的价格文件哈希。

维护者可运行 `npm run pricing:sync` 更新内置快照；仓库的定时工作流也会每日检查一次。

“更多设置”默认不需要修改。启用自定义语料时，工具会把用户填写的正文作为固定输入，并继续自动附加“只返回 `BILLING_TEST_OK`”的短格式约束。最大输出 Token 默认是 `16`，它只限制输出上限，不能保证模型恰好输出指定数量的 Token。不要在核验语料中要求随机生成、摘要或改写，否则输出 Token 会产生不必要的波动。

倍率放在请求完成后的第三步，默认值是 `1`。倍率只用于核算账单，不影响发送给中转站的请求；平台有其他倍率时由客户自行修改，例如 `0.8` 或 `1.2`。

## 核验口径

```text
标称基础费用 = 普通输入费 + 缓存读取费 + 缓存创建费 + 输出费
标称应扣金额 = 标称基础费用 × 标称倍率
实测倍率 = 平台账单金额 ÷ 标称基础费用
相对偏差 = (平台账单金额 - 标称应扣金额) ÷ 标称应扣金额
```

默认以相对偏差不超过 `2%` 作为“与标称倍率一致”的展示阈值。该阈值只是工具的判读规则，不是行业标准；平台按小数位截断、四舍五入或延迟入账时都可能产生小额差异。

## 请求一致性

- 每次测试使用固定的语料、轮次标记、消息结构和生成参数。
- 双平台测试只替换认证信息与平台模型别名，并记录语义请求 SHA-256。
- 多轮测试使用固定 assistant 消息扩展历史，不把随机模型回复带入下一轮。
- 缓存复用测试重复发送完全相同的请求内容。
- 请求使用 `/v1/chat/completions`、`stream: false`，失败后不会自动重试。
- 模型回复可以不同，费用按各平台实际返回的 `usage` 独立计算。

“缓存读取占比”是缓存读取 Token 占总输入 Token 的比例，不等同于平台内部的真实缓存命中率。上游未返回缓存明细时，工具显示“未返回”，不会按 `0%` 处理。

## 证据边界

RelayAudit 可以证明：

- 本次测试发送了哪些可复现的语义请求；
- 平台返回了多少 Token 使用量；
- 按用户填写的公开单价和倍率，账单金额是否吻合。

RelayAudit 不能证明：

- 中转站实际调用了它宣称的上游模型；
- 中转站向上游支付的内部成本；
- 平台未公开的路由、缓存或计费实现；
- 单次测试之外的长期计费行为。

因此，报告结论仅针对本次测试中可观测的计费数据。

## 安全说明

- Vercel 托管版中，API Key 会从浏览器临时发送到 Vercel Function，再由函数请求用户填写的中转站；项目代码不持久化、不主动记录 Key，也不把 Key 放入返回结果或报告。
- 源码自部署版默认固定监听 `127.0.0.1`，API Key 只经过用户自己的浏览器、本机 RelayAudit 服务和目标中转站。
- 托管版只允许公网 HTTPS 地址，并拒绝本机、内网、链路本地和保留地址；本地版可按用户自己的网络环境测试 HTTP 或内网地址。
- 请确认 Base URL 属于待测平台，避免将 Key 发送给不可信地址。
- 不要把包含真实 Key 的终端记录、截图或配置文件提交到仓库。
- 不要把 `.vercel` 目录、Vercel 登录信息或真实 Key 提交到仓库。
- 导出报告前仍应检查平台名称、接口地址和业务信息是否适合公开。
- 自定义语料正文不进入返回结果或导出报告；报告只记录来源、行数、字符数和 SHA-256。

更完整的漏洞报告方式见 [SECURITY.md](SECURITY.md)。

## 开发

```bash
npm test
npm run check
npm run pricing:sync
```

项目使用 Node.js 原生 HTTP 服务和原生前端模块。欢迎先阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 和 [CHANGELOG.md](CHANGELOG.md)。

## 许可证

[MIT](LICENSE) © 2026 RelayAudit contributors
