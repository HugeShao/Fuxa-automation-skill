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

```
用户                      ❯ 帮我用 NPM 在本地部署一个 FUXA

fuxa-automation.skill    ❯ 好的，正在通过 NPM 全局安装 FUXA：

                          ① 全局安装
                          $ npm install -g --unsafe-perm @frangoteam/fuxa

                          ② 后台启动
                          $ nohup fuxa > fuxa.log 2>&1 &
                          PID: 12345

                          ✅ FUXA 已启动！访问 http://localhost:1881
```

### 🔧 配置 Modbus TCP 设备

```
用户                      ❯ 帮我连一个 Modbus TCP 设备，IP 192.168.1.100，端口 502，从站号 1
                            需要读 3 个标签：温度（HR 40001，Int16LE）、湿度（HR 40002，Int16LE）、
                            压力（HR 40003，Float32LE）

fuxa-automation.skill    ❯ 已创建 Modbus TCP 设备，配置如下：

                          📡 设备：Modbus TCP 设备（d_modbus_01）
                             地址：192.168.1.100:502
                             从站：1
                             轮询：1000ms

                          📋 标签列表：
                          ┌──────────┬──────────┬─────────────┬───────────┐
                          │ 标签 ID  │ 名称     │ 类型        │ 地址      │
                          ├──────────┼──────────┼─────────────┼───────────┤
                          │ t_temp   │ 温度     │ Int16LE     │ HR 40001  │
                          │ t_humid  │ 湿度     │ Int16LE     │ HR 40002  │
                          │ t_press  │ 压力     │ Float32LE   │ HR 40003  │
                          └──────────┴──────────┴─────────────┴───────────┘

                          ✅ 设备已通过 API 推送到 FUXA 服务器，连接状态：在线
```

### 🚨 配置温度报警

```
用户                      ❯ 给温度标签配一个高报警阈值 80 度，高高报警阈值 100 度，低于 10 度报低报警

fuxa-automation.skill    ❯ 已为标签 t_temp 配置三级报警：

                          🚨 报警名称：温度报警
                             关联标签：t_temp（温度）

                          ┌──────────┬────────┬────────┬──────────┬───────────────┐
                          │ 级别     │ 阈值   │ 延时   │ 确认模式 │ 文本          │
                          ├──────────┼────────┼────────┼──────────┼───────────────┤
                          │ 🔴 高高  │ ≥ 100  │ 0s     │ 主动确认 │ 温度超高报警！ │
                          │ 🟠 高    │ ≥ 80   │ 5s     │ 自动恢复 │ 温度超过80°C  │
                          │ 🔵 低    │ ≤ 10   │ 5s     │ 自动恢复 │ 温度过低      │
                          └──────────┴────────┴────────┴──────────┴───────────────┘

                          ✅ 报警已生效，触发时 FUXA 界面会自动弹出提示
```

### 📧 配置报警通知

```
用户                      ❯ 温度高高报警时给我发邮件通知，发给 operator@example.com

fuxa-automation.skill    ❯ 已配置邮件通知：

                          📬 通知名称：温度报警邮件
                             接收人：operator@example.com
                             订阅级别：高高报警 ✓  高报警 ✗  低报警 ✗
                             邮件模板：报警通知：${alarmName} 已触发

                          ⚙️ 需要 FUXA 服务器已配置 SMTP，当前 SMTP 配置：
                             服务器：smtp.example.com:587
                             发件人：noreply@example.com
```

### 📊 读取实时标签值

```
用户                      ❯ 读一下现在的温度和湿度

fuxa-automation.skill    ❯ 标签实时值：

                          ┌──────────┬────────┬─────────────┐
                          │ 标签     │ 值     │ 时间        │
                          ├──────────┼────────┼─────────────┤
                          │ t_temp   │ 72.5°C │ 14:32:08    │
                          │ t_humid  │ 45.2%  │ 14:32:08    │
                          └──────────┴────────┴─────────────┘
```

### ✏️ 写入标签值

```
用户                      ❯ 把启动开关 t_start 设为 true

fuxa-automation.skill    ❯ 写入成功：

                          t_start: false → true  ✅
```

### 📈 查询历史数据

```
用户                      ❯ 查一下过去 24 小时的温度数据

fuxa-automation.skill    ❯ 查询到 1440 条记录：

                          📈 温度（t_temp）24h 统计
                          ┌──────────┬─────────┐
                          │ 最高     │ 95.2°C  │
                          │ 最低     │ 42.1°C  │
                          │ 平均     │ 68.5°C  │
                          │ 峰值时间 │ 14:32   │
                          │ 谷值时间 │ 03:15   │
                          └──────────┴─────────┘

                          数据来自 DAQ 存储，采集间隔 60s
```

### 📜 生成服务端脚本

```
用户                      ❯ 写个脚本：每小时检查一次温度，超过 80 度就自动把空调 t_ac 设为 true

fuxa-automation.skill    ❯ 已生成并部署脚本：

                          📜 脚本名称：温度自动控空调
                             触发方式：调度（每小时执行）

                          (function() {
                            var temp = fuxa.getTagValue('t_temp');
                            if (temp > 80) {
                              fuxa.setTagValue('t_ac', true);
                              fuxa.log('温度 ' + temp + '°C 超限，已开启空调', 'warn');
                            } else if (temp < 75) {
                              fuxa.setTagValue('t_ac', false);
                              fuxa.log('温度 ' + temp + '°C 已恢复正常，关闭空调', 'info');
                            }
                            return { success: true };
                          })();

                          ✅ 脚本已创建并绑定调度器，下次整点自动执行
```

### 👥 用户与权限管理

```
用户                      ❯ 创建一个操作员账号，用户名 operator，只给查看和操作权限，不给编辑权限

fuxa-automation.skill    ❯ 已创建用户：

                          👤 用户：operator
                             全名：操作员
                             角色：operator
                             权限范围：
                               ✅ 查看视图/数据
                               ✅ 操作控件/写标签
                               ✅ 确认报警
                               ❌ 编辑组态
                               ❌ 系统管理
```

### ⚙️ 系统设置

```
用户                      ❯ 把 FUXA 语言改成中文，开启 Swagger API 文档

fuxa-automation.skill    ❯ 已更新系统设置：

                          ⚙️ 变更项：
                             language:  "en"    → "zh-cn"
                             swaggerEnabled: false → true

                          ✅ 设置已通过 API 实时生效，无需重启
```

------

## 🔧 功能特性


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
