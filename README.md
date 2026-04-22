# FUXA-Automation Skill

### FUXA-Automation Skill — 让 AI Agent 具备配置和操作 FUXA SCADA/HMI 的能力

[FUXA 官网](https://fuxa.github.io) · [GitHub](https://github.com/frangoteam/FUXA)

<p>
  <img src="https://img.shields.io/badge/Claude_Code-black?style=flat-square&logo=anthropic&logoColor=white" alt="Claude Code">
  <img src="https://img.shields.io/badge/OpenClaw-FF6F00?style=flat-square" alt="OpenClaw">
  <img src="https://img.shields.io/badge/Hermes-7B68EE?style=flat-square" alt="Hermes">
  <img src="https://img.shields.io/badge/FUXA-blue?style=flat-square" alt="FUXA">
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="MIT License">
</p>



> 一个 AI Agent 技能，让 Claude Code / OpenClaw / Hermes 具备工业 SCADA 系统的远程配置和操作能力。只需对话，AI 自动完成设备驱动配置、报警设置、数据查询、组态设计等操作。所有操作通过 FUXA REST API 完成，无需在本机安装 FUXA。



## 🚀 核心能力

- **设备驱动配置** — 支持 16 种工业协议（Modbus TCP/RTU、OPC UA、西门子 S7、MQTT、BACnet、EtherNet/IP 等）
- **标签读写** — 实时读取/写入设备标签值
- **报警管理** — 多级报警（高/低/高高）、通知、确认
- **组态配置** — 视图、布局、图表、图形
- **脚本生成** — 服务端 JavaScript 脚本（含完整的 FUXA 脚本 API）
- **历史数据查询** — DAQ 数据检索、报警历史
- **用户/API Key 管理**
- **本地部署/更新/卸载** — 支持 Docker、源码、NPM 三种方式

---

## ⚡ 安装

2026 年了，你有 Agent，让它自己装。打开你用的 Claude Code / Hermes / OpenClaw / Codex，把下面这句丢给它：

> 帮我安装 FUXA-Automation 这个 skill：`https://github.com/HugeShao/Fuxa-automation-skill`

Agent 会自动识别当前宿主的 skills 目录、完成 clone、注册入口。完成后在任意宿主里输入 `/fuxa-automation` 启动。

<details>
<summary><b>🛠️ 想自己手动装？点开看路径</b></summary>

```bash
git clone https://github.com/HugeShao/Fuxa-automation-skill <TARGET>
```

| 宿主 | `<TARGET>` 路径 |
|------|----------------|
| Claude Code | `~/.claude/skills/fuxa-automation` |
| OpenClaw | `~/.openclaw/workspace/skills/fuxa-automation` |
| Codex | `~/.codex/skills/fuxa-automation` |
| Hermes | `~/.hermes/skills/fuxa-automation` |

</details>

> 详细安装说明见 **docs/INSTALL.md**

------

## 🚀 使用



在你装了 fuxa-automation 的宿主里启动它 —— 直接和你的 Agent 问答FUXA相关的问题便会触发skill。

启动后 AI 会自动引导你完成以下操作：

1. **连接 FUXA 服务器** — 提供服务器地址、认证方式（用户名密码 / API Key）
2. **选择操作类型** — 设备配置 / 报警配置 / 标签读写 / 组态设计 / 脚本生成 / 数据查询 / 系统管理
3. **执行配置** — AI 自动调用 REST API 完成操作，实时生效



## ✨ 效果示例

### 🚀 本地部署 FUXA

![](E:\claude_code\fuxa-automation\images\install.jpg)

### 🔧 配置 Modbus TCP 设备



![](E:\claude_code\fuxa-automation\images\peizhi.jpg)

### 🚨 配置温度报警

```
用户                      ❯ 给温度标签配一个高报警，阈值 80 度

fuxa-automation.skill    ❯ 已为标签 t_tag1 配置高报警：
                          阈值：≥ 80°C
                          确认模式：主动确认
                          报警文本：温度超过80°C
                          动作：弹出提示
```



### 📊 读取历史数据

```
用户                      ❯ 查一下过去 24 小时的温度数据

fuxa-automation.skill    ❯ 查询到 1440 条记录：
                          最高：95.2°C（14:32）
                          最低：42.1°C（03:15）
                          平均：68.5°C
```





------

## 🔧 功能特性

### 🧱 Skill 结构


fuxa-automation 以 **FUXAClient** 为核心，按功能模块组织：

| 模块 | 内容 | 对应文件 |
|------|------|----------|
| **远程连接** | 服务器地址、JWT/API Key 认证、Token 刷新 | `fuxa-cli.js` |
| **设备管理** | 16 种驱动配置、标签定义、连接状态监控 | `fuxa-cli.js` + `device-template.json` |
| **报警管理** | 多级报警定义、确认模式、动作配置 | `fuxa-cli.js` + `alarm-template.json` |
| **组态配置** | 视图、布局、导航、控件、数据绑定 | `fuxa-cli.js` |
| **脚本执行** | 服务端 JS 脚本、调度、系统函数 | `fuxa-cli.js` + `script-template.js` |
| **数据查询** | DAQ 历史、报警历史、实时标签值 | `fuxa-cli.js` |
| **用户管理** | 用户、角色、API Key、权限 | `fuxa-cli.js` |
| **系统设置** | 语言、端口、DAQ 存储、SMTP、Swagger | `fuxa-cli.js` + `config-template.json` |
| **本地部署** | Docker / 源码 / NPM 部署、更新、卸载 | `FUXADeployer` in `fuxa-cli.js` |

> **运行逻辑**：接到任务 → 询问连接信息 → 通过 REST API 执行 → 返回结果

------

## 📂 项目结构

本项目遵循 [AgentSkills](https://agentskills.io/) 开放标准，整个 repo 就是一个 skill 目录：

```
fuxa-automation/
├── skills/
│   ├── SKILL.md                        # skill 入口（官方 frontmatter）
│   └── references/                     # 参考文档与模板
│       ├── fuxa-cli.js                 #   FUXA REST API 客户端 + 部署工具
│       ├── data-models.md              #   完整数据模型文档（Device/Tag/Alarm/View/Settings...）
│       ├── device-template.json        #   16 种设备驱动配置模板
│       ├── alarm-template.json         #   报警和通知配置模板
│       ├── config-template.json        #   系统设置配置模板
│       └── script-template.js          #   FUXA 服务端脚本代码模板
├── docs/
│   └── INSTALL.md                      # 详细安装说明
├── README.md                           # 本文件
└── LICENSE
```



------

## ⚠️ 注意事项

- **版本兼容**：基于 FUXA 1.3.1 版本编写的skill，别的版本可能存在兼容性问题
- 目前还是 demo 版本，如果有 bug 请多多提 issue！
