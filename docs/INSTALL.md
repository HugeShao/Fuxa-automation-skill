# FUXA-Automation 安装说明

---

## 选择你的平台

### A. Claude Code（推荐）

本项目遵循官方 [AgentSkills](https://agentskills.io) 标准，整个 repo 就是 skill 目录。克隆到 Claude skills 目录即可：

```bash
# 方式 1：安装到当前项目
mkdir -p .claude/skills
git clone https://github.com/HugeShao/Fuxa-automation-skill .claude/skills/fuxa-automation

# 方式 2：安装到全局（所有项目都能用）
git clone https://github.com/HugeShao/Fuxa-automation-skill ~/.claude/skills/fuxa-automation
```

然后在 Claude Code 中直接问答 FUXA 相关问题即可触发 skill。

---

### B. OpenClaw

```bash
git clone https://github.com/HugeShao/Fuxa-automation-skill ~/.openclaw/workspace/skills/fuxa-automation
```

重启 OpenClaw session，直接问答 FUXA 相关问题即可触发。

---

### C. Hermes

```bash
git clone https://github.com/HugeShao/Fuxa-automation-skill ~/.hermes/skills/fuxa-automation
```

安装完成后，在 Hermes 中直接问答 FUXA 相关问题即可触发。

---

### D. Codex

```bash
git clone https://github.com/HugeShao/Fuxa-automation-skill ~/.codex/skills/fuxa-automation
```

Codex 会把 `fuxa-automation` 当作本地 skill 发现。

---

## 快速验证

```bash
# 检查 skill 入口文件是否存在
ls ~/.claude/skills/fuxa-automation/skills/SKILL.md

# 检查参考文件
ls ~/.claude/skills/fuxa-automation/skills/references/
```

---

## 目录结构说明

本项目整个 repo 就是一个 skill 目录（AgentSkills 标准格式）：

```
fuxa-automation/        ← clone 到 .claude/skills/fuxa-automation/
├── skills/
│   ├── SKILL.md            # skill 入口（官方 frontmatter）
│   └── references/         # 参考文档与模板
│       ├── fuxa-cli.js     #   FUXA REST API 客户端 + 部署工具
│       ├── data-models.md  #   完整数据模型文档
│       ├── device-template.json
│       ├── alarm-template.json
│       ├── config-template.json
│       └── script-template.js
├── docs/
│   └── INSTALL.md          # 本文件
├── README.md
└── LICENSE
```
