---
name: FUXA Data Models
description: FUXA 数据模型参考文档 - 所有 API 传参字段定义
type: reference
---

# FUXA 数据模型参考文档

本文档基于 FUXA 源码 `client/src/app/_models/` 目录下的 TypeScript 模型文件整理，包含所有 API 传参的正确字段名、类型和枚举值。

**重要**: 所有字段名必须精确匹配，否则 API 会返回错误或数据不生效。

---

## 1. Device 设备模型 (`device.ts`)

### 1.1 Device 类

```typescript
class Device {
    id: string;            // 设备 ID，GUID 格式，前缀 'd_'
    name: string;          // 设备名称
    enabled: boolean;      // 是否启用
    type: DeviceType;      // 设备类型（见枚举）
    polling: number;       // 轮询间隔（毫秒），默认 1000
    property: any;         // 连接属性（DeviceNetProperty 或其他）
    tags: DictionaryTag;   // 标签字典，key=tagId, value=Tag
}
```

### 1.2 DeviceType 枚举

```typescript
enum DeviceType {
    FuxaServer = 'FuxaServer',
    SiemensS7 = 'SiemensS7',
    OPCUA = 'OPCUA',
    BACnet = 'BACnet',
    ModbusRTU = 'ModbusRTU',
    ModbusTCP = 'ModbusTCP',
    WebAPI = 'WebAPI',
    MQTTclient = 'MQTTclient',
    internal = 'internal',
    EthernetIP = 'EthernetIP',
    ODBC = 'ODBC',
    ADSclient = 'ADSclient',
    GPIO = 'GPIO',
    WebCam = 'WebCam',
    MELSEC = 'MELSEC',
    REDIS = 'REDIS'
}
```

### 1.3 DeviceNetProperty 连接属性（通用）

**关键**: 字段名必须精确匹配，特别是 `slaveid`（全小写字符串）。

```typescript
class DeviceNetProperty {
    address: string;          // 设备地址（IP），如 "192.168.1.100"
    port: string;             // 端口，如 "502"
    slot: string;             // S7 槽号
    rack: string;             // S7 机架号
    slaveid: string;          // Modbus 从站 ID（全小写！）
    baudrate: string;         // Modbus RTU 波特率
    databits: string;         // Modbus RTU 数据位
    stopbits: string;         // Modbus RTU 停止位
    parity: string;           // Modbus RTU 校验
    options: string;          // Modbus 分帧选项 / EthernetIP routing
    method: string;           // WebAPI 方法 (GET/POST)
    format: string;           // WebAPI 数据格式 (CSV/JSON)
    connectionOption: string; // Modbus 连接选项 / Redis readMode
    delay: number = 10;       // Modbus RTU/TCP 帧间延迟（毫秒）
    socketReuse?: string;     // Modbus TCP socket 复用
    forceFC16?: boolean;      // Modbus 强制使用 FC16 写入
    ascii?: boolean;          // MELSEC ASCII 模式
    octalIO?: boolean;        // MELSEC 八进制 IO
}
```

**Modbus TCP 典型配置**:
```json
{
  "id": "d_xxx",
  "name": "Modbus PLC",
  "enabled": true,
  "type": "ModbusTCP",
  "polling": 1000,
  "property": {
    "address": "192.168.0.119",
    "port": "502",
    "slaveid": "1"
  },
  "tags": {}
}
```

**Siemens S7 典型配置**:
```json
{
  "property": {
    "address": "192.168.1.100",
    "port": "102",
    "rack": "0",
    "slot": "1"
  }
}
```

---

## 2. Tag 标签模型 (`device.ts`)

### 2.1 Tag 类

```typescript
class Tag {
    id: string;              // 标签 ID，GUID 格式，前缀 't_'
    name: string;            // 标签名称
    label: string;           // 标签标签（BACnet/WebAPI 使用）
    type: string;            // 数据类型（见枚举，根据设备类型选择）
    memaddress: string;      // Modbus: 寄存器类型基数（如 "400001"）
                             // OPCUA/WebAPI: 其他属性
    address: string;         // OPCUA: 节点 ID (如 "ns=2;s=Motor.Status")
                             // GPIO: IO 编号
                             // Modbus: 偏移地址（1-based，如 "1"）
    divisor: number;         // Modbus 除数
    format: number;          // 小数位数
    init: string;            // 初始值
    daq: TagDaq;             // DAQ 设置
    direction?: string;      // GPIO 方向 ('in', 'out', 'high', 'low')
    edge?: string;           // GPIO 边沿触发 ('none', 'rising', 'falling', 'both')
    description?: string;    // 描述
    unsPath?: string | null; // Unified Namespace 路径
    deadband?: TagDeadband;  // 死区设置
    scale: TagScale;         // 缩放设置
    options: any;            // WebAPI/MQTT 选项（JSON 对象）
}
```

### 2.2 TagDaq 类

```typescript
class TagDaq {
    enabled: boolean;    // 是否启用 DAQ 存储
    changed: boolean;    // 值变化时存储
    interval: number;    // 固定存储间隔（秒）
    restored: boolean;   // 启动时恢复上次值
}
```

### 2.3 Tag 类型枚举（按设备类型）

**ModbusTagType**:
```typescript
enum ModbusTagType {
    Bool = 'Bool',
    Int16 = 'Int16',
    UInt16 = 'UInt16',
    Int32 = 'Int32',
    UInt32 = 'UInt32',
    Float32 = 'Float32',
    Float64 = 'Float64',
    Int64 = 'Int64',
    // LE (Little Endian) 版本
    Int16LE, UInt16LE, Int32LE, UInt32LE, Float32LE, Float64LE, Int64LE,
    // MLE (Middle Little Endian) 版本
    Float32MLE, Int32MLE, UInt32MLE, Float64MLE
}
```

**⚠️ 设备文档数据类型 → FUXA tag type 映射表**:

| 设备文档描述 | 含义 | FUXA tag type |
|-------------|------|--------------|
| 整型有符号 | 16-bit signed int, 大端 | `Int16` |
| 整型有符号顺序AB | 16-bit signed int, 小端 (AB字节序) | `Int16LE` |
| 整型无符号 | 16-bit unsigned int, 大端 | `UInt16` |
| 整型无符号顺序AB | 16-bit unsigned int, 小端 | `UInt16LE` |
| 双整型有符号/32位整型 | 32-bit signed int, 大端 | `Int32` |
| 双整型有符号顺序AB | 32-bit signed int, 小端 | `Int32LE` |
| 浮点型/实数 | 32-bit float, 大端 | `Float32` |
| 浮点型顺序AB/ABCD | 32-bit float, 小端 | `Float32LE` |
| 浮点型顺序CDAB/BADC | 32-bit float, 中大小端 | `Float32MLE` |
| 布尔/开关 | Boolean (Coil 或 DI) | `Bool` |

**重要规则**:
1. **严格按设备文档设置类型**——不能一刀切全部 Float32
2. **"顺序AB" = Little Endian = LE 后缀类型**
3. **"顺序CDAB/BADC" = Middle Little Endian = MLE 后缀类型**
4. **无特殊说明默认大端 = 不带 LE/MLE 后缀的基础类型**
5. 类型设错会导致读取的数值完全错误（如温度显示几万）

**OpcUaTagType**:
```typescript
enum OpcUaTagType {
    Boolean = 'Boolean',
    SByte = 'SByte',
    Byte = 'Byte',
    Int16 = 'Int16',
    UInt16 = 'UInt16',
    Int32 = 'Int32',
    UInt32 = 'UInt32',
    Int64 = 'Int64',
    UInt64 = 'UInt64',
    Float = 'Float',
    Double = 'Double',
    String = 'String',
    DateTime = 'DateTime',
    Guid = 'Guid',
    ByteString = 'ByteString'
}
```

**MelsecTagType**:
```typescript
enum MelsecTagType {
    BOOL = 'BOOL',
    BYTE = 'BYTE',
    WORD = 'WORD',
    INT = 'INT',
    UINT = 'UINT',
    DINT = 'DINT',
    UDINT = 'UDINT',
    REAL = 'REAL',
    STRING = 'STRING'
}
```

**AdsClientTagType**:
```typescript
enum AdsClientTagType {
    Number = 'number',
    Boolean = 'boolean',
    String = 'string'
}
```

**RedisTagType / ServerTagType**:
```typescript
enum RedisTagType {
    number = 'number',
    boolean = 'boolean',
    string = 'string'
}
```

### 2.3 TagScale 缩放配置

Tag 支持通过 `scale` 字段对原始寄存器值进行转换。转换在读数时自动执行（来源: `device-utils.js` 的 `tagValueCompose`）。

```typescript
class TagScale {
    mode: TagScaleModeType;       // 缩放模式
    rawLow: number;               // 线性模式: 原始最小值
    rawHigh: number;              // 线性模式: 原始最大值
    scaledLow: number;            // 线性模式: 缩放最小值
    scaledHigh: number;           // 线性模式: 缩放最大值
    dateTimeFormat: string;       // 时间格式
    readExpression: string;       // 表达式模式: 读表达式（this 代表原始值）
    writeExpression: string;      // 表达式模式: 写表达式
}

enum TagScaleModeType {
    undefined = 'device.tag-scale-mode-undefined',
    linear = 'device.tag-scale-mode-linear',              // 线性缩放
    convertDateTime = 'device.tag-convert-datetime',      // 时间转换
    convertTickTime = 'device.tag-convert-ticktime',      // Tick时间转换
    expression = 'device.tag-scale-mode-expression',      // 自定义表达式
}
```

**表达式模式** - 最常用的转换方式，表达式中 `this` 代表原始寄存器值:

| 文档公式 | readExpression 写法 | 说明 |
|---------|-------------------|------|
| `(X/100-32)/1.8` | `(this/100-32)/1.8` | 华氏温度转摄氏 |
| `X*0.00070307` | `this*0.00070307` | 压力转换 |
| `X*0.01` | `this*0.01` | 百分比/电流 |
| `X*0.254` | `this*0.254` | 振动转换 |

**配置示例**:
```json
{
  "type": "Int16LE",
  "memaddress": "300000",
  "address": "1",
  "format": 2,
  "scale": {
    "mode": "expression",
    "readExpression": "this*0.01"
  }
}
```

**线性缩放示例**（4-20mA 转 0-100 范围）:
```json
{
  "scale": {
    "mode": "linear",
    "rawLow": 4096, "rawHigh": 20480,
    "scaledLow": 0, "scaledHigh": 100
  }
}
```

### 2.4 Modbus 地址规则

**关键**: `memaddress` 是 **6 位固定基址**（不是范围值），前端下拉框精确匹配此值。`address` 是 1-based 偏移量。

**⚠️ 前端下拉框精确映射**（来源: `tag-property-edit-modbus.component.ts`）:

| 下拉框显示 | memaddress 基址 | address 范围 |
|-----------|----------------|-------------|
| Coil Status (Read/Write 000001-065536) | `"000000"` | 1-65536 |
| Digital Inputs (Read 100001-165536) | `"100000"` | 1-65536 |
| Input Registers (Read 300001-365536) | `"300000"` | 1-65536 |
| Holding Registers (Read/Write 400001-465535) | `"400000"` | 1-65536 |

**地址计算**:
1. 文档给十六进制偏移量 → `address = parseInt(hex, 16) + 1`
2. 文档给寄存器编号如 30001 → 这是显示编号，`memaddress = "300000"`, `address = 1`
3. 文档给 30031（十六进制偏移 0x0030）→ `memaddress = "300000"`, `address = 49`

**示例 - 温度传感器 @ IR 30001（偏移 0x0000）**:
```json
{
  "id": "t_xxx",
  "name": "排气温度",
  "type": "Int16LE",
  "memaddress": "300000",
  "address": "1",
  "format": 1,
  "scale": {
    "mode": "expression",
    "readExpression": "(this/100-32)/1.8"
  },
  "daq": { "enabled": false, "changed": true, "interval": 60 }
}
```

---

## 3. Alarm 报警模型 (`alarm.ts`)

### 3.1 Alarm 类

```typescript
class Alarm {
    name: string;              // 报警名称
    property: AlarmProperty;   // 报警属性
    highhigh: AlarmSubProperty; // 高高报警
    high: AlarmSubProperty;     // 高报警
    low: AlarmSubProperty;      // 低报警
    info: AlarmSubProperty;     // 信息报警
    actions: AlarmSubActions;   // 报警动作
    value: string;              // 当前值
}
```

### 3.2 AlarmProperty 类

```typescript
class AlarmProperty {
    variableId: string;        // 关联标签 ID
    permission: number;        // 权限位掩码
    permissionRoles: {
        show: string[];        // 可见角色
        enabled: string[];     // 可操作角色
    };
}
```

### 3.3 AlarmSubProperty 类

```typescript
class AlarmSubProperty {
    enabled: boolean;          // 是否启用该级别
    checkdelay: number;        // 检查延迟（秒）
    min: number;               // 阈值下限（highhigh/high: 报警阈值）
    max: number;               // 阈值上限（low: 报警阈值）
    timedelay: number;         // 时间延迟（秒）
    text: string;              // 报警文本
    group: string;             // 报警分组
    ackmode: AlarmAckMode;     // 确认模式
    bkcolor: string;           // 背景色
    color: string;             // 前景色
}
```

### 3.4 AlarmAckMode 枚举

```typescript
enum AlarmAckMode {
    float = 'alarm.ack-float',      // 浮动确认
    ackactive = 'alarm.ack-active', // 主动确认
    ackpassive = 'alarm.ack-passive' // 被动确认
}
```

### 3.5 AlarmSubActions 类

```typescript
class AlarmSubActions {
    enabled: boolean;         // 是否启用动作
    values: AlarmAction[];    // 动作列表
}
```

### 3.6 AlarmAction 类

```typescript
class AlarmAction extends AlarmSubRange {
    type: AlarmActionsType;   // 动作类型
    actparam: any;            // 动作参数
    variableId: any;          // 关联标签
    actoptions = {};          // 动作选项
}
```

### 3.7 AlarmActionsType 枚举

```typescript
enum AlarmActionsType {
    popup = 'alarm.action-popup',
    setView = 'alarm.action-onsetview',
    setValue = 'alarm.action-onsetvalue',
    runScript = 'alarm.action-onRunScript',
    toastMessage = 'alarm.action-toastMessage'
}
```

---

## 4. Notification 通知模型 (`notification.ts`)

### 4.1 Notification 类

```typescript
class Notification {
    id: string;              // 通知 ID
    name: string;            // 通知名称
    receiver: string;        // 接收者
    delay: number = 1;       // 延迟（秒）
    interval: number = 0;    // 间隔（秒）
    enabled: boolean = true; // 是否启用
    text: string;            // 通知文本
    type: string;            // 通知类型
    subscriptions = {};      // 订阅（报警订阅）
    options: any;            // 选项
    mode: NotificationMode;  // 模式
}
```

### 4.2 NotificationMode 枚举

```typescript
enum NotificationMode {
    all = 0,    // 所有报警
    single = 1  // 单个报警
}
```

---

## 5. Script 脚本模型 (`script.ts`)

### 5.1 Script 类

```typescript
class Script {
    id: string;              // 脚本 ID，前缀 's_'
    name: string;            // 脚本名称
    code: string;            // 脚本代码
    sync?: boolean = false;  // 是否同步
    parameters: ScriptParam[] = []; // 参数列表
    scheduling: ScriptScheduling;   // 调度设置
    permission: number;      // 权限位掩码
    permissionRoles: {
        enabled: string[];   // 可执行角色
    };
    mode: ScriptMode;        // 运行模式（CLIENT/SERVER）
}
```

### 5.2 ScriptMode 枚举

```typescript
enum ScriptMode {
    CLIENT = 'CLIENT',  // 客户端脚本
    SERVER = 'SERVER'   // 服务端脚本
}
```

### 5.3 ScriptScheduling 接口

```typescript
interface ScriptScheduling {
    mode: ScriptSchedulingMode;
    interval: number;
    schedules: SchedulerData[];
}
```

### 5.4 ScriptSchedulingMode 枚举

```typescript
enum ScriptSchedulingMode {
    interval = 'interval',     // 定时执行
    start = 'start',           // 启动时执行
    scheduling = 'scheduling'  // 按调度执行
}
```

---

## 6. View 视图模型 (`hmi.ts`)

### 6.1 View 类

```typescript
class View {
    id: string;              // 视图 ID
    name: string;            // 视图名称
    profile: DocProfile;     // 视图尺寸/背景
    items: DictionaryGaugeSettings; // 控件字典
    variables: DictionaryVariables; // 变量字典
    svgcontent: string;      // SVG 内容
    type: ViewType;          // 视图类型
    property: ViewProperty;  // 视图属性（事件等）
}
```

### 6.2 ViewType 枚举

```typescript
enum ViewType {
    svg = 'svg',
    cards = 'cards',
    maps = 'maps'
}
```

### 6.3 GaugeSettings 类（控件）

```typescript
class GaugeSettings {
    id: string;              // 控件 ID
    type: string;            // 控件类型
    name: string;            // 控件名称
    property: GaugeProperty; // 控件属性
    label: string;           // 类型标签
    hide: boolean;           // 是否隐藏
    lock: boolean;           // 是否锁定
}
```

### 6.4 GaugeProperty 类

```typescript
class GaugeProperty {
    variableId: string;      // 绑定标签 ID
    variableValue: string;   // 标签值
    bitmask: number;         // 位掩码
    permission: number;      // 权限位掩码
    permissionRoles: PermissionRoles; // 权限角色
    ranges: GaugeRangeProperty[];     // 范围属性
    events: GaugeEvent[];    // 事件列表
    actions: GaugeAction[];  // 动作列表
    options: any;            // 选项
    readonly: boolean;       // 只读
    text: string;            // 文本（按钮用）
}
```

### 6.5 PermissionRoles 接口

```typescript
interface PermissionRoles {
    show: string[];    // 可见角色列表
    enabled: string[]; // 可操作角色列表
}
```

---

## 7. LayoutSettings 布局模型 (`hmi.ts`)

### 7.1 LayoutSettings 类

```typescript
class LayoutSettings {
    autoresize?: boolean = false; // 自动调整大小
    start: string;                // 起始视图（主页）
    navigation: NavigationSettings; // 导航菜单设置
    header: HeaderSettings;       // 头部设置
    showdev: boolean = true;      // 显示开发按钮
    zoom: ZoomModeType;           // 缩放模式
    inputdialog: string = 'false'; // 输入对话框模式
    hidenavigation: boolean = false; // 隐藏导航
    theme: string = '';           // GUI 主题
    loginonstart?: boolean = false; // 启动时显示登录
    loginoverlaycolor?: LoginOverlayColorType; // 登录遮罩色
    show_connection_error?: boolean = true; // 显示连接错误
    customStyles: string = '';    // 自定义 CSS
}
```

### 7.2 NavigationSettings 类

```typescript
class NavigationSettings {
    mode: NaviModeType;       // 菜单模式
    type: NaviItemType;       // 菜单项类型
    bkcolor: string = '#F4F5F7'; // 背景色
    fgcolor: string = '#1D1D1D'; // 前景色
    items: NaviItem[];        // 菜单项列表
    logo?: boolean = false;   // 自定义 logo
}
```

### 7.3 NaviItem 类

```typescript
class NaviItem {
    id?: string;
    text: string;             // 菜单项文本
    link: string;             // 链接
    view: string;             // 视图名称
    icon: string;             // 图标
    image: string;            // 图片
    permission: number;       // 权限位掩码
    permissionRoles: PermissionRoles; // 权限角色
    children?: NaviItem[];    // 子菜单
}
```

---

## 8. Settings 系统设置模型 (`settings.ts`)

### 8.1 AppSettings 类

```typescript
class AppSettings {
    language: string = 'en';          // 编辑器语言（见语言代码表）
    hideEditorOnboarding: boolean = false;
    uiPort: number = 1881;            // Web 端口
    secureEnabled: boolean = false;   // 启用安全认证
    secretCode: string = '';          // JWT 密钥
    tokenExpiresIn: string = '1h';    // Token 过期时间
    enableRefreshCookieAuth: boolean = false;
    refreshTokenExpiresIn?: string;
    secureOnlyEditor: boolean = false;
    broadcastAll: boolean = false;
    smtp: SmtpSettings;               // SMTP 设置
    daqstore: DaqStore;               // DAQ 存储
    alarms: AlarmsSettings;           // 报警存储
    logs: LogsSettings;               // 日志存储
    logFull: boolean = false;
    userRole: boolean | string = false; // 用户角色模式
    nodeRedEnabled: boolean = true;
    nodeRedAuthMode: string = 'secure';
    swaggerEnabled: boolean = false;
}
```

### 8.2 语言代码表（必须精确匹配）

**关键**: 语言代码必须匹配 `client/src/assets/i18n/*.json` 文件名。

| 代码 | 语言 |
|------|------|
| `en` | 英语 |
| `zh-cn` | **简体中文**（不是 `zh`！） |
| `zh-tw` | 繁体中文 |
| `de` | 德语 |
| `fr` | 法语 |
| `es` | 西班牙语 |
| `pt` | 葡萄牙语 |
| `ru` | 俄语 |
| `ua` | 乌克兰语 |
| `ja` | 日语 |
| `ko` | 韩语 |
| `tr` | 土耳其语 |
| `sv` | 瑞典语 |

**错误示例**: 使用 `zh` 会导致按钮文字消失，必须用 `zh-cn`。

### 8.3 DaqStore 类

```typescript
class DaqStore {
    type: DaqStoreType = DaqStoreType.SQlite;
    url?: string;             // InfluxDB URL
    host: string = '127.0.0.1';
    tableName: string = 'meters';
    configurationString: string;
    organization?: string;    // InfluxDB org
    credentials?: StoreCredentials;
    bucket?: string;          // InfluxDB bucket
    database?: string;        // TDengine database
    retention: DaqStoreRetentionType;
}
```

### 8.4 DaqStoreType 枚举

```typescript
enum DaqStoreType {
    SQlite = 'SQlite',
    influxDB = 'influxDB',
    influxDB18 = 'influxDB 1.8',
    TDengine = 'TDengine',
    questDB = 'questDB'
}
```

---

## 9. Chart 图表模型 (`chart.ts`)

### 9.1 Chart 类

```typescript
class Chart {
    id: string;              // 图表 ID
    name: string;            // 图表名称
    lines: ChartLine[];      // 图表线列表
}
```

### 9.2 ChartLine 类

```typescript
class ChartLine {
    device: string;          // 设备名称
    id: string;              // 标签 ID
    name: string;            // 标签名称
    label: string;           // 线标签
    color: string;           // 颜色
    fill?: string;           // 填充色
    yaxis: number;           // Y 轴（1 或 2）
    lineInterpolation?: number;
    lineWidth?: number;
    spanGaps: boolean = true;
    zones?: ChartLineZone[];
}
```

---

## 10. Report 报表模型 (`report.ts`)

### 10.1 Report 类

```typescript
class Report {
    id: string;              // 报表 ID，前缀 'r_'
    name: string;            // 报表名称
    receiver?: string;       // 接收者
    scheduling: string;      // 调度类型
    docproperty: ReportDocProperty; // 文档属性
    content?: ReportContent; // 报表内容
}
```

### 10.2 ReportSchedulingType 枚举

```typescript
enum ReportSchedulingType {
    none = 'report.scheduling-none',
    day = 'report.scheduling-day',
    week = 'report.scheduling-week',
    month = 'report.scheduling-month'
}
```

---

## 11. ProjectData 项目数据模型 (`project.ts`)

### 11.1 ProjectData 类

```typescript
class ProjectData {
    version: string = '1.01';
    name?: string;           // 项目名称
    server: Device;          // FUXA Server 设备
    hmi: Hmi;                // HMI 资源
    devices = {};            // 设备字典（key=deviceId）
    charts: Chart[] = [];    // 图表列表
    graphs: Graph[] = [];    // 图形列表
    alarms: Alarm[] = [];    // 报警列表
    notifications: Notification[] = []; // 通知列表
    scripts: Script[] = [];  // 脚本列表
    reports: Report[] = [];  // 报表列表
    texts: LanguageText[] = []; // 文本列表
    languages: Languages;    // 语言设置
    plugin: Plugin[] = [];   // 插件列表
    mapsLocations: MapsLocation[] = []; // 地图位置
    clientAccess: ClientAccess; // 客户端访问设置
}
```

### 11.2 ProjectDataCmdType 枚举（API 命令）

**关键**: `POST /api/projectData` 的 `cmd` 参数必须使用以下值。

```typescript
enum ProjectDataCmdType {
    SetDevice = 'set-device',
    DelDevice = 'del-device',
    SetView = 'set-view',
    DelView = 'del-view',
    HmiLayout = 'layout',
    Charts = 'charts',
    Graphs = 'graphs',
    Languages = 'languages',
    ClientAccess = 'client-access',
    SetText = 'set-text',
    DelText = 'del-text',
    SetAlarm = 'set-alarm',
    DelAlarm = 'del-alarm',
    SetNotification = 'set-notification',
    DelNotification = 'del-notification',
    SetScript = 'set-script',
    DelScript = 'del-script',
    SetReport = 'set-report',
    DelReport = 'del-report',
    SetMapsLocation = 'set-maps-location',
    DelMapsLocation = 'del-maps-location'
}
```

**错误示例**: 使用 `'devices'`、`'alarms'`、`'hmi'` 会返回 "Command not found"。

---

## 12. User 用户模型 (`user.ts`)

```typescript
class User {
    username: string;
    password: string;
    fullname: string;
    groups: string[];        // 用户组列表
    roles: string[];         // 角色列表
}
```

---

## 常见错误总结

| 错误 | 正确值 | 说明 |
|------|--------|------|
| `property.unitId` | `property.slaveid` | Modbus 从站 ID 字段名 |
| 语言 `zh` | `zh-cn` | 中文语言代码 |
| cmd `devices` | `set-device` | projectData 命令值 |
| cmd `alarms` | `set-alarm` | projectData 命令值 |
| `memaddress: 'HR40001'` | `memaddress: '400001'` | Modbus 寄存器基数格式 |
| `property.host` | `property.address` | 设备地址字段名 |
| `property.port` (number) | `property.port` (string) | 端口字段类型 |

---

## API 传参示例

### 创建 Modbus TCP 设备

```json
POST /api/projectData
{
  "cmd": "set-device",
  "data": {
    "id": "d_abc123",
    "name": "Modbus PLC",
    "enabled": true,
    "type": "ModbusTCP",
    "polling": 1000,
    "property": {
      "address": "192.168.0.119",
      "port": "502",
      "slaveid": "1"
    },
    "tags": {
      "t_tag1": {
        "id": "t_tag1",
        "name": "温度1#",
        "type": "Float32",
        "memaddress": "400001",
        "address": "1",
        "daq": { "enabled": false, "changed": true, "interval": 60 }
      },
      "t_tag2": {
        "id": "t_tag2",
        "name": "温度2#",
        "type": "Float32",
        "memaddress": "400001",
        "address": "3",
        "daq": { "enabled": false, "changed": true, "interval": 60 }
      }
    }
  }
}
```

### 创建报警

```json
POST /api/projectData
{
  "cmd": "set-alarm",
  "data": {
    "name": "温度过高报警",
    "property": {
      "variableId": "t_tag1"
    },
    "high": {
      "enabled": true,
      "checkdelay": 0,
      "min": 80,
      "max": 100,
      "timedelay": 5,
      "text": "温度超过80°C",
      "group": "温度报警",
      "ackmode": "alarm.ack-active",
      "bkcolor": "#FF0000",
      "color": "#FFFFFF"
    }
  }
}
```

### 设置语言

```json
POST /api/settings
{
  "language": "zh-cn"
}
```

---

## 13. 视图和项目结构模板

### 13.1 视图配置示例

```json
{
  "id": "view-001",
  "name": "主监控画面",
  "svgcontent": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1920\" height=\"1080\"></svg>",
  "items": [
    {
      "id": "item-001",
      "type": "gauge",
      "property": {
        "permission": null,
        "permissionRoles": {
          "show": ["admin", "operator"],
          "enabled": ["admin"]
        }
      },
      "events": []
    }
  ]
}
```

**事件绑定**: events 数组支持类型：`value-change`, `click`, `mouseenter`, `mouseleave` 等。

### 13.2 HMI 布局配置示例

```json
{
  "navigation": {
    "items": [
      {
        "property": {
          "permission": null,
          "permissionRoles": {
            "show": ["admin", "operator"],
            "enabled": ["admin"]
          }
        }
      }
    ]
  },
  "header": {
    "items": [
      {
        "property": {
          "permission": null,
          "permissionRoles": {
            "show": ["admin"],
            "enabled": ["admin"]
          }
        }
      }
    ]
  }
}
```

### 13.3 项目数据结构（SQLite 存储）

项目数据存储在 `project.fuxap.db` 中，表结构如下：

| 表名 | 内容 |
|------|------|
| `general` | 通用设置 (layout, charts, graphs 等) |
| `views` | HMI 视图 (按 view.id 存储) |
| `devices` | 设备配置 |
| `texts` | 文本资源 |
| `alarms` | 报警定义 |
| `notifications` | 通知定义 |
| `scripts` | 脚本定义 |
| `reports` | 报表定义 |
| `locations` | 地图位置 |

**完整项目结构**（`GET /api/project` 返回）：

```typescript
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