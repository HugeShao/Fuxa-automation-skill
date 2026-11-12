# FUXA 1.3.3 现场实战笔记

> 来源：2026-11 现场项目实证（内网 Armbian 主机 + Docker `fuxa:snap7-1.3.3`，卷 `fuxa_appdata`）。
> 定位：主 `SKILL.md` 覆盖 REST API 的 CRUD；本文件覆盖 **REST API 覆盖不到的 UI/前端/认证/容器层**，以及**直接改工程库的受控流程**。
> 冲突原则：涉及 1.3.3 实际行为的，以本文件为准；操作纪律与字段命名以主文档为准。
> 相关经验包：`经验-fuxa-112-upgrade-snap7`（镜像升级保留 S7）、`经验-fuxa-112-api-demo-build`（API 建工程的 1.3.3 修正）。

---

## 1. 分级红线：REST API 不是万能的

主文档写「禁止直接修改 FUXA 配置文件，所有变更必须通过 REST API」。这在 1.3.3 上**过于绝对**：下面这些需求 REST API 根本没有对应端点或字段，只能直改。按原红线执行会一件都做不了。

| 需求 | 正确通道 | 是否可走 REST API |
|---|---|---|
| 设备 / 标签 / 报警 / 脚本 / 布局 CRUD | `POST /api/projectData` | ✅ 首选 |
| 读写标签值、查 DAQ / 报警历史 | REST API | ✅ 首选 |
| 前端入口注入（UA 跳转、登录遮罩、viewport、PWA） | 改容器内 `client/dist/index.html` | ❌ 无端点 |
| 独立静态页（退出页 / 说明页） | 新增 `client/dist/*.html` | ❌ 无端点 |
| 修复 `property: null` 孤儿控件、清空事件、SVG 物理删除 | 改 `project.fuxap.db` | ❌ API 粒度不够 |
| 视图级 `onopen` 事件结构、`actoptions.params` | 改 `project.fuxap.db` | ⚠️ `set-view` 可写整视图，但需先取全量再回写，易覆盖 |
| `general.clientAccess.scriptSystemFunctions` | 改 `project.fuxap.db` | ⚠️ 有 `client-access` cmd，但实测需确认回填格式 |
| 开认证 / 改 token 有效期 / 建用户 / 改密码 | `mysettings.json` + `users.fuxap.db` | ⚠️ 用户可走 `/api/users`，但首次开启 secure 与改密更稳是离线写 |
| 放宽普通用户 tag 读写权限 | 改容器内 `server/api/command/index.js` | ❌ 原生硬编码 admin-only |

**红线改写为：**
1. **API 能做的，必须走 API**（实时生效、有校验、有日志）。
2. **API 覆盖不到的，走 §2 的「离线受控直改流程」，不得在服务运行、编辑器打开时热改。**
3. 任何写操作前**先导出备份**（老板硬性要求）；任何删除前**先做全库引用扫描**。
4. 主文档说的「内存与文件不一致、需重启」是**真实存在的坑**，但结论应是「停服 + 关编辑器 + 重启 + 强刷」，而不是「禁止」。

---

## 2. 离线受控直改 SOP（必按顺序）

```
1. 备份
   cp -a project.fuxap.db project.fuxap.db.bak_<用途>_<MMDD_HHMM>
   docker cp fuxa:/usr/src/app/FUXA/client/dist/index.html  <卷>/index.html.bak_<...>
2. 盘点差异（不要凭印象删）
   - 下载当前库与「上一个已知良好」备份，逐表逐行 md5 比对
   - 全库扫描待删对象的 id / 名称 / URL 引用
3. 通知用户关闭浏览器里的 FUXA 编辑器并强刷
   ⚠️ 编辑器内存里若还是旧工程，点保存会整视图覆盖数据库直改内容（实证踩过）
4. docker stop fuxa                    # 必须停服，避免内存回写
5. 改库 / 改容器文件 / 换 systemd unit
   - SQLite 改完 VACUUM 可回收空间（4.78MB → 2.60MB 实测）
   - 容器文件用 docker cp（stopped container 也支持）
6. 逐项校验
   - 相对基线：除预期对象外，其余表/行 md5 完全一致
   - 全局关键字残留扫描（含 monitor.html / cookie 名 / 端口 / 视图名）
7. docker start fuxa，等 6~10 秒
8. 真机验证（不要只看文件）
   - 登录、/api/project、页面注入标记、独立视图路由、导航项、tag 读写、CPU
```

**路径速查（Docker 卷部署）：**

| 对象 | 宿主路径 | 容器内路径 |
|---|---|---|
| 工程库 | `/var/lib/docker/volumes/fuxa_appdata/_data/project.fuxap.db` | `server/_appdata/project.fuxap.db` |
| 系统设置 | 同目录 `mysettings.json` | `server/_appdata/mysettings.json` |
| 用户库 | 同目录 `users.fuxap.db` | `server/_appdata/users.fuxap.db` |
| 前端入口 | 容器可写层 | `/usr/src/app/FUXA/client/dist/index.html` |
| tag 权限补丁 | 容器可写层 | `/usr/src/app/FUXA/server/api/command/index.js` |

**工程库是 SQLite**，核心表 `views / general / scripts / devices / alarms / texts / notifications / reports / locations / arMarkers / recipes / devicesSecurity`；多数表结构为 `(name, value)`，`value` 是 JSON 字符串。`layout`、`clientAccess`、`version` 等在 `general` 表里按 `name` 存。

---

## 3. 校验与排错方法（可复用）

- **逐行 md5 比对**：对每个表取 `{主键: md5(其余列)}`，比较 `added / removed / changed`。恢复/删除是否"只动了该动的"，一眼可见。
- **删视图前必查**：`layout.navigation.items[].view`、`layout.start`、所有 `scripts`、所有视图的 `items[].property.events.actparam`，确认没有残留引用。
- **数字 grep 会误伤**：例如搜 `8090` 会命中元素 ID `svg_e8e6d3f2-80904e25`。**必须打印上下文再判断**，不要按数字批量替换。
- **删 SVG 元素**：按 `<g ...>` 深度匹配定位闭合 `</g>`；`match.end()` 已指向 `</g>` 之后，不能再 `index('>')`，否则多删下一个标签开头（实测踩过）。
- **判断绑定是否失效**：看 `item.property.variableId` 并反查 `devices.tags`；**`variableRaw` 是旧名缓存，不能作为依据**。
- **systemd 日志不一定在 journal**：unit 可能写 `StandardOutput=append:/var/log/xxx.log`。排障先 `systemctl cat <unit>` 确认日志去向，别只盯 `journalctl`。
- **服务端日志优先**：「服务能起、一调用就崩」先读服务端日志，再看客户端表象。

---

## 4. 视图与事件机制（源码实证，1.3.3）

### 4.1 切页链路

```
导航项点击 → sidenav.goToPage.emit(viewId) → onGoToPage(viewId)
  → ensureViewLoaded → fuxaview.loadHmi(homeView)
  → 遍历 view.property.events，执行 type === 'onopen' 的动作
```

- `loadHmi` **整页卸载重建**，FUXA **没有运行时 group 容器**，"多视图容器 / 卡片内容绑变量切视图"不存在。所谓「固定参数区 + 切换下层页」只能靠「导航项 + 每页各自平铺同一份面板」实现。
- `onGoToPage` 有守卫：**目标即当前页时不重载，`onopen` 不触发**。
- 导航项结构 `{text, view, icon, image, link, permission, children}`，**没有动作/变量字段**，点导航不能直接写变量。
- 服务端脚本**看不到浏览器当前显示哪个视图**（状态只在前端 `homeView` / `fuxaview.view`）；要让脚本知道当前页，只能在视图 `onopen` 里写变量转达。
- `$setView` 经 `hmiService.onGoTo` 汇入同一 `onGoToPage`。

### 4.2 致命 onopen 坑（手机白屏根因之一）

`loadResolvedHmi` 里遍历 `view.property.events`：

```js
t.property.events.forEach(i => { i.type === 'onopen' && this.onRunScript(i) })
```

**完全不看 `action` 类型**。若 `onopen` 里放 `onSetValue`（`actparam` 是 `"0"`/`"1"`），会被当脚本 id 去查 → `undefined` → `clone(undefined)` → `JSON.parse(undefined)` 抛异常 → 被外层 catch 吞掉 → **该视图所有 onopen 动作从此全部失效**。

> ✅ **铁律：视图级 `onopen` 只能放一条 `action:'onRunScript'`；写变量放进客户端脚本用 `$setTag`。**

### 4.3 其他事件约定

| 项 | 正确值 | 说明 |
|---|---|---|
| 视图级事件位置 | `view.property.events` | **不是** `view.events` |
| 控件事件位置 | `item.property.events` | 显隐在 `item.property.actions` |
| 控件点击 `type` | `click` | 误写 `onopen` 会「点了没反应」（实测 10 个按钮中招） |
| `onRunScript` 事件 | 必须带 `actoptions.params: []` | `onRunScript` 内部读 `actoptions.params`，省略会抛错 |
| 弹窗事件 | `action:'oniframe'`, `actparam:<URL>`, `actoptions:{width,height,left,top,...}` | 用于打开外部页面 |
| `svg-ext-own_ctrl-panel` | `processValue` 按 `viewName` **全等**装载视图 | 属性仅 `viewName / variableId / scaleMode` |
| 孤儿 panel | `property: null` 会让 `loadWatch` 读 `property.viewName` 抛错 | 必须降级为静态组或补 `property`，否则页面白屏 |
| 独立视图路由 | `/view/?name=<视图名>` | **天生无导航栏/顶栏**，比脚本隐藏 DOM 干净；实测 200 |

---

## 5. 客户端脚本 API（1.3.3）

> ⚠️ 主文档的 `fuxa.getTagValue / fuxa.setTagValue / fuxa.log ...` 是 **1.3.1 写法，1.3.3 报 `ReferenceError: fuxa is not defined`**。

| 项 | 1.3.3 实际 |
|---|---|
| 服务端/客户端脚本系统函数 | `$getTag(id)` / `$setTag(id, val)` / `$getTagId(name)` / `$setView(id或name)` |
| 异步 | 均为 async，**必须 `await`**（`evalScript` 把代码包成 `(async()=>{...})()`） |
| `$setTag` 参数 | **必须是 tagId**（如 `t_91578f48-c3c54079`），传中文变量名**静默失败、值不变** |
| 可用全局 | `window / document / navigator / sessionStorage / location` |
| 开关 | `general` 表 `clientAccess` 需含 `{"scriptSystemFunctions":["$getTag","$setTag","$getTagId","$setView"]}`，否则 `window.fuxaScriptAPI` 无函数 |
| 辅助函数 | **不要写成 `async function`**：返回 Promise 后 `.toFixed()` 会抛 TypeError，每周期崩 |
| 仿真设备类型 | 必须 `FuxaServer`，不是 `internal`（`internal` 不被实例化，读写全 null） |

脚本定义结构：`{"id":"s_xxx","name":"...","code":"...","mode":"SERVER|CLIENT","sync":false,"parameters":[],"scheduling":{"mode":"interval","interval":1,"schedules":[]},"permission":0}`。

---

## 6. 认证与权限（1.3.3 实测）

### 6.1 开启登录

- `mysettings.json`：`secureEnabled:true` + `secretCode`(64位hex) + `tokenExpiresIn`（如 `12h`）；静默续期用 `enableRefreshCookieAuth:true` + `refreshTokenExpiresIn`（如 `30d`）。
- 用户存 `users.fuxap.db` 表 `users(username, fullname, password, groups, info)`，`password` 为 **bcrypt**。
- 前端会话在 `sessionStorage.currentUser`（含 token）；refresh cookie 名 `fuxa_refresh`，路径 `/api/refresh`。
- **未登录时 `/api/getTagValue` 返回 401** → 即使 `/view/?name=` 把界面画出来，也点不动、开不了锁。原生 secure 确实能挡住控制能力。
- `POST /api/signin` 实测返回：`{"status":"success","message":"...","data":{"username","fullname","groups","info","token"}}`，**token 在 `data.token`，不是顶层 `token`**。
- ⚠️ `layout.loginonstart` **只对 `/home` 生效**，`/view/?name=` 独立页不弹登录框 → 界面裸露 + 按钮无反应。若同时 `loginoverlaycolor=black`，`/home` 的原生登录框不可取消，普通用户会黑屏。**建议设 `loginonstart:false`，改在 `index.html` 注入全路径登录遮罩**（z-index 盖住原生框，避免两个框）。
- 改密码：界面 admin → 用户 → 双击；或离线 `docker exec fuxa node -e "require('bcryptjs').hashSync(...)"` 后写入 users 库。先备份 users 库。
- 安全边界：`/api/signin` 无失败锁定、HTTP 明文传密码（内网可接受，公网必须 HTTPS）。

### 6.2 groups 是标量位图，不是数组

`1=Viewer 2=Operator 4=Engineer 8=Supervisor 16=Manager 32/64=自定义 128=Administrator`；`ADMINMASK = [-1, 255]`。实测 `admin` 返回 `groups=255`，`operator=2`。

### 6.3 三个反直觉行为

| 现象 | 原因 / 处理 |
|---|---|
| 普通用户画面能画出来但读不到值、按钮无效，前端 401 触发登出→反复弹登录 | `/api/getTagValue` 与 `/api/setTagValue` **原版硬编码 admin-only**（只有 `sourceScriptName` 走脚本权限）。需补丁 `server/api/command/index.js`（实测第 80、124 行）改为「admin 或已登录非 guest」；未登录仍 401 |
| 导航项 `permission: 2`（Operator）反而让 operator **看不到**导航 | 语义与直觉相反；**新加导航项一律填 `0`**，别填组位图 |
| `GET /api/project` 对任何已登录用户返回全工程 JSON（含脚本源码） | FUXA 原生行为，内网可接受，公网需额外隔离 |

权限边界实测：operator 可看画面/切页/读写 tag/看报警列表；不可进 `/lab`、`/api/users`、改工程脚本设备、`alarmack`/`alarmsClear`（仍 admin-only）。主文档/README 里「operator 可确认报警」的示例是**错的**。

---

## 7. 移动端 / PWA / 退出

- **手机自动跳页**：不要用 FUXA 客户端脚本做主跳转（onopen 有 §4.2 的坑），直接在 `dist/index.html` 头部按 `navigator.userAgent` 判断 → `location.replace('/view/?name=' + encodeURIComponent('画面_手机操作'))`。
- **viewport**：FUXA 原有 `targetWidth=768` 会把 375 宽手机页二次缩小；手机 + `/view` 时改成 `targetWidth=window.screen.width`。同时补 `<meta name="viewport">`。
- **PWA**：`manifest.json`（`start_url` 直指手机页、`display:standalone`）+ `icons/icon-192|512.png` + `theme-color`，"添加到主屏幕"后无地址栏。
- **退出浏览器**：**普通网页无法关闭浏览器进程**（Chrome 只允许 `window.close()` 关闭脚本 `window.open` 打开的窗口）。分层处理：先试 `window.close()`（PWA/standalone 有效）→ 450ms 兜底 `location.replace('/exit.html')` 静态"已退出"页。别让退出后回到带导航的 `/home`。
- **退出即清会话**：目前只关界面不退登录，配合 refresh cookie（30d）等于长期免密；多人轮班场景应补"退出即清会话"。
- `exit.html` 是独立静态页，不加载入口脚本，**不需要**设"已退出"标记（设了反而会让同标签再开首页被误判为电脑端）。

---

## 8. 容器可写层补丁的持久化边界

| 操作 | 容器内补丁是否保留 |
|---|---|
| `docker restart fuxa` | ✅ 保留 |
| `docker stop/start` | ✅ 保留 |
| **镜像升级 / 重建容器 / `docker rm`** | ❌ **全丢** |

受影响文件：`client/dist/index.html`（UA 跳转、登录遮罩、PWA）、`client/dist/exit.html`、`server/api/command/index.js`（tag 权限）、`dist/manifest.json`、`dist/icons/*`。

> ✅ **必须把补丁源文件留在工作区并登记清单**；每次重建容器后按清单复打，再跑一次验证。相关经验包 `经验-fuxa-112-upgrade-snap7` 处理镜像升级保留 S7 驱动。

---

## 9. 容量与安全红线（辅助系统不得拖垮安全系统）

在 S905L3a（4 核 A53 @1.9G / 1.9GB / **eth0 仅 100Mbps**）上实测：单路 `H.265 640×360 → MJPEG 8fps` 转码约 **0.4~0.5 个核 / 61MB / 17 线程**。

| 路数 | 结论 |
|---|---|
| 2 | 约 20% 总 CPU，可接受 |
| 8 | CPU 逼近上限 |
| 16 | swap 抖动 |
| 32 | 需 3~4 倍算力、内存 ≈1.95GB > 物理总量 → OOM；百兆口双向 65~95Mbps |

**对门禁的真实威胁链**：Node 事件循环饿死 → 定时上锁脚本定时器漂移；百兆口拥塞 → Modbus TCP 门锁指令超时；OOM killer 可能杀掉 FUXA → HMI 黑屏、门锁按钮全失效。

> ✅ **架构铁律：视频/录像等辅助系统必须与门禁控制物理隔离。** 正解是独立 NVR 或在另一台 x86 上跑 go2rtc / MediaMTX 做 H.265 **直通**（不重编码），FUXA 图标只做跳转；录像存储绝不放 SCADA 盒子。浏览器端也不要做 32 宫格常驻，用 1/4/9 宫格按需切。
> 浏览器**不能原生播 RTSP / H.265**；主文档 `WebCam` 驱动条目不等于「可以在 FUXA 里看 32 路」。

---

## 10. 排障速查

| 症状 | 优先排查 |
|---|---|
| 手机打开白屏 / 控件点了没反应 | ① `property:null` 孤儿 panel ② 视图 `onopen` 里混了 `onSetValue` ③ 控件事件写成 `onopen` 而非 `click` ④ `clientAccess.scriptSystemFunctions` 为空 |
| 视图 onopen 全部失效 | §4.2 的 `clone(undefined)`，改成单条 `onRunScript` |
| `$setTag` 没效果 | 传了中文变量名；改传 tagId |
| 直改库后改动"自己没了" | 编辑器内存覆盖 → 停服 + 关编辑器 + 强刷 |
| 普通用户黑屏 / 反复登录 | `loginonstart=true` + `loginoverlaycolor=black`；tag 读写 admin-only 补丁；导航 `permission` 填错 |
| 关闭弹窗后 CPU 仍高 | 转码进程没回收：空闲判断不能用「最后一帧时间」（永远被刷新），要用「无人观看持续时间」并给 `/snap/` 这类无客户端请求也计时 |
| 服务日志查不到 | unit 可能用 `StandardOutput=append:<文件>`，不在 journal |
| 备份恢复后有多余/缺失对象 | 逐表逐行 md5 比对，别只看文件大小 |

---

## 11. 已知遗留风险（门禁安全，优先于加新功能）

1. **页面/手机关闭后「自动/手动画面切换」会停在最后一次写的值（1=手动）**，服务端脚本一直按手动让位、不自动上锁。FUXA 没有"客户端在线"变量，需另设**心跳变量 + 超时回落**。
2. 手机"退出"只关界面不退登录态。
3. operator 目前能看到并切到「手动操作」页，等于可让系统退出自动上锁；如需限制，需按组控制导航项。
4. 容器可写层补丁在镜像重建时全丢（§8）。

---

## 12. 备份命名约定

`<对象>.bak_<用途>_<MMDD_HHMM>`，例如 `project.fuxap.db.bak_phone_1111_1622`、`index.html.bak_authgate_1111`、`project.fuxap.db.bak_clean1112_0710`。每次写操作前建一份，本地工作区再留一份离线副本。删除功能时保留"加功能前"与"当前含功能"两个快照，便于双向回退。
