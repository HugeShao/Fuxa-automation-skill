/**
 * FUXA CLI - 远程 API 客户端 + 部署/卸载工具
 *
 * 用法：
 *   const { FUXAClient, FUXADeployer } = require('./fuxa-cli');
 *
 *   // 远程管理
 *   const client = new FUXAClient({ url: 'http://192.168.1.100:1881' });
 *   await client.login('admin', 'password');
 *
 *   // 部署/卸载（生成本地 shell 命令）
 *   const deployer = new FUXADeployer({ method: 'docker' });
 *   const cmds = deployer.getDeployCommands();
 *   const uninstallCmds = deployer.getUninstallCommands();
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

// ============================================================
// HTTP 请求封装
// ============================================================

class FUXAHttpError extends Error {
  constructor(statusCode, body, message) {
    super(message || `FUXA API Error ${statusCode}: ${JSON.stringify(body)}`);
    this.statusCode = statusCode;
    this.body = body;
  }
}

function request(method, url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const lib = isHttps ? https : http;

    const body = options.body ? JSON.stringify(options.body) : null;
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options.token ? { 'x-access-token': options.token } : {}),
      ...(options.apiKey ? { 'x-api-key': options.apiKey } : {}),
      ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
    };

    const req = lib.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method,
        headers,
        rejectUnauthorized: false,
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let data;
          try {
            data = JSON.parse(raw);
          } catch {
            data = raw;
          }
          if (res.statusCode >= 400) {
            reject(new FUXAHttpError(res.statusCode, data));
          } else {
            resolve({ status: res.statusCode, data });
          }
        });
      }
    );

    req.on('error', (err) => reject(new FUXAHttpError(0, null, `Network error: ${err.message}`)));
    if (options.timeout) {
      req.setTimeout(options.timeout, () => {
        req.destroy();
        reject(new FUXAHttpError(0, null, `Request timeout after ${options.timeout}ms`));
      });
    }
    if (body) req.write(body);
    req.end();
  });
}

// ============================================================
// FUXA Client
// ============================================================

class FUXAClient {
  /**
   * @param {object} config
   * @param {string} config.url       - FUXA 服务器地址，如 http://192.168.1.100:1881
   * @param {string} [config.username] - 用户名
   * @param {string} [config.password] - 密码
   * @param {string} [config.apiKey]   - API Key（替代用户名密码）
   * @param {number} [config.timeout]  - 请求超时 ms，默认 30000
   */
  constructor(config = {}) {
    this.url = config.url ? config.url.replace(/\/+$/, '') : 'http://localhost:1881';
    this.username = config.username || '';
    this.password = config.password || '';
    this.apiKey = config.apiKey || '';
    this.timeout = config.timeout || 30000;
    this.token = '';
  }

  // --- 内部请求方法 ---

  async _request(method, path, body = null) {
    const url = `${this.url}${path}`;
    return request(method, url, {
      body: body || undefined,
      token: this.token || undefined,
      apiKey: this.apiKey || undefined,
      timeout: this.timeout,
    });
  }

  async _get(path) {
    const res = await this._request('GET', path);
    return res.data;
  }

  async _post(path, body) {
    const res = await this._request('POST', path, body);
    return res.data;
  }

  async _delete(path) {
    const res = await this._request('DELETE', path);
    return res.data;
  }

  // ============================================================
  // 1. 认证 (Auth)
  // ============================================================

  /**
   * 登录获取 JWT Token
   * @returns {{ username, fullname, groups, token }}
   */
  async login(username, password) {
    username = username || this.username;
    password = password || this.password;
    if (!username || !password) {
      throw new Error('需要提供用户名和密码');
    }
    const res = await this._post('/api/signin', { username, password });
    if (res && res.token) {
      this.token = res.token;
    }
    return res;
  }

  /** 刷新 Token */
  async refreshToken() {
    const res = await this._post('/api/heartbeat', {});
    if (res && res.token) {
      this.token = res.token;
    }
    return res;
  }

  /** 登出 */
  async logout() {
    await this._post('/api/signout', {});
    this.token = '';
  }

  // ============================================================
  // 2. 系统设置 (Settings)
  // ============================================================

  /** 获取系统设置（脱敏） */
  async getSettings() {
    return this._get('/api/settings');
  }

  /** 更新系统设置 */
  async updateSettings(settings) {
    return this._post('/api/settings', settings);
  }

  /** 获取版本号 */
  async getVersion() {
    return this._get('/api/version');
  }

  // ============================================================
  // 3. 项目数据 (Project)
  // ============================================================

  /** 获取完整项目数据 */
  async getProject() {
    return this._get('/api/project');
  }

  /** 设置完整项目数据 */
  async setProject(projectData) {
    return this._post('/api/project', projectData);
  }

  /** 更新项目部分数据
   *  支持的 cmd（来自 FUXA 源码 ProjectDataCmdType）：
   *  'set-device' | 'del-device' | 'set-view' | 'del-view' | 'layout' |
   *  'charts' | 'graphs' | 'languages' | 'client-access' |
   *  'set-text' | 'del-text' | 'set-alarm' | 'del-alarm' |
   *  'set-notification' | 'del-notification' | 'set-script' | 'del-script' |
   *  'set-report' | 'del-report' | 'set-maps-location' | 'del-maps-location'
   */
  async updateProjectData(cmd, data) {
    return this._post('/api/projectData', { cmd, data });
  }

  /** 获取演示项目 */
  async getDemoProject() {
    return this._get('/api/projectdemo');
  }

  // ============================================================
  // 4. 设备管理 (Devices)
  // ============================================================

  /** 获取所有设备（返回对象，key 为设备 id） */
  async getDevices() {
    const project = await this.getProject();
    return project.devices || {};
  }

  /** 获取单个设备详情 */
  async getDevice(deviceId) {
    const devices = await this.getDevices();
    return devices[deviceId] || null;
  }

  /** 创建/更新设备（单个） */
  async setDevice(deviceParams) {
    return this.updateProjectData('set-device', deviceParams);
  }

  /** 删除设备 */
  async removeDevice(deviceId) {
    return this.updateProjectData('del-device', { id: deviceId });
  }

  /** 获取设备连接状态
   *  状态值含义（ConnectionStatusEnum）：
   *  0 = 离线（OFF），3 = 警告（WARNING），5 = 在线（ON）
   *  连接状态标签存储在 FUXA Server（id='0'）的系统标签中
   *  sysType=1（TagSystemType.deviceConnectionStatus），memaddress=设备ID
   */
  async getDeviceConnectionStatus(deviceId) {
    // FUXA Server 的连接状态标签 sysType=1，memaddress=目标设备ID
    const project = await this.getProject();
    const fuxaServer = project.devices?.['0'];
    if (!fuxaServer || !fuxaServer.tags) {
      return null;
    }
    // 找到目标设备的连接状态标签
    const connTag = Object.values(fuxaServer.tags).find(
      tag => tag.sysType === 1 && tag.memaddress === deviceId
    );
    if (!connTag) {
      return null;
    }
    // 读取该标签的值
    const values = await this.getTagValue([connTag.id]);
    if (values && values[0]) {
      return {
        deviceId,
        deviceName: connTag.name.replace(' Connection Status', ''),
        status: values[0].value,
        statusText: values[0].value === 0 ? '离线' :
                    values[0].value === 3 ? '警告' :
                    values[0].value === 5 ? '在线' : '未知',
        timestamp: values[0].ts
      };
    }
    return null;
  }

  /** 获取所有设备的连接状态
   *  返回格式：[{ deviceId, deviceName, status, statusText }]
   */
  async getAllDeviceConnectionStatus() {
    const project = await this.getProject();
    const fuxaServer = project.devices?.['0'];
    if (!fuxaServer || !fuxaServer.tags) {
      return [];
    }
    // 找到所有连接状态标签
    const connTags = Object.values(fuxaServer.tags).filter(
      tag => tag.sysType === 1
    );
    if (connTags.length === 0) {
      return [];
    }
    // 批量读取所有连接状态标签的值
    const tagIds = connTags.map(tag => tag.id);
    const values = await this.getTagValue(tagIds);
    const statusMap = {};
    if (values) {
      for (const v of values) {
        statusMap[v.id] = v.value;
      }
    }
    // 组装结果
    return connTags.map(tag => ({
      deviceId: tag.memaddress,
      deviceName: tag.name.replace(' Connection Status', ''),
      status: statusMap[tag.id],
      statusText: statusMap[tag.id] === 0 ? '离线' :
                  statusMap[tag.id] === 3 ? '警告' :
                  statusMap[tag.id] === 5 ? '在线' : '未知'
    }));
  }

  // ============================================================
  // 5. 标签操作 (Tags)
  // ============================================================

  /** 读取标签值 */
  async getTagValue(tagIds) {
    // tagIds: string[]
    return this._get(`/api/getTagValue?ids=${encodeURIComponent(JSON.stringify(tagIds))}`);
  }

  /** 写入标签值 */
  async setTagValue(tags) {
    // tags: [{ id, value }]
    return this._post('/api/setTagValue', { tags });
  }

  // ============================================================
  // 6. 报警管理 (Alarms)
  // ============================================================

  /** 获取当前报警列表 */
  async getAlarms(filter) {
    const query = filter ? `?filter=${encodeURIComponent(JSON.stringify(filter))}` : '';
    return this._get(`/api/alarms${query}`);
  }

  /** 获取报警历史 */
  async getAlarmsHistory(start, end, filter) {
    const params = new URLSearchParams();
    if (start) params.set('start', start);
    if (end) params.set('end', end);
    if (filter) params.set('filter', JSON.stringify(filter));
    return this._get(`/api/alarmsHistory?${params.toString()}`);
  }

  /** 确认报警 */
  async ackAlarm(alarmId) {
    return this._post('/api/alarmack', { params: alarmId });
  }

  /** 清除报警 */
  async clearAlarms() {
    return this._post('/api/alarmsClear', { params: {} });
  }

  /** 获取报警定义 */
  async getAlarmDefinitions() {
    const project = await this.getProject();
    return project.alarms || [];
  }

  /** 添加/更新单个报警定义 */
  async setAlarmDefinition(alarm) {
    return this.updateProjectData('set-alarm', alarm);
  }

  /** 删除单个报警定义 */
  async removeAlarmDefinition(alarmName) {
    return this.updateProjectData('del-alarm', { name: alarmName });
  }

  // ============================================================
  // 7. 通知管理 (Notifications)
  // ============================================================

  /** 获取通知定义 */
  async getNotifications() {
    const project = await this.getProject();
    return project.notifications || [];
  }

  /** 添加/更新单个通知 */
  async setNotification(notification) {
    return this.updateProjectData('set-notification', notification);
  }

  /** 删除单个通知 */
  async removeNotification(notificationId) {
    return this.updateProjectData('del-notification', { id: notificationId });
  }

  // ============================================================
  // 8. 视图管理 (Views)
  // ============================================================

  /** 获取所有视图 */
  async getViews() {
    const project = await this.getProject();
    return (project.hmi && project.hmi.views) || [];
  }

  /** 添加/更新单个视图 */
  async setView(view) {
    return this.updateProjectData('set-view', view);
  }

  /** 删除单个视图 */
  async removeView(viewId) {
    return this.updateProjectData('del-view', { id: viewId });
  }

  /** 获取布局 */
  async getLayout() {
    const project = await this.getProject();
    return (project.hmi && project.hmi.layout) || {};
  }

  /** 设置布局 */
  async setLayout(layout) {
    return this.updateProjectData('layout', layout);
  }

  // ============================================================
  // 9. 脚本管理 (Scripts)
  // ============================================================

  /** 获取所有脚本 */
  async getScripts() {
    const project = await this.getProject();
    return project.scripts || [];
  }

  /** 添加/更新单个脚本 */
  async setScript(script) {
    return this.updateProjectData('set-script', script);
  }

  /** 删除单个脚本 */
  async removeScript(scriptName) {
    return this.updateProjectData('del-script', { name: scriptName });
  }

  /** 执行脚本 */
  async runScript(script, toLogEvent) {
    // script: { id?, name, content, test? }
    return this._post('/api/runscript', { params: { script }, toLogEvent });
  }

  /** 执行系统函数 */
  async runSysFunction(functionName, parameters) {
    return this._post('/api/runSysFunction', { params: { functionName, parameters } });
  }

  // ============================================================
  // 10. DAQ 历史数据 (DAQ)
  // ============================================================

  /** 查询历史数据 */
  async getDaqData(from, to, tagIds) {
    // from/to: ISO date string, tagIds: string[]
    const query = { from, to, sids: tagIds };
    return this._get(`/api/daq?query=${encodeURIComponent(JSON.stringify(query))}`);
  }

  // ============================================================
  // 11. 用户管理 (Users)
  // ============================================================

  /** 获取用户列表 */
  async getUsers() {
    return this._get('/api/users');
  }

  /** 创建/更新用户 */
  async setUsers(users) {
    // users: [{ username, password, fullname, groups, info }]
    return this._post('/api/users', { params: users });
  }

  /** 删除用户 */
  async deleteUser(username) {
    return this._delete(`/api/users?param=${encodeURIComponent(username)}`);
  }

  /** 获取角色列表 */
  async getRoles() {
    return this._get('/api/roles');
  }

  /** 创建/更新角色 */
  async setRoles(roles) {
    return this._post('/api/roles', { params: roles });
  }

  /** 删除角色 */
  async deleteRoles(roleNames) {
    return this._delete(`/api/roles?roles=${encodeURIComponent(JSON.stringify(roleNames))}`);
  }

  // ============================================================
  // 12. API Key 管理
  // ============================================================

  /** 获取 API Key 列表 */
  async getApiKeys() {
    return this._get('/api/apikeys');
  }

  /** 创建/更新 API Key */
  async setApiKeys(apiKeys) {
    return this._post('/api/apikeys', { params: apiKeys });
  }

  /** 删除 API Key */
  async deleteApiKeys(keyIds) {
    return this._delete(`/api/apikeys?apikeys=${encodeURIComponent(JSON.stringify(keyIds))}`);
  }

  // ============================================================
  // 13. 调度器 (Scheduler)
  // ============================================================

  /** 获取调度器 */
  async getScheduler(schedulerId) {
    return this._get(`/api/scheduler?id=${encodeURIComponent(schedulerId)}`);
  }

  /** 设置调度器 */
  async setScheduler(schedulerId, data) {
    return this._post('/api/scheduler', { id: schedulerId, data });
  }

  /** 删除调度器 */
  async deleteScheduler(schedulerId) {
    return this._delete(`/api/scheduler?id=${encodeURIComponent(schedulerId)}`);
  }

  // ============================================================
  // 14. 资源管理 (Resources)
  // ============================================================

  /** 获取图片列表 */
  async getImages() {
    return this._get('/api/resources/images');
  }

  /** 获取资源列表 */
  async getResources() {
    return this._get('/api/resources/resources');
  }

  /** 上传文件 */
  async upload(resource, destination) {
    // resource: { name, data, type, fullPath }
    return this._post('/api/upload', { resource, destination });
  }

  /** 删除资源 */
  async removeResource(filename) {
    return this._post('/api/resources/remove', { file: filename });
  }

  /** 获取模板列表 */
  async getTemplates() {
    return this._get('/api/resources/templates');
  }

  /** 保存模板 */
  async setTemplate(template) {
    return this._post('/api/resources/template', { template });
  }

  /** 获取 Widget 列表 */
  async getWidgets() {
    return this._get('/api/resources/widgets');
  }

  // ============================================================
  // 15. 报表 (Reports)
  // ============================================================

  /** 查询报表 */
  async queryReports(query) {
    return this._get(`/api/reportsQuery?query=${encodeURIComponent(JSON.stringify(query))}`);
  }

  /** 生成报表 */
  async buildReport(reportConfig) {
    return this._post('/api/reportBuild', { params: reportConfig });
  }

  /** 删除报表文件 */
  async removeReport(fileName) {
    return this._post('/api/reportRemoveFile', { params: { fileName } });
  }

  // ============================================================
  // 16. 诊断/日志 (Diagnose)
  // ============================================================

  /** 获取日志文件列表 */
  async getLogFiles() {
    return this._get('/api/logsdir');
  }

  /** 获取日志内容 */
  async getLogContent(filename) {
    return this._get(`/api/logs?file=${encodeURIComponent(filename)}`);
  }

  /** 发送测试邮件 */
  async sendTestMail(smtp, msg) {
    return this._post('/api/sendmail', { params: { smtp, msg } });
  }

  // ============================================================
  // 17. 插件 (Plugins)
  // ============================================================

  /** 获取插件列表 */
  async getPlugins() {
    return this._get('/api/plugins');
  }

  /** 安装插件 */
  async installPlugin(pluginInfo) {
    return this._post('/api/plugins', { params: pluginInfo });
  }

  /** 卸载插件 */
  async uninstallPlugin(pluginId) {
    return this._delete(`/api/plugins?param=${encodeURIComponent(pluginId)}`);
  }
}

// ============================================================
// FUXA 本地部署/卸载工具（在 FUXAClient 类定义之后）
// ============================================================

/**
 * FUXA 本地部署与卸载
 * 支持 3 种部署方式：docker / source / npm
 * 生成 shell 命令，由 Claude 通过 Bash 工具在本地执行
 *
 * @param {object} config
 * @param {'docker'|'source'|'npm'} config.method    - 部署方式
 * @param {number} [config.port=1881]                  - 服务端口
 * @param {string} [config.sourceDir]                  - 源码目录（source 方式）
 * @param {string} [config.containerName='fuxa']       - Docker 容器名
 * @param {string} [config.imageName='frangoteam/fuxa'] - Docker 镜像
 * @param {string} [config.imageTag='latest']          - 镜像标签
 * @param {boolean} [config.withODBC=false]            - Docker 构建时含 ODBC
 * @param {boolean} [config.withSnap7=false]           - Docker 构建时含 Snap7
 * @param {string} [config.dataDir]                    - 数据持久化目录
 * @param {boolean} [config.persist=true]              - 是否持久化数据
 * @param {string} [config.repoUrl]                    - Git 仓库地址
 * @param {string} [config.branch='main']              - Git 分支
 */
class FUXADeployer {
  constructor(config = {}) {
    this.method = config.method || 'docker';
    this.port = config.port || 1881;
    this.sourceDir = config.sourceDir || '';
    this.containerName = config.containerName || 'fuxa';
    this.imageName = config.imageName || 'frangoteam/fuxa';
    this.imageTag = config.imageTag || 'latest';
    this.withODBC = config.withODBC || false;
    this.withSnap7 = config.withSnap7 || false;
    this.dataDir = config.dataDir || '';
    this.persist = config.persist !== false;
    this.repoUrl = config.repoUrl || 'https://github.com/frangoteam/FUXA.git';
    this.branch = config.branch || 'main';
  }

  // ============================================================
  // 部署命令
  // ============================================================

  /**
   * 返回部署命令列表（按顺序执行）
   * @returns {{ desc: string, cmd: string }[]}
   */
  deployCommands() {
    switch (this.method) {
      case 'docker':    return this._deployDocker();
      case 'source':    return this._deploySource();
      case 'npm':       return this._deployNpm();
      default: throw new Error(`不支持的部署方式: ${this.method}，可选: docker / source / npm`);
    }
  }

  /**
   * 返回卸载命令列表（按顺序执行）
   * @returns {{ desc: string, cmd: string }[]}
   */
  uninstallCommands() {
    switch (this.method) {
      case 'docker':    return this._uninstallDocker();
      case 'source':    return this._uninstallSource();
      case 'npm':       return this._uninstallNpm();
      default: throw new Error(`不支持的部署方式: ${this.method}`);
    }
  }

  /**
   * 返回更新/升级命令列表（按顺序执行）
   * Docker: 拉取新镜像 + 重启容器（数据在 volume 中不会丢失）
   * Source: git pull + npm install + npm build + 重启进程
   * NPM: npm update -g + 重启进程
   * @returns {{ desc: string, cmd: string }[]}
   */
  updateCommands() {
    switch (this.method) {
      case 'docker':    return this._updateDocker();
      case 'source':    return this._updateSource();
      case 'npm':       return this._updateNpm();
      default: throw new Error(`不支持的部署方式: ${this.method}`);
    }
  }

  /**
   * 返回状态检查命令
   * @returns {{ desc: string, cmd: string }[]}
   */
  statusCommands() {
    switch (this.method) {
      case 'docker': return this._statusDocker();
      case 'source': return this._statusSource();
      case 'npm':    return this._statusNpm();
      default:       return [];
    }
  }

  // ---- Docker 部署 ----

  _deployDocker() {
    const tag = `${this.imageName}:${this.imageTag}`;
    const cmds = [];

    // 1. 拉取镜像
    cmds.push({ desc: '拉取 FUXA Docker 镜像', cmd: `docker pull ${tag}` });

    // 2. 如果有本地 Dockerfile 且指定了 sourceDir，走本地构建
    if (this.sourceDir) {
      let buildCmd = `docker build -t ${this.imageName}:${this.imageTag}`;
      const buildArgs = [];
      if (this.withODBC)  buildArgs.push('--build-arg INSTALL_ODBC=true');
      if (this.withSnap7) buildArgs.push('--build-arg NODE_SNAP=true');
      if (buildArgs.length) buildCmd += ' ' + buildArgs.join(' ');
      buildCmd += ` ${this.sourceDir}`;
      cmds.push({ desc: '从本地源码构建 Docker 镜像', cmd: buildCmd });
    }

    // 3. 停止并移除旧容器（如果存在）
    cmds.push({ desc: '移除旧容器（如存在）', cmd: `docker rm -f ${this.containerName} 2>/dev/null || true` });

    // 4. 运行容器
    let runCmd = `docker run -d --name ${this.containerName}`;
    runCmd += ` -p ${this.port}:1881`;

    if (this.persist) {
      const base = this.dataDir || 'fuxa';
      runCmd += ` -v ${base}_appdata:/usr/src/app/FUXA/server/_appdata`;
      runCmd += ` -v ${base}_db:/usr/src/app/FUXA/server/_db`;
      runCmd += ` -v ${base}_logs:/usr/src/app/FUXA/server/_logs`;
      runCmd += ` -v ${base}_images:/usr/src/app/FUXA/server/_images`;
    }

    runCmd += ` --restart unless-stopped`;
    runCmd += ` ${tag}`;
    cmds.push({ desc: '启动 FUXA 容器', cmd: runCmd });

    return cmds;
  }

  _uninstallDocker() {
    const tag = `${this.imageName}:${this.imageTag}`;
    const cmds = [];

    cmds.push({ desc: '停止 FUXA 容器', cmd: `docker stop ${this.containerName}` });
    cmds.push({ desc: '删除 FUXA 容器', cmd: `docker rm ${this.containerName}` });
    cmds.push({ desc: '删除 FUXA 镜像', cmd: `docker rmi ${tag}` });

    if (this.persist) {
      const base = this.dataDir || 'fuxa';
      cmds.push({
        desc: '删除持久化数据卷（谨慎！）',
        cmd: `docker volume rm ${base}_appdata ${base}_db ${base}_logs ${base}_images 2>/dev/null || true`,
        warning: '此操作将永久删除所有 FUXA 配置和历史数据，不可恢复！'
      });
    }

    return cmds;
  }

  _statusDocker() {
    return [
      { desc: '检查容器运行状态', cmd: `docker ps -a --filter name=${this.containerName} --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"` },
      { desc: '检查镜像', cmd: `docker images ${this.imageName} --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"` },
      { desc: '检查数据卷', cmd: `docker volume ls --filter name=fuxa` },
    ];
  }

  _updateDocker() {
    const tag = `${this.imageName}:${this.imageTag}`;
    const cmds = [];

    // 1. 拉取最新镜像
    cmds.push({ desc: '拉取最新 FUXA Docker 镜像', cmd: `docker pull ${tag}` });

    // 2. 如果有本地 Dockerfile 且指定了 sourceDir，走本地构建
    if (this.sourceDir) {
      let buildCmd = `docker build -t ${this.imageName}:${this.imageTag}`;
      const buildArgs = [];
      if (this.withODBC)  buildArgs.push('--build-arg INSTALL_ODBC=true');
      if (this.withSnap7) buildArgs.push('--build-arg NODE_SNAP=true');
      if (buildArgs.length) buildCmd += ' ' + buildArgs.join(' ');
      buildCmd += ` ${this.sourceDir}`;
      cmds.push({ desc: '从本地源码构建 Docker 镜像', cmd: buildCmd });
    }

    // 3. 停止旧容器
    cmds.push({ desc: '停止当前 FUXA 容器', cmd: `docker stop ${this.containerName}` });

    // 4. 移除旧容器（数据卷不会丢失）
    cmds.push({ desc: '移除旧容器（数据卷保留）', cmd: `docker rm ${this.containerName}` });

    // 5. 启动新容器（使用最新镜像，挂载原有数据卷）
    let runCmd = `docker run -d --name ${this.containerName}`;
    runCmd += ` -p ${this.port}:1881`;

    if (this.persist) {
      const base = this.dataDir || 'fuxa';
      runCmd += ` -v ${base}_appdata:/usr/src/app/FUXA/server/_appdata`;
      runCmd += ` -v ${base}_db:/usr/src/app/FUXA/server/_db`;
      runCmd += ` -v ${base}_logs:/usr/src/app/FUXA/server/_logs`;
      runCmd += ` -v ${base}_images:/usr/src/app/FUXA/server/_images`;
    }

    runCmd += ` --restart unless-stopped`;
    runCmd += ` ${tag}`;
    cmds.push({ desc: '启动新版 FUXA 容器', cmd: runCmd });

    // 6. 清理旧镜像（可选）
    cmds.push({ desc: '清理无用镜像', cmd: `docker image prune -f` });

    return cmds;
  }

  // ---- 源码部署 ----

  _deploySource() {
    const dir = this.sourceDir || './FUXA';
    const cmds = [];

    // 1. 克隆仓库（如果目录不存在）
    cmds.push({ desc: '克隆 FUXA 源码', cmd: `if [ ! -d "${dir}" ]; then git clone -b ${this.branch} ${this.repoUrl} ${dir}; else echo "目录已存在，跳过克隆"; fi` });

    // 2. 安装服务端依赖
    cmds.push({ desc: '安装服务端依赖', cmd: `cd ${dir}/server && npm install --no-audit --no-fund` });

    // 3. 构建服务端（TypeScript）
    cmds.push({ desc: '编译服务端代码', cmd: `cd ${dir}/server && npm run build` });

    // 4. 安装前端依赖 + 构建
    cmds.push({ desc: '安装前端依赖', cmd: `cd ${dir}/client && npm install --no-audit --no-fund` });
    cmds.push({ desc: '构建前端', cmd: `cd ${dir}/client && npm run build -- --configuration production` });

    // 5. 启动服务（后台）
    cmds.push({
      desc: '启动 FUXA 服务（后台）',
      cmd: `cd ${dir}/server && nohup node main.js > ../fuxa.log 2>&1 & echo "PID: $!"`
    });

    return cmds;
  }

  _uninstallSource() {
    const dir = this.sourceDir || './FUXA';
    const cmds = [];

    cmds.push({ desc: '停止 FUXA 进程', cmd: `pkill -f "node.*FUXA/server/main.js" || true` });
    cmds.push({
      desc: '删除源码目录',
      cmd: `rm -rf ${dir}`,
      warning: '此操作将永久删除所有 FUXA 源码和本地数据！'
    });

    return cmds;
  }

  _statusSource() {
    const dir = this.sourceDir || './FUXA';
    return [
      { desc: '检查 FUXA 进程', cmd: `ps aux | grep "node.*FUXA/server/main.js" | grep -v grep || echo "FUXA 未运行"` },
      { desc: '检查端口监听', cmd: `netstat -tlnp 2>/dev/null | grep :${this.port} || ss -tlnp | grep :${this.port} || echo "端口 ${this.port} 未被监听"` },
      { desc: '检查源码目录', cmd: `ls -la ${dir}/server/main.js 2>/dev/null || echo "源码目录不存在"` },
    ];
  }

  _updateSource() {
    const dir = this.sourceDir || './FUXA';
    const cmds = [];

    // 1. 拉取最新代码
    cmds.push({ desc: '拉取最新 FUXA 源码', cmd: `cd ${dir} && git fetch origin && git pull origin ${this.branch}` });

    // 2. 更新服务端依赖
    cmds.push({ desc: '更新服务端依赖', cmd: `cd ${dir}/server && npm install --no-audit --no-fund` });

    // 3. 重新构建服务端
    cmds.push({ desc: '编译服务端代码', cmd: `cd ${dir}/server && npm run build` });

    // 4. 更新前端依赖 + 重新构建
    cmds.push({ desc: '更新前端依赖', cmd: `cd ${dir}/client && npm install --no-audit --no-fund` });
    cmds.push({ desc: '构建前端', cmd: `cd ${dir}/client && npm run build -- --configuration production` });

    // 5. 重启服务（先停后启）
    cmds.push({ desc: '停止 FUXA 进程', cmd: `pkill -f "node.*FUXA/server/main.js" || true` });
    cmds.push({
      desc: '启动新版 FUXA 服务',
      cmd: `cd ${dir}/server && nohup node main.js > ../fuxa.log 2>&1 & echo "PID: $!"`
    });

    return cmds;
  }

  // ---- NPM 全局安装 ----

  _deployNpm() {
    const cmds = [];

    cmds.push({ desc: '全局安装 FUXA', cmd: `npm install -g --unsafe-perm @frangoteam/fuxa` });
    cmds.push({
      desc: '启动 FUXA（后台）',
      cmd: `nohup fuxa > fuxa.log 2>&1 & echo "PID: $!"`
    });

    return cmds;
  }

  _uninstallNpm() {
    const cmds = [];

    cmds.push({ desc: '停止 FUXA 进程', cmd: `pkill -f "fuxa" || true` });
    cmds.push({ desc: '卸载 FUXA 全局包', cmd: `npm uninstall -g @frangoteam/fuxa` });

    return cmds;
  }

  _statusNpm() {
    return [
      { desc: '检查 FUXA 全局包', cmd: `npm list -g @frangoteam/fuxa 2>/dev/null || echo "FUXA 未全局安装"` },
      { desc: '检查 FUXA 进程', cmd: `ps aux | grep "fuxa" | grep -v grep || echo "FUXA 未运行"` },
      { desc: '检查端口监听', cmd: `netstat -tlnp 2>/dev/null | grep :${this.port} || ss -tlnp | grep :${this.port} || echo "端口 ${this.port} 未被监听"` },
    ];
  }

  _updateNpm() {
    const cmds = [];

    // 1. 更新全局包
    cmds.push({ desc: '更新 FUXA 全局包', cmd: `npm update -g --unsafe-perm @frangoteam/fuxa` });

    // 2. 重启服务（先停后启）
    cmds.push({ desc: '停止 FUXA 进程', cmd: `pkill -f "fuxa" || true` });
    cmds.push({
      desc: '启动新版 FUXA',
      cmd: `nohup fuxa > fuxa.log 2>&1 & echo "PID: $!"`
    });

    return cmds;
  }

  // ============================================================
  // 快捷方法：生成 docker-compose.yml 内容
  // ============================================================

  /**
   * 生成 docker-compose.yml
   * @returns {string}
   */
  dockerComposeYml() {
    const base = this.dataDir || 'fuxa';
    return `version: "3.8"
services:
  fuxa:
    image: ${this.imageName}:${this.imageTag}
    container_name: ${this.containerName}
    ports:
      - "${this.port}:1881"
    volumes:
      - ${base}_appdata:/usr/src/app/FUXA/server/_appdata
      - ${base}_db:/usr/src/app/FUXA/server/_db
      - ${base}_logs:/usr/src/app/FUXA/server/_logs
      - ${base}_images:/usr/src/app/FUXA/server/_images
    restart: unless-stopped

volumes:
  ${base}_appdata:
  ${base}_db:
  ${base}_logs:
  ${base}_images:
`;
  }
}

// ============================================================
// 导出
// ============================================================

module.exports = { FUXAClient, FUXAHttpError, FUXADeployer };
