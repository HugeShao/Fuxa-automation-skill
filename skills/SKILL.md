---
name: "FUXA-Automation"
description: "FUXA SCADA/HMI 自动化配置技能。通过 REST API 远程管理 FUXA 服务器，支持设备驱动配置（16种协议）、报警配置、组态配置、脚本生成、DAQ存储配置等。触发词：FUXA部署、FUXA配置、组态配置、设备驱动配置、报警配置、SCADA配置、HMI配置、生成FUXA脚本、FUXA脚本、工业自动化配置、PLC连接配置、Modbus配置、OPC-UA配置、MQTT配置、S7配置、BACnet配置"
version: "0.0.1"
author: "huge"
---

# FUXA 自动化配置技能

## 概述

本技能通过 **FUXA REST API** 远程管理 FUXA SCADA/HMI 服务器。所有操作都通过 HTTP 请求完成，**不需要在本机安装 FUXA**。

支持功能：
1. **远程连接** - 连接任意 FUXA 服务器
2. **设备驱动配置** - 16 种工业协议驱动
3. **标签读写** - 实时读取/写入设备标签值
4. **报警管理** - 多级报警 + 动作 + 通知
5. **组态配置** - 视图、布局、数据绑定
6. **脚本执行** - 远程创建和运行脚本
7. **历史数据查询** - DAQ 数据检索
8. **用户管理** - 用户、角色、API Key
9. **系统设置** - 远程修改 FUXA 配置

## 红线规则（必须严格遵守）

> **禁止直接修改 FUXA 配置文件。** 所有配置变更必须通过 REST API 完成。

**无论 FUXA 是否运行在本机，都不允许：**
- 直接编辑 `_appdata/mysettings.json`
- 直接编辑 `_appdata/settings.js`
- 直接编辑 `_appdata/` 下的任何 `.db` 文件
- 直接修改项目数据库文件

**正确做法：**
```
client.updateSettings({...})          // 修改系统设置
client.setDevice({...})              // 配置设备
client.setAlarmDefinition({...})     // 配置报警
client.updateProjectData(cmd, data)  // 修改项目数据
```

**为什么：** 直接改文件会导致：1) 内存中的配置与文件不一致 2) 需要重启才能生效 3) 可能破坏数据完整性。走 API 是实时生效、有校验、有日志。

**唯一例外：** FUXA 服务未启动时的首次部署初始化（仅限 `FUXADeployer` 生成的命令）。

## 数据模型参考（必读）

**所有 API 传参字段名必须精确匹配源码定义。** 详细字段定义见：

| 参考文件 | 内容 |
|----------|------|
| `references/data-models.md` | **完整数据模型文档** - Device、Tag、Alarm、Notification、Script、View、Settings 等所有类的字段定义、类型、枚举值、视图模板、项目结构 |
| `references/device-template.json` | 16 种设备驱动模板 - 含正确字段名的完整配置示例 |
| `references/alarm-template.json` | 报警和通知模板 |
| `references/config-template.json` | 系统设置模板 |
| `references/script-template.js` | 脚本代码模板 |

**关键提醒：**
- Modbus 从站 ID 字段名是 `property.slaveid`（全小写字符串），不是 `unitId` 或 `slaveId`
- 设备地址字段名是 `property.address`（不是 `host`）
- 语言代码是 `zh-cn`（不是 `zh`），否则按钮文字消失
- projectData cmd 值是 `'set-device'`、`'set-alarm'`（不是 `'devices'`、`'alarms'`）

## 连接配置（必须先获取）

**在执行任何操作前，必须先向用户询问以下信息：**

```
FUXA 服务器地址：http://<ip>:<port>  （默认 http://localhost:1881）
用户名：                              （secureEnabled=true 时需要）
密码：                                （secureEnabled=true 时需要）
```

如果用户已提供 API Key，可直接用 `x-api-key` 认证，无需用户名密码。

### 认证方式

| 方式 | 请求头 | 适用场景 |
|------|--------|----------|
| JWT Token | `x-access-token: <token>` | 用户名密码登录后获取 |
| API Key | `x-api-key: <key>` | 预先创建的 API Key，直接使用 |

### 认证流程

```
1. POST /api/signin  {username, password}  →  获取 JWT Token
2. 后续请求携带 x-access-token: <token>
3. Token 即将过期时：POST /api/heartbeat  →  刷新 Token
```

## fuxa-cli.js 客户端

技能引用文件 `references/fuxa-cli.js` 封装了完整的 FUXA REST API 客户端。

### 快速使用

```javascript
const { FUXAClient } = require('./references/fuxa-cli');

// 创建客户端
const client = new FUXAClient({
  url: 'http://192.168.1.100:1881',  // FUXA 服务器地址
  username: 'admin',                  // 用户名
  password: 'password'                // 密码
});

// 登录
await client.login();

// 或使用 API Key（不需要登录）
const client2 = new FUXAClient({
  url: 'http://192.168.1.100:1881',
  apiKey: 'your-api-key'
});

// 获取所有设备（返回对象，key=deviceId）
const devices = await client.getDevices();

// 创建设备（注意字段名精确匹配）
await client.setDevice({
  id: 'd_xxx',
  name: 'Modbus PLC',
  type: 'ModbusTCP',
  enabled: true,
  polling: 1000,
  property: {
    address: '192.168.0.119',  // 不是 host
    port: '502',               // 字符串类型
    slaveid: '1'               // 全小写，不是 unitId
  },
  tags: {
    't_tag1': {
      id: 't_tag1',
      name: '温度1#',
      type: 'Float32',
      memaddress: '400001',    // 寄存器基数
      address: '1',            // 偏移
      daq: { enabled: false, changed: true, interval: 60 }
    }
  }
});

// 读取标签值
const values = await client.getTagValue(['t_tag1']);

// 写入标签值
await client.setTagValue([{ id: 't_tag1', value: true }]);
```

### 读取方法汇总

| 方法 | 用途 | 参数 | 返回格式 |
|------|------|------|----------|
| `getProject()` | 获取完整项目配置 | 无 | `{devices, hmi, alarms, scripts, ...}` |
| `getDevices()` | 获取所有设备 | 无 | `{d_xxx: {id, name, type, tags}}` |
| `getTagValue(ids)` | 读取标签当前值 | `['t_tag1', 't_tag2']` | `[{id, value, timestamp}]` |
| `getAlarms(filter)` | 获取当前报警列表 | `{type, acknowledged}` 或空 | `[{name, text, status, value}]` |
| `getAlarmsHistory(start, end)` | 获取报警历史 | ISO 时间字符串 | `[{name, timestamp, ...}]` |
| `getDaqData(from, to, ids)` | 查询历史数据 | ISO 时间 + 标签 ID | `[{id, values: [{t, v}]}]` |
| `queryReports(query)` | 查询报表内容 | `{name, from, to}` | 报表数据 |
| `getSettings()` | 获取系统设置 | 无 | `{language, uiPort, ...}` |
| `getLogFiles()` | 获取日志文件列表 | 无 | `['error-xxx.log', ...]` |
| `getLogContent(filename)` | 获取日志内容 | 文件名 | 日志文本 |
| `getUsers()` | 获取用户列表 | 无 | `[{username, groups}]` |
| `getApiKeys()` | 获取 API Key 列表 | 无 | `[{id, key, enabled}]` |
| `getDeviceConnectionStatus(deviceId)` | 获取设备连接状态 | 设备 ID | `{status, statusText}` |
| `getAllDeviceConnectionStatus()` | 获取所有设备连接状态 | 无 | `[{deviceId, status, statusText}]` |

### 设备连接状态（系统内置）

FUXA 自动为每个设备创建连接状态监控标签，存储在 **FUXA Server（设备 ID='0'）** 的系统标签中。

**状态值含义（ConnectionStatusEnum）：**

| 值 | 状态 | 说明 |
|----|------|------|
| `0` | 离线 | 超过 5 倍轮询间隔无响应 |
| `3` | 警告 | 超过 2 倍轮询间隔无响应 |
| `5` | 在线 | 正常通信 |

**使用示例：**

```javascript
// 获取单个设备连接状态
const status = await client.getDeviceConnectionStatus('d_fusheng_r1000');
console.log(status.deviceName + ': ' + status.statusText);

// 获取所有设备连接状态
const allStatus = await client.getAllDeviceConnectionStatus();
for (const s of allStatus) {
  console.log(s.deviceName + ': ' + s.statusText + ' (值=' + s.status + ')');
}
``

**示例 - 读取报警和历史数据：**

​```javascript
// 获取当前活跃报警
const alarms = await client.getAlarms();
console.log('当前报警数:', alarms.length);

// 获取未确认的高报警
const highAlarms = await client.getAlarms({ type: 'high', acknowledged: false });

// 查询最近 24 小时的历史数据
const from = new Date(Date.now() - 24*60*60*1000).toISOString();
const to = new Date().toISOString();
const history = await client.getDaqData(from, to, ['t_tag1', 't_tag2']);
```

## API 端点参考

### 1. 认证 (Auth)

| 方法 | 端点 | 认证 | 说明 |
|------|------|------|------|
| POST | `/api/signin` | 无 | 登录，body: `{username, password}`，返回 `{token}` |
| POST | `/api/heartbeat` | JWT | 刷新 Token |
| POST | `/api/signout` | JWT | 登出 |
| POST | `/api/refresh` | Cookie | 刷新 Token（需 enableRefreshCookieAuth） |

### 2. 系统设置 (Settings)

| 方法 | 端点 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/settings` | 无 | 获取设置（脱敏） |
| POST | `/api/settings` | Admin | 更新设置 |
| GET | `/api/version` | 无 | 获取版本号 |

### 3. 项目数据 (Project)

**关键：`cmd` 参数必须使用 `ProjectDataCmdType` 枚举值。**

| 方法 | 端点 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/project` | JWT | 获取完整项目（设备、视图、报警等） |
| POST | `/api/project` | Admin | 设置完整项目 |
| POST | `/api/projectData` | Admin | 更新部分数据，body: `{cmd, data}` |
| GET | `/api/projectdemo` | JWT | 获取演示项目 |

**projectData cmd 有效值（必须精确匹配）：**

| cmd 值 | 用途 |
|--------|------|
| `'set-device'` | 创建/更新设备 |
| `'del-device'` | 删除设备 |
| `'set-view'` | 创建/更新视图 |
| `'del-view'` | 删除视图 |
| `'layout'` | 设置布局 |
| `'charts'` | 设置图表 |
| `'graphs'` | 设置图形 |
| `'languages'` | 设置语言 |
| `'client-access'` | 设置客户端访问 |
| `'set-text'` | 创建/更新文本 |
| `'del-text'` | 删除文本 |
| `'set-alarm'` | 创建/更新报警 |
| `'del-alarm'` | 删除报警 |
| `'set-notification'` | 创建/更新通知 |
| `'del-notification'` | 删除通知 |
| `'set-script'` | 创建/更新脚本 |
| `'del-script'` | 删除脚本 |
| `'set-report'` | 创建/更新报表 |
| `'del-report'` | 删除报表 |
| `'set-maps-location'` | 创建/更新地图位置 |
| `'del-maps-location'` | 删除地图位置 |

**错误示例：** 使用 `'devices'`、`'alarms'`、`'hmi'` 会返回 "Command not found"。

### 4. 设备管理 (Devices)

| 方法 | 端点 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/device?id=<id>` | Admin | 获取设备安全属性 |
| POST | `/api/device` | Admin | 设置设备安全属性 |

**设备通过 `GET /api/project` 返回的 `devices` 对象获取列表（key=deviceId）。**

**创建设备使用 `POST /api/projectData` with `cmd: 'set-device'`。**

### 5. 标签操作 (Tags)

| 方法 | 端点 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/getTagValue?ids=[...]` | Admin/Script | 读取标签值，ids 为 JSON 数组 |
| POST | `/api/setTagValue` | Admin | 写入标签值，body: `{tags: [{id, value}]}` |

### 6. 报警管理 (Alarms)

| 方法 | 端点 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/alarms?filter=<json>` | JWT | 获取当前报警 |
| GET | `/api/alarmsHistory?start=&end=` | JWT | 获取报警历史 |
| POST | `/api/alarmack` | JWT | 确认报警 |
| POST | `/api/alarmsClear` | Admin | 清除报警 |

**报警定义通过 `POST /api/projectData` 的 `cmd: 'set-alarm'` 管理。**

### 7. 脚本 (Scripts)

| 方法 | 端点 | 认证 | 说明 |
|------|------|------|------|
| POST | `/api/runscript` | JWT | 执行脚本 |
| POST | `/api/runSysFunction` | Admin | 执行系统函数 |

### 8. DAQ 历史数据

| 方法 | 端点 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/daq?query=<json>` | JWT | 查询历史数据 |

**query 格式：** `{from: "ISO-date", to: "ISO-date", sids: ["tag-id-1", "tag-id-2"]}`

### 9. 用户管理 (Users)

| 方法 | 端点 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/users` | Admin | 获取用户列表 |
| POST | `/api/users` | Admin | 创建/更新用户 |
| DELETE | `/api/users?param=<username>` | Admin | 删除用户 |
| GET | `/api/roles` | Admin | 获取角色 |
| POST | `/api/roles` | Admin | 创建/更新角色 |
| DELETE | `/api/roles` | Admin | 删除角色 |

### 10. API Key

| 方法 | 端点 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/apikeys` | Admin | 获取列表 |
| POST | `/api/apikeys` | Admin | 创建/更新 |
| DELETE | `/api/apikeys` | Admin | 删除 |

### 11. 资源管理 (Resources)

| 方法 | 端点 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/resources/images` | Admin | 获取图片列表 |
| GET | `/api/resources/resources` | Admin | 获取资源列表 |
| POST | `/api/upload` | Admin | 上传文件 |
| POST | `/api/resources/remove` | Admin | 删除资源 |
| GET | `/api/resources/templates` | Admin | 获取模板 |
| GET | `/api/resources/widgets` | Admin | 获取 Widget |

### 12. 报表 (Reports)

| 方法 | 端点 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/reportsQuery?query=<json>` | JWT | 查询报表 |
| POST | `/api/reportBuild` | Admin | 生成报表 |
| POST | `/api/reportRemoveFile` | Admin | 删除报表文件 |

### 13. 调度器 (Scheduler)

| 方法 | 端点 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/scheduler?id=<id>` | JWT | 获取调度 |
| POST | `/api/scheduler` | JWT | 设置调度 |
| DELETE | `/api/scheduler?id=<id>` | JWT | 删除调度 |

### 14. 诊断/日志

| 方法 | 端点 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/logsdir` | Admin | 获取日志文件列表 |
| GET | `/api/logs?file=<name>` | Admin | 获取日志内容 |
| POST | `/api/sendmail` | Admin | 发送测试邮件 |

### 15. 插件 (Plugins)

| 方法 | 端点 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/plugins` | Admin | 获取插件列表 |
| POST | `/api/plugins` | Admin | 安装插件 |
| DELETE | `/api/plugins?param=<id>` | Admin | 卸载插件 |

## 支持的 16 种设备驱动

驱动实现位于 FUXA 服务器的 `server/runtime/devices/`。

| 驱动类型 | 标识 | 典型用途 |
|----------|------|----------|
| Modbus TCP | `ModbusTCP` | PLC、传感器 |
| Modbus RTU | `ModbusRTU` | 串口设备 |
| OPC UA | `OPCUA` | 标准化工业互联 |
| Siemens S7 | `SiemensS7` | 西门子 PLC |
| BACnet | `BACnet` | 楼宇自动化 |
| MQTT Client | `MQTTclient` | IoT 消息 |
| Web API | `WebAPI` | HTTP REST 接口 |
| EtherNet/IP | `EthernetIP` | AB/罗克韦尔 PLC |
| FUXA Server | `FuxaServer` | FUXA 间互联 |
| ODBC | `ODBC` | 数据库连接 |
| Beckhoff ADS | `ADSclient` | 倍福 PLC |
| Mitsubishi MELSEC | `MELSEC` | 三菱 PLC |
| Redis | `REDIS` | 缓存/消息 |
| Raspberry Pi GPIO | `GPIO` | 树莓派 IO |
| WebCam | `WebCam` | 摄像头 |
| Internal | `internal` | 虚拟标签 |

## 报警类型参考

| 类型 | 标识 | 确认模式 | 标识 |
|------|------|----------|------|
| 高高报警 | `highhigh` | 浮动 | `alarm.ack-float` |
| 高报警 | `high` | 主动确认 | `alarm.ack-active` |
| 低报警 | `low` | 被动确认 | `alarm.ack-passive` |
| 信息 | `info` | | |

**报警动作类型：** `popup` | `setView` | `setValue` | `runScript` | `toastMessage`

## 项目数据结构

`GET /api/project` 返回：

```
{
  devices: {},          // 设备配置（对象，key=deviceId）
  hmi: {
    views: [],         // 视图数组
    layout: {}         // 导航/头部布局
  },
  texts: [],           // 多语言文本
  alarms: [],          // 报警定义
  notifications: [],   // 通知定义
  scripts: [],         // 脚本定义
  reports: [],         // 报表定义
  mapsLocations: [],   // 地图位置
  charts: {},          // 图表配置
  graphs: {},          // 图形配置
  languages: {},       // 语言设置
  clientAccess: {}     // 客户端访问设置
}
```

**语言代码必须精确匹配翻译文件名**（`client/src/assets/i18n/*.json`）：
`en` | `zh-cn`（简体中文） | `zh-tw`（繁体中文） | `de` | `fr` | `es` | `pt` | `ru` | `ua` | `ja` | `ko` | `tr` | `sv`
**注意：中文是 `zh-cn` 不是 `zh`，用错会导致按钮文字消失。**

## 权限系统

| 模式 | 设置值 | 说明 |
|------|--------|------|
| 位掩码 | `userRole: "bitmask"` | Show=bits 8-15, Enabled=bits 0-7 |
| 角色制 | `userRole: "roles"` | `permissionRoles: {show: [...], enabled: [...]}` |

## DAQ 存储后端

| 类型 | 标识 |
|------|------|
| SQLite | `SQlite`（默认） |
| InfluxDB 2.x | `influxDB` |
| InfluxDB 1.8 | `influxDB 1.8` |
| TDengine | `TDengine` |
| QuestDB | `questDB` |

## 常见错误总结

| 错误字段名 | 正确字段名 | 说明 |
|------------|------------|------|
| `property.unitId` | `property.slaveid` | Modbus 从站 ID（全小写字符串） |
| `property.host` | `property.address` | 设备地址 |
| `language: 'zh'` | `language: 'zh-cn'` | 中文语言代码 |
| `cmd: 'devices'` | `cmd: 'set-device'` | projectData 命令值 |
| `cmd: 'alarms'` | `cmd: 'set-alarm'` | projectData 命令值 |
| `memaddress: 'HR40001'` | `memaddress: '400001', address: '1'` | Modbus 地址格式 |
| `property.port: 502` | `property.port: '502'` | 端口字段类型为字符串 |

## 工作流程

### 初始化（每次对话必须）

1. 询问用户 FUXA 服务器地址
2. 询问认证方式（用户名密码 / API Key）
3. 如果需要认证，调用 `POST /api/signin` 登录
4. 后续操作通过 API 完成

### 场景 1：配置设备

```
1. 询问设备类型（16 种驱动）
2. 询问连接参数（注意字段名精确匹配）
3. 询问标签列表（注意 Modbus 地址格式）
4. 调用 client.setDevice({...}) 创建设备
5. 验证：调用 client.getDevice(id) 确认
```

### 场景 2：配置报警

```
1. 获取现有设备/标签：client.getDevices()
2. 询问报警条件、确认模式、动作
3. 调用 client.setAlarmDefinition({...})
```

### 场景 3：读取/写入标签

```
1. 读取：client.getTagValue(['tag-id'])
2. 写入：client.setTagValue([{id: 'tag-id', value: 100}])
```

### 场景 4：执行脚本

```
1. 询问脚本功能
2. 生成脚本代码
3. client.runScript({name: '脚本名', content: '...'})
```

## FUXA 脚本 API 参考

脚本在 FUXA 服务端执行，以下 API 可用：

| API | 说明 | 示例 |
|-----|------|------|
| `fuxa.getTagValue(tagId)` | 获取标签值 | `var temp = fuxa.getTagValue('t_tag1')` |
| `fuxa.setTagValue(tagId, value)` | 设置标签值 | `fuxa.setTagValue('t_tag2', true)` |
| `fuxa.getTagQuality(tagId)` | 获取标签质量 | `var q = fuxa.getTagQuality('t_tag1')` |
| `fuxa.log(message, level)` | 记录日志 | `fuxa.log('警告', 'warn')` |
| `fuxa.setAlarm(alarmId, active)` | 触发/清除报警 | `fuxa.setAlarm('alarm-001', true)` |
| `fuxa.ackAlarm(alarmId)` | 确认报警 | `fuxa.ackAlarm('alarm-001')` |
| `fuxa.enableDevice(deviceId, enable)` | 启用/禁用设备 | `fuxa.enableDevice('d_xxx', false)` |
| `fuxa.http.get(url, options)` | GET 请求 | `fuxa.http.get('http://api.example.com')` |
| `fuxa.http.post(url, data, options)` | POST 请求 | `fuxa.http.post(url, {key: 'value'})` |
| `fuxa.setTimeout(callback, delay)` | 延时执行 | `fuxa.setTimeout(() => {...}, 1000)` |
| `fuxa.setInterval(callback, delay)` | 定时执行 | `fuxa.setInterval(() => {...}, 5000)` |

**日志级别**: `info` | `warn` | `error`

**脚本模板见**: `references/script-template.js`

### 场景 5：查看/修改系统设置

```
1. client.getSettings() 获取当前设置
2. 修改后 client.updateSettings({...})
```

### 场景 6：查询历史数据

```
1. 询问时间范围和标签 ID
2. client.getDaqData('2024-01-01T00:00:00Z', '2024-01-02T00:00:00Z', ['t_tag1'])
```

### 场景 7：读取当前报警信息

```
1. client.getAlarms() 获取当前活跃报警列表
2. 可传 filter 参数筛选：{ type: 'high', acknowledged: false }
3. 返回格式：[{ name, text, group, type, status, value, timestamp }]
```

### 场景 8：读取报警历史

```
1. 询问时间范围
2. client.getAlarmsHistory('2024-01-01T00:00:00Z', '2024-01-02T00:00:00Z')
3. 可传 filter 参数筛选特定报警
```

### 场景 9：读取标签当前值

```
1. 询问需要读取的标签 ID
2. client.getTagValue(['t_tag1', 't_tag2'])
3. 返回格式：[{ id: 't_tag1', value: 25.3, timestamp: '...' }]
```

### 场景 10：查询报表内容

```
1. 询问报表名称和时间范围
2. client.queryReports({ name: '日报表', from: '...', to: '...' })
3. 返回报表数据（CSV/JSON 格式）
```

### 场景 11：查询项目配置

```
1. client.getProject() 获取完整项目配置
2. 返回包含：devices（设备）、hmi.views（视图）、alarms（报警定义）、scripts（脚本）等
3. 可单独查询设备列表：Object.keys(project.devices)
```

### 场景 12：读取系统日志

```
1. client.getLogFiles() 获取日志文件列表
2. client.getLogContent('error-2024-01-01.log') 获取特定日志内容
```

### 场景 13：读取设备连接状态

```
1. client.getAllDeviceConnectionStatus() 获取所有设备连接状态
2. 或 client.getDeviceConnectionStatus('device-id') 获取单个设备状态
3. 状态值含义：0=离线，3=警告，5=在线
```

## 本地部署、更新与卸载（FUXADeployer）

`FUXADeployer` 类生成 shell 命令，由 Claude 通过 Bash 工具在**本机**执行。支持 3 种方式：

### 支持的部署方式

| 方式 | 标识 | 适用场景 |
|------|------|----------|
| Docker | `docker` | 推荐，最干净，支持数据持久化 |
| 源码 | `source` | 需要二次开发时使用 |
| NPM | `npm` | 快速体验，全局安装 |

### 使用方式

```javascript
const { FUXADeployer } = require('./references/fuxa-cli');

const deployer = new FUXADeployer({
  method: 'docker',         // docker | source | npm
  port: 1881,               // 服务端口
  containerName: 'fuxa',    // Docker 容器名
  persist: true,            // 是否持久化数据
  // source 方式可选：
  // sourceDir: './FUXA',
  // repoUrl: 'https://github.com/frangoteam/FUXA.git',
  // branch: 'main',
});

// 获取部署命令
const cmds = deployer.deployCommands();
// cmds = [{ desc: '...', cmd: '...' }, ...]

// 获取更新命令
const updateCmds = deployer.updateCommands();

// 获取卸载命令
const cleanCmds = deployer.uninstallCommands();

// 获取状态检查命令
const statusCmds = deployer.statusCommands();

// 生成 docker-compose.yml
const compose = deployer.dockerComposeYml();
```

### 场景 7：部署 FUXA

```
1. 询问部署方式（docker/source/npm）
2. 询问端口等参数
3. const deployer = new FUXADeployer({...})
4. 遍历 deployer.deployCommands()，逐条用 Bash 执行
5. 遍历 deployer.statusCommands()，验证部署成功
```

### 场景 8：卸载 FUXA

```
1. 确认卸载方式（需与部署方式匹配）
2. const deployer = new FUXADeployer({...})
3. 遍历 deployer.uninstallCommands()，逐条用 Bash 执行
4. 注意：带 warning 的命令需用户确认后再执行
```

### 场景 9：更新/升级 FUXA

```
1. 确认部署方式（需与原部署方式匹配）
2. const deployer = new FUXADeployer({...})
3. 遍历 deployer.updateCommands()，逐条用 Bash 执行
4. 验证更新成功（遍历 deployer.statusCommands()）
```

**更新逻辑（按部署方式）：**

| 方式 | 更新操作 | 数据保留 |
|------|----------|----------|
| Docker | 拉取新镜像 + 停止旧容器 + 启动新容器 | 数据卷自动保留 |
| Source | git pull + npm install + npm build + 重启进程 | `_appdata/` 目录保留 |
| NPM | npm update -g + 重启进程 | `_appdata/` 目录保留 |

### Docker 部署参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `containerName` | `fuxa` | 容器名称 |
| `imageName` | `frangoteam/fuxa` | 镜像名称 |
| `imageTag` | `latest` | 镜像标签 |
| `port` | `1881` | 映射端口 |
| `persist` | `true` | 是否挂载数据卷 |
| `withODBC` | `false` | 本地构建时包含 ODBC 驱动 |
| `withSnap7` | `false` | 本地构建时包含 Snap7 |
| `sourceDir` | - | 本地 Dockerfile 路径（走本地构建） |

### 卸载注意事项

- 带 `warning` 字段的命令**必须先让用户确认**再执行
- Docker 卸载会删除容器、镜像、数据卷（如 persist=true）
- 源码卸载会停止进程并删除整个目录
- NPM 卸载会停止进程并移除全局包

## 注意事项

1. **远程操作**：配置管理通过 HTTP API 完成
2. **本地操作**：部署/更新/卸载在本机通过 shell 命令执行
3. **先连接后操作**：远程管理必须先获取服务器地址和认证信息
4. **字段名精确匹配**：所有 API 参数字段名必须精确匹配源码定义（见 data-models.md）
5. **安全第一**：涉及密码、删除操作时提醒用户注意
6. **版本兼容**：基于 FUXA 1.3.1 REST API
7. **API 文档**：可在设置中启用 `swaggerEnabled: true` 访问 `/api-docs`

## 常见问题

### Q1: 连接失败怎么办？
检查：1) URL 是否正确 2) 网络是否可达 3) 端口是否开放 4) 是否需要认证

### Q2: 认证失败？
检查：1) 用户名密码是否正确 2) Token 是否过期（调用 heartbeat 刷新） 3) 是否需要先登录

### Q3: 如何获取 API Key？
用 Admin 账户登录后，调用 `POST /api/apikeys` 创建

### Q4: 如何查看 Swagger 文档？
在 FUXA 系统设置中启用 `swaggerEnabled: true`，然后访问 `http://<host>:<port>/api-docs`

### Q5: Docker 部署后如何查看日志？
`docker logs fuxa` 或 `docker logs -f fuxa`（实时跟踪）

### Q6: 如何备份数据？
Docker：`docker run --rm -v fuxa_appdata:/data -v $(pwd):/backup alpine tar czf /backup/fuxa_backup.tar.gz /data`
源码：备份 `_appdata/` 目录

### Q7: 如何升级 FUXA？
使用 `FUXADeployer.updateCommands()` 自动升级（推荐）：
```javascript
const deployer = new FUXADeployer({ method: 'docker' });  // 或 'source' / 'npm'
const cmds = deployer.updateCommands();  // 按部署方式生成升级命令
```
手动升级：
- Docker：`docker pull frangoteam/fuxa:latest` + 停止旧容器 + 启动新容器
- 源码：`git pull` + `npm install` + `npm run build` + 重启进程
- NPM：`npm update -g @frangoteam/fuxa` + 重启

**数据会自动保留**（Docker 数据卷、`_appdata/` 目录）

### Q8: 为什么按钮文字消失？
语言设置用了 `'zh'`，正确值是 `'zh-cn'`（必须匹配 i18n 文件名）