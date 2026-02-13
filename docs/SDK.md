# Contexa SDK HTTP API v2

本文档定义 V2 运行时采集协议。V1 端点已下线，调用旧端点会返回 `410 Gone` + `upgrade_hint`。

## 1. 基本信息

- Base URL: `https://<your-core-host>`
- API 前缀: `/api/sdk/v2`
- 请求体: `application/json`

## 2. 鉴权

所有接口都要求项目级 Runtime Token:

- `Authorization: Bearer <runtime_token>`

## 3. 会话状态

`SessionStatus = 'active' | 'closing' | 'closed' | 'expired'`

系统约束:

- 同一 `projectId` 同时最多 1 个 `active` 会话
- 会话由 SDK 直接打开为 `active`（无审批流）

## 4. 打开会话

### `POST /api/sdk/v2/session/open`

请求:

```json
{
  "projectId": 1,
  "sdkIdentity": "web:portal",
  "env": "prod",
  "route": "/home",
  "locale": "zh-CN",
  "userAgent": "Mozilla/5.0 ..."
}
```

响应:

```json
{
  "ok": true,
  "data": {
    "sessionId": 101,
    "status": "active",
    "startedAt": "2026-02-12T10:00:00.000Z",
    "lastSeenAt": "2026-02-12T10:00:00.000Z"
  }
}
```

## 5. 会话心跳

### `POST /api/sdk/v2/session/heartbeat`

请求:

```json
{
  "projectId": 1,
  "sessionId": 101,
  "sdkIdentity": "web:portal",
  "route": "/home"
}
```

响应:

```json
{
  "ok": true,
  "data": {
    "sessionId": 101,
    "status": "active",
    "serverTime": 1733376000000,
    "lastSeenAt": "2026-02-12T10:00:05.000Z"
  }
}
```

## 6. 查询会话状态

### `GET /api/sdk/v2/session/status?projectId=1&sessionId=101`

响应:

```json
{
  "ok": true,
  "data": {
    "sessionId": 101,
    "status": "active",
    "lastSeenAt": "2026-02-12T10:00:05.000Z",
    "closedAt": null,
    "closeReason": null
  }
}
```

## 7. 批量采集上报

### `POST /api/sdk/v2/capture/batch`

请求:

```json
{
  "projectId": 1,
  "sessionId": 101,
  "sdkIdentity": "web:portal",
  "batchId": "1733376001000",
  "events": [
    {
      "route": "/home",
      "key": "home.title",
      "sourceText": "首页",
      "timestamp": 1733376001000
    }
  ]
}
```

响应:

```json
{
  "ok": true,
  "data": {
    "saved": true,
    "deduped": false,
    "received": 1,
    "requiredSyncCount": 1,
    "requiredSyncBreakdown": {
      "newKey": 1,
      "textChanged": 0
    },
    "session": {
      "collectedUniqueKeys": 123,
      "nearLimit": false,
      "warnUniqueKeys": 8000,
      "hardUniqueKeys": 10000
    }
  }
}
```

## 8. 关闭会话

### `POST /api/sdk/v2/session/close`

请求:

```json
{
  "projectId": 1,
  "sessionId": 101,
  "sdkIdentity": "web:portal",
  "reason": "forced"
}
```

响应:

```json
{
  "ok": true,
  "data": {
    "sessionId": 101,
    "status": "closed",
    "closeReason": "forced",
    "closedAt": "2026-02-12T10:10:00.000Z"
  }
}
```

## 9. 旧端点下线说明

以下端点已下线并返回 `410 Gone`:

- `/api/sdk/session/request`
- `/api/sdk/sessions/request`
- `/api/sdk/sessions/status`
- `/api/sdk/session/heartbeat`
- `/api/sdk/events/capture`
- `/api/sdk/gate/status`
- `/api/runtime/events`

请升级 SDK 到 V2 协议。
