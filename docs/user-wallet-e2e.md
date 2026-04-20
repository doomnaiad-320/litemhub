# 用户钱包 MVP 联调文档

本文档用于联调当前最小后端闭环：

`注册 -> 登录 -> 管理员充值 -> 获取可选 group -> 创建 key -> 调模型 -> 查看余额与流水`

> 当前阶段还没有接入真实支付网关。
> 充值这一步先使用管理员手工充值接口。
> 后续你提供支付接口后，再把这一步替换成真实支付回调。

## 1. 前置条件

- 使用 SQLite 启动后端
- 管理员 Key 固定使用：`aszw1233`
- 当前系统内至少存在一个：
  - `status = enabled` 的 group
  - 该 group 有可用模型
  - 该 group 配置了 `price_multiplier`

## 2. 启动后端

在项目根目录执行：

```bash
cd core

ADMIN_KEY=aszw1233 \
USER_JWT_SECRET=aszw1233-user-jwt \
SQLITE_PATH=../aiproxy.db \
LISTEN=127.0.0.1:3000 \
go run .
```

启动后默认接口地址：

- 后端：`http://127.0.0.1:3000`
- Swagger：`http://127.0.0.1:3000/swagger/index.html`

## 3. 准备环境变量

另开一个终端：

```bash
export BASE_URL=http://127.0.0.1:3000
export ADMIN_KEY=aszw1233
```

如果本机安装了 `jq`，下面命令可以直接复制执行。

### 3.1 本地 fake 联调数据

如果当前 SQLite 里还没有真实上游，可以先用内置 `fake` 渠道跑通钱包扣费链路。

> 注意：`/api/model_config/{model}` 的价格字段必须放在 `price` 对象里。
> 例如应使用 `price.input_price`，不要把 `input_price` 放在顶层。

写入 `fake-chat` 模型价格：

```bash
curl -sS -X POST "$BASE_URL/api/model_config/fake-chat" \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "owner": "fake",
    "type": 1,
    "price": {
      "input_price": 1,
      "input_price_unit": 1000,
      "output_price": 2,
      "output_price_unit": 1000
    },
    "config": {
      "max_context_tokens": 8192,
      "max_output_tokens": 1024
    }
  }' | jq
```

创建本地 fake 渠道：

```bash
curl -sS -X POST "$BASE_URL/api/channel/" \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "type": 53,
    "name": "fake-wallet-channel",
    "key": "fake-key",
    "base_url": "https://fake.local/v1",
    "models": ["fake-chat"],
    "status": 1,
    "priority": 100,
    "sets": ["default"],
    "configs": {
      "static_text": "Wallet test response.",
      "usage": {
        "input_tokens": 20,
        "output_tokens": 10
      }
    }
  }' | jq
```

创建 A 组，并设置倍率为 `3`：

```bash
curl -sS -X POST "$BASE_URL/api/group/A" \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "price_multiplier": 3,
    "available_sets": ["default"]
  }' | jq
```

给 A 组挂上 `fake-chat`：

```bash
curl -sS -X POST "$BASE_URL/api/group/A/model_config/fake-chat" \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H 'Content-Type: application/json' \
  -d '{}' | jq
```

确认 `fake-chat` 已启用：

```bash
curl -sS "$BASE_URL/api/models/enabled/default" \
  -H "Authorization: Bearer $ADMIN_KEY" | jq
```

按以上参数联调时，`fake-chat` 会返回 `20` 个输入 token 和 `10` 个输出 token。

计费示例：

- 基础价格：输入 `1 / 1000 token`，输出 `2 / 1000 token`
- A 组倍率：`3`
- 实际扣费：`(20 * 1 / 1000 + 10 * 2 / 1000) * 3 = 0.12`

## 4. 注册用户

```bash
curl -sS "$BASE_URL/user-api/auth/register" \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "wallet-demo@example.com",
    "password": "Demo123456"
  }' | jq
```

拿到用户 ID：

- 如果注册成功，可直接从返回结果里读取 `data.user.id`
- 如果用户已存在，可以直接跳到登录步骤

## 5. 登录用户

```bash
export USER_JWT=$(
  curl -sS "$BASE_URL/user-api/auth/login" \
    -H 'Content-Type: application/json' \
    -d '{
      "email": "wallet-demo@example.com",
      "password": "Demo123456"
    }' | jq -r '.data.token'
)

echo "$USER_JWT"
```

查看当前用户：

```bash
curl -sS "$BASE_URL/user-api/auth/me" \
  -H "Authorization: Bearer $USER_JWT" | jq
```

从这里取用户 ID：

```bash
export USER_ID=$(
  curl -sS "$BASE_URL/user-api/auth/me" \
    -H "Authorization: Bearer $USER_JWT" | jq -r '.data.user.id'
)
```

## 6. 管理员给用户充值

```bash
curl -sS "$BASE_URL/api/app_users/$USER_ID/recharge" \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "amount": 50,
    "channel": "manual",
    "trade_no": "demo-topup-001",
    "remark": "wallet e2e test"
  }' | jq
```

查看用户钱包：

```bash
curl -sS "$BASE_URL/user-api/wallet" \
  -H "Authorization: Bearer $USER_JWT" | jq
```

## 7. 获取可选 group

```bash
curl -sS "$BASE_URL/user-api/groups" \
  -H "Authorization: Bearer $USER_JWT" | jq
```

预期返回每个 group 的：

- `group`
- `price_multiplier`
- `available_sets`
- `models`

选一个 group 和一个模型：

```bash
export GROUP_ID=$(
  curl -sS "$BASE_URL/user-api/groups" \
    -H "Authorization: Bearer $USER_JWT" | jq -r '.data.groups[0].group'
)

export MODEL_NAME=$(
  curl -sS "$BASE_URL/user-api/groups" \
    -H "Authorization: Bearer $USER_JWT" | jq -r '.data.groups[0].models[0]'
)

echo "$GROUP_ID"
echo "$MODEL_NAME"
```

如果这里返回空数组，说明当前没有可供用户使用的已启用 group，需要先在后台配置 group 和可用模型。

## 8. 创建用户 key

```bash
export USER_KEY=$(
  curl -sS "$BASE_URL/user-api/keys" \
    -H "Authorization: Bearer $USER_JWT" \
    -H 'Content-Type: application/json' \
    -d "{
      \"group\": \"$GROUP_ID\",
      \"name\": \"wallet-demo-key\",
      \"models\": [\"$MODEL_NAME\"]
    }" | jq -r '.data.key'
)

echo "$USER_KEY"
```

查看自己的 key 列表：

```bash
curl -sS "$BASE_URL/user-api/keys" \
  -H "Authorization: Bearer $USER_JWT" | jq
```

## 9. 请求模型

先看扣费前钱包：

```bash
curl -sS "$BASE_URL/user-api/wallet" \
  -H "Authorization: Bearer $USER_JWT" | jq
```

发起一次模型请求：

```bash
curl -sS "$BASE_URL/v1/chat/completions" \
  -H "Authorization: Bearer $USER_KEY" \
  -H 'Content-Type: application/json' \
  -d "{
    \"model\": \"$MODEL_NAME\",
    \"messages\": [
      {\"role\": \"user\", \"content\": \"请用一句话介绍你自己\"}
    ],
    \"max_tokens\": 64
  }" | jq
```

## 10. 查看余额和流水

请求完成后查看钱包：

```bash
curl -sS "$BASE_URL/user-api/wallet" \
  -H "Authorization: Bearer $USER_JWT" | jq
```

查看钱包流水：

```bash
curl -sS "$BASE_URL/user-api/wallet/logs" \
  -H "Authorization: Bearer $USER_JWT" | jq
```

预期至少能看到以下几类流水：

- `recharge`
- `reserve`
- `settle`

如果请求失败且没有实际消费，则应看到：

- `reserve`
- `release`

### 10.1 失败请求释放验证

如果你还想额外验证“请求失败时自动释放冻结金额”，可以再准备一条故意失败的测试上游：

- 新建一个专用模型，例如 `fail-chat`
- 给它配置正常价格
- 新建一个专用 group，例如 `FAIL`
- 新建一个专用 channel，但把 `base_url` 指向一个不可用地址，例如 `http://127.0.0.1:1/v1`

然后：

1. 用户充值
2. 创建绑定 `FAIL` 组的用户 Key
3. 调用 `/v1/chat/completions`
4. 预期接口返回非 `200`
5. 再查看钱包与流水

预期结果：

- `available_balance` 最终不变
- `frozen_balance` 最终回到 `0`
- `app_wallet_reservation.status = released`
- 钱包流水包含：
  - `reserve`
  - `release`

## 11. 重点检查项

### 11.1 选组是否正确

- 创建 key 时必须传 `group`
- 该 key 只能请求这个 group 下的模型
- 如果传 `models`，必须是这个 group 模型列表的子集

### 11.2 倍率是否生效

- 扣费金额应基于现有 `price`
- 最终按 `group.price_multiplier` 放大后扣费

### 11.3 钱包是否正确

- 充值后 `available_balance` 增加
- 请求前先产生 `reserve`
- 请求完成后产生 `settle`
- 失败请求应释放冻结金额

### 11.4 并发是否防超扣

当前已补充自动化回归测试：

```bash
cd core
go test ./model -run 'TestReserveAppUserBalanceConcurrentDoesNotOverdraw$'
```

预期结果：

- 多个并发预占请求同时进入时
- 成功预占数不会超过钱包可用余额允许的上限
- 不会出现负余额
- 不会出现“成功条数超过余额容量”的超扣

## 12. 常见问题

### 12.1 `groups` 为空

说明当前没有用户可选的已启用 group，或 group 下没有可用模型。

### 12.2 创建 key 返回模型不属于 group

说明 `models` 参数里传入了该 group 之外的模型，需要重新从 `/user-api/groups` 返回值中选择。

### 12.3 调模型时报 `group is disabled`

说明创建 key 后，该 group 被后台禁用了。

### 12.4 充值成功但余额没变化

先检查：

- `trade_no` 是否重复
- 充值目标用户 ID 是否正确
- 请求是否命中正确环境的 SQLite

## 13. 后续替换为真实支付

等你提供支付接口后，只需要把“第 6 步管理员充值”替换成：

- 用户发起支付
- 支付回调
- 回调成功后调用充值入账逻辑

其余链路：

- 用户选 group
- 创建 key
- 调模型
- 预占 + 结算

都可以保持不变。
