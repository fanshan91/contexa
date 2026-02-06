# Contexa SDK HTTP API（移动端/前端对接）

本文档用于 Android / iOS / Web 前端通过 HTTP 对接 Core（apps/web）的 SDK 接口（采集 + 拉取）。

## 1. 基本信息

- Base URL：`https://<your-core-host>`
- API 前缀：`/api/sdk`
- 请求体：`Content-Type: application/json; charset=utf-8`（仅 POST）

## 2. 鉴权：Runtime Token

所有 `/api/sdk/*` 接口都需要项目级 Runtime Token。

### 2.1 获取与管理

- 获取方式不是通过 SDK 接口“自动换取”，而是由项目管理员在 Core 控制台生成后分发给 App（属于敏感凭证）。
- 在 Core 控制台：项目 →「运行时采集与同步」页面创建/更换/启用/禁用，并可直接复制当前令牌。
- 创建/更换令牌时可选择有效期：1 / 3 / 6 个月；到期后接口将返回 401（`Runtime token expired`）。
- 更换 Token 后旧 Token 立即失效。

### 2.2 传递方式

推荐（标准）：

```
Authorization: Bearer <runtime_token>
```

兼容（旧版本）：

```
x-runtime-token: <runtime_token>
```

### 2.3 客户端存储建议

- Android：Keystore / EncryptedSharedPreferences
- iOS：Keychain
- 禁止在日志中打印完整 Token（排障时建议脱敏）

## 3. 统一错误响应（所有接口失败时）

当接口失败（400/401/403/404/500/503）时，返回统一结构：

```json
{
  "ok": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid runtime token",
    "fieldErrors": {
      "projectId": ["projectId is required"]
    }
  }
}
```

### 3.1 error.code 枚举

- `VALIDATION_ERROR`（400）：参数校验失败（通常会携带 `fieldErrors`）
- `UNAUTHORIZED`（401）：缺少或无效 Token / Token 被禁用
- `FORBIDDEN`（403）
- `NOT_FOUND`（404）
- `INTERNAL_ERROR`（500/503）：内部错误或增强服务不可用

### 3.2 处理建议

- 400：不重试，修正参数后重试
- 401：停止请求；提示/触发更新 Token（若 message 为 `Runtime token expired` 表示已到期）
- 503：可重试（指数退避），并允许离线缓冲后补传

## 4. 接口：建立 SDK 会话

### 4.1 POST /api/sdk/session/request

用于声明“当前客户端实例已接入”，服务端会返回 `sessionId`（用于事件上报关联）。

- URL：`POST /api/sdk/session/request`
- Auth：Runtime Token

#### 请求参数

Body（JSON）：

- `projectId`：number，必填
- `instanceId`：string，可选，最长 200
- `env`：`prod | staging | dev`，可选
- `route`：string，可选

#### 成功响应（200）

```json
{
  "ok": true,
  "data": {
    "sessionId": "123",
    "sessionToken": "...",
    "previousSessionToken": "...",
    "expiresAt": 1733376000000
  }
}
```

`sessionToken/previousSessionToken/expiresAt` 可能为空或未下发，客户端需兼容。

#### 失败响应

- 400：`projectId` 缺失或类型不正确
- 401：Token 缺失/无效/被禁用
- 503：增强服务不可用（`error.message` 会包含 `Enhanced unavailable: <reason>`）

#### cURL 示例

```bash
curl -X POST "https://<your-core-host>/api/sdk/session/request" \
  -H "Authorization: Bearer <runtime_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": 1,
    "instanceId": "web:portal",
    "env": "prod",
    "route": "/home"
  }'
```

## 5. 接口：SDK 会话心跳

### 5.1 POST /api/sdk/session/heartbeat

用于维持 SDK 会话的活跃状态。

- URL：`POST /api/sdk/session/heartbeat`
- Auth：Runtime Token

#### 请求参数

Body（JSON）：

- `projectId`：number，必填
- `sessionId`：string，必填
- `route`：string，可选

#### 成功响应（200）

```json
{
  "ok": true,
  "data": {
    "serverTime": 1733376000000,
    "sessionToken": "...",
    "previousSessionToken": "...",
    "expiresAt": 1733376000000
  }
}
```

`sessionToken/previousSessionToken/expiresAt` 可能为空或未下发，客户端需兼容。

## 6. 接口：批量上报采集事件

### 6.1 POST /api/sdk/events/capture

用于批量上报运行时采集到的 `route + i18n key + sourceText`。

- URL：`POST /api/sdk/events/capture`
- Auth：Runtime Token

#### 请求参数

Body（JSON）：

- `projectId`：number，必填
- `sessionId`：string，可选（来自 request 返回）
- `batchId`：string，必填
- `events`：array，必填

events[] 字段：

- `key`：string，必填，长度 1~200（例如 `home.title`）
- `sourceText`：string，必填，长度 1~5000（实际渲染/命中的源文案）
- `timestamp`：number，必填（毫秒时间戳）
- `route`：string，可选（建议传页面路由）
- `env`：string，可选
- `instanceId`：string，可选
- `locale`：string，可选
- `idempotencyKey`：string，可选
- `meta`：any，可选（必须是可 JSON 序列化的对象/数组/标量）

#### 成功响应（200）

```json
{
  "ok": true,
  "data": {
    "saved": true,
    "received": 10
  }
}
```

#### 失败响应

- 400：缺少 `batchId/events/key/sourceText/timestamp` 或格式非法
- 401：Token 缺失/无效/被禁用
- 503：增强服务不可用

#### cURL 示例

```bash
curl -X POST "https://<your-core-host>/api/sdk/events/capture" \
  -H "Authorization: Bearer <runtime_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": 1,
    "sessionId": "123",
    "batchId": "1692000000000",
    "events": [
      {
        "route": "/home",
        "key": "home.title",
        "sourceText": "首页",
        "timestamp": 1733376000000,
        "meta": { "platform": "android", "build": "1.0.0" }
      }
    ]
  }'
```

#### 移动端可靠性建议（强烈建议实现）

- 本地缓冲：在内存或本地队列中去重并合并短时间内重复事件（例如同一 `route+key+sourceText` 仅保留 1 条）
- 批量上报：按 flush 循环发送多条（建议并发 1~4）
- 重试策略：
  - 网络错误 / 5xx / 503：指数退避（例如 1s/2s/4s…）+ 上限次数（例如 5 次）
  - 400：不重试
  - 401：停止重试并提示 Token 失效（需要管理端重新生成/启用 Token）
- 超时：建议连接超时 3s、读写超时 5s（根据业务网络环境调优）
- 幂等/去重：建议客户端按 `route+key+sourceText` 做短窗口去重

## 7. 接口：拉取语言包（运行时翻译数据）

### 7.1 GET /api/sdk/pull

用于运行时拉取指定项目、指定语言的“语言包 JSON”。

- URL：`GET /api/sdk/pull?projectId=<number>&locales=<comma-separated>`
- Auth：Runtime Token

#### 请求参数

Query：

- `projectId`：number，必填
- `locales`：string，必填（逗号分隔，例如 `zh-CN,en-US`）

说明：当 `locale` 为目标语言且该条翻译为空时，服务端会回退返回 `sourceText`。

#### 成功响应（200）

成功时返回结构：

```json
{
  "version": "1733376000000",
  "updatedAt": 1733376000000,
  "locales": {
    "zh-CN": {
      "home.title": "首页"
    },
    "en-US": {
      "home.title": "Home"
    }
  }
}
```

tree/flat 的切换与模板路径来自数据库配置：

- `system_meta.key = project:<projectId>:langpack:shape`，值为 `tree` 时返回 tree，否则 flat
- `system_meta.key = project:<projectId>:langpack:template`，值为 JSON 数组 `string[][]`（每个数组是 key 的路径拆分）

#### 协商缓存（ETag）

- 成功响应会带 `ETag`
- 请求可携带 `If-None-Match`，若未变化返回 304

#### 失败响应

失败时返回统一错误结构：

```json
{ "ok": false, "error": { "code": "UNAUTHORIZED", "message": "..." } }
```

#### cURL 示例

```bash
curl -X GET "https://<your-core-host>/api/sdk/pull?projectId=1&locales=zh-CN,en-US" \
  -H "Authorization: Bearer <runtime_token>"
```

## 8. 推荐调用流程（移动端）

1) App 启动或进入业务主界面

- 调用 `POST /api/sdk/session/request` 获取 `sessionId`

2) 业务运行过程中

- 周期性调用 `POST /api/sdk/session/heartbeat` 维持会话
- 每次命中翻译/渲染文案时调用 `POST /api/sdk/events/capture` 上报（建议缓冲 + 批量 flush）

3) 需要运行时翻译数据

- 调用 `GET /api/sdk/pull` 拉取语言包（建议本地缓存；当 token 失效/401 时应停止并提示更新 token）

## 9. 兼容性与注意事项

- `projectId` 建议统一放 body，便于客户端统一封装
- `meta` 必须可 JSON 序列化；避免传入过大的对象（建议 < 4KB）
- `timestamp` 建议为 UTC 毫秒时间戳
- `pull` 支持 ETag/304，建议结合本地缓存使用

## 10. 附录：实现位置（便于开发联调定位）

- `POST /api/sdk/session/request`：
  - [request/route.ts](file:///Users/nihao/Desktop/project/products/TMS/contexa/apps/web/app/api/sdk/session/request/route.ts)
- `POST /api/sdk/session/heartbeat`：
  - [heartbeat/route.ts](file:///Users/nihao/Desktop/project/products/TMS/contexa/apps/web/app/api/sdk/session/heartbeat/route.ts)
- `POST /api/sdk/events/capture`：
  - [capture/route.ts](file:///Users/nihao/Desktop/project/products/TMS/contexa/apps/web/app/api/sdk/events/capture/route.ts)
- `GET /api/sdk/pull`：
  - [pull/route.ts](file:///Users/nihao/Desktop/project/products/TMS/contexa/apps/web/app/api/sdk/pull/route.ts)
- Token 鉴权：
  - [auth.ts](file:///Users/nihao/Desktop/project/products/TMS/contexa/apps/web/lib/runtime/auth.ts)
