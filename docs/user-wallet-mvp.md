# 用户注册 / 预付费钱包 / 自助 Key 开发文档

## 1. 项目目标

在现有 AI Proxy 的基础上，新增一套面向最终用户的自助能力：

1. 用户注册 / 登录
2. 用户充值到账
3. 用户查看钱包余额
4. 用户查看可用分组（group）
5. 用户在指定分组下创建 key
6. 用户使用 key 调用现有 `/v1/*` 模型接口
7. 模型请求按现有 `price` 规则计费
8. 使用“预占 + 结算”方式扣减用户钱包余额

本期目标是尽快上线一套可用、清晰、可扩展的预付费方案，不做复杂支付和账务体系。

---

## 2. 本期范围

### 2.1 要做

- 只做预付费
- 只做钱包余额
- 只做用户余额扣费
- 价格配置继续复用现有 `price`
- 金额计算继续复用现有 `CalculateAmountDetail`
- 请求计费采用“预占 + 结算”
- 支付成功后只做两件事：
  - 增加用户钱包余额
  - 记录充值流水

### 2.2 不做

- 退款
- 撤单
- 套餐有效期
- 赠金
- 优惠券
- 后付费
- 月结
- 发票
- 多级代理分账
- 完整财务账本
- 新增一套“模型与 group 关联管理”功能

---

## 3. 核心结论

## 3.1 价格来源

用户消费金额不新建第二套价格规则，直接复用现有模型价格配置：

- 模型基础价格：`core/model/modelconfig.go`
- 分组级价格覆盖：`core/model/groupmodel.go`
- 金额计算：`core/common/consume/consume.go`

## 3.2 计费模式

本方案采用：

- **请求前预占**
- **请求后结算**

含义如下：

1. 请求发送到上游模型之前，先从用户钱包里冻结一笔预估金额
2. 请求完成后，根据实际 `amount` 做最终结算
3. 若实际金额小于预占金额，差额退回可用余额
4. 若请求失败或未产生有效消费，释放全部预占金额

## 3.3 为什么采用预占 + 结算

因为本项目后续会面临并发请求问题。

如果只做“请求结束后扣费”，会出现两个问题：

1. 多个请求同时通过余额校验，最终一起扣费，导致超扣
2. 流式请求、长输出请求在执行期间无法锁定预算

因此本期直接采用“预占 + 结算”，避免后面再整体推翻。

---

## 4. 复用现有能力

当前项目已有大量能力可直接复用：

- `group` 模型：`core/model/group.go`
- `token` 模型：`core/model/token.go`
- 模型配置与价格：`core/model/modelconfig.go`
- 分组级模型价格覆盖：`core/model/groupmodel.go`
- 金额计算：`core/common/consume/consume.go`
- 模型请求入口：`core/router/relay.go`
- 现有请求分发与价格预估：`core/controller/relay-controller.go`
- 管理后台模型价格配置：
  - `web/src/feature/model/components/ModelForm.tsx`
  - `web/src/feature/group/components/GroupModelConfigsTab.tsx`

本项目最关键的复用原则：

1. **模型请求仍然走现有 `/v1/*`**
2. **消费金额仍然由现有 `price` 体系计算**
3. **用户钱包只负责冻结、结算、扣减**
4. **本期不新增模型与 group 的关联开发，直接复用现有 group / price / override_price / 倍率体系**

---

## 5. 用户流程

### 5.1 主流程

1. 用户注册账号
2. 用户登录
3. 用户发起充值
4. 支付成功后，系统给用户钱包加余额，并记录充值流水
5. 用户进入控制台查看可用分组
6. 用户选择分组并创建 key
7. 用户使用该 key 请求现有 `/v1/*`
8. 系统先冻结预估金额
9. 请求完成后，按实际 `amount` 做最终结算

### 5.2 关键说明

- key 继续复用现有 `token`
- group 继续作为模型权限、路由和价格配置边界
- 用户创建 key 时必须选择一个 group，key 与该 group 绑定
- 本期不新增“模型归属 group”的管理功能，直接复用现有 group 配置结果
- 钱包余额归属于用户，不归属于 group
- 用户实际消费金额由“请求命中的价格规则”决定
- 管理端不需要查看用户自助创建的 key；现有后台 token 列表应默认过滤这类 key

---

## 6. 价格与金额计算规则

## 6.1 价格来源

价格直接来自现有 `price` 配置，支持：

- 输入 token 单价
- 输出 token 单价
- 按次价格 `per_request_price`
- 缓存命中价格
- cache 创建价格
- 图片输入 / 输出价格
- 音频输入价格
- thinking 输出价格
- web search 价格
- conditional prices

## 6.2 金额来源

最终消费金额统一使用：

- `CalculateAmountDetail(...).UsedAmount`

含义：

- `price` 负责定义价格
- `CalculateAmountDetail` 负责计算实际金额
- 钱包系统只拿最终金额进行冻结和结算

## 6.3 分组级价格

如果 group 对某个模型启用了 `override_price`，则该用户在该 group 下请求该模型时，实际生效价格以 group 覆盖后的价格为准。

也就是说：

- 同一模型
- 不同 group
- 可以有不同用户消费价格

## 6.4 Group 倍率规则

本期需要明确：group 不只是权限边界，也是计费边界。

建议规则：

- 用户创建 key 时必须选择一个 group
- key 后续请求时，直接按该 group 的价格规则计费
- group 可以配置一个统一倍率，例如 `price_multiplier = 3`
- 当 group 倍率为 `3` 时，该 group 下所有模型的消费价格按基础价格的 `3` 倍计算

推荐计算顺序：

1. 先取模型基础 `price`
2. 若 group 对该模型有 `override_price`，则先使用 group 覆盖价
3. 再应用 group 的统一倍率 `price_multiplier`
4. 最后把“倍率后的有效价格”传给 `CalculateAmountDetail`

举例：

- 基础输入价格 `0.002`
- 基础输出价格 `0.010`
- group A 的倍率为 `3`
- 则 group A 下该模型的有效输入价格为 `0.006`
- 有效输出价格为 `0.030`

说明：

- 倍率应作用在价格对象上，而不是在最终钱包扣减后再单独乘一次
- 这样可以保证请求日志、消费日志、结算金额都使用同一套有效价格
- `per_request_price`、缓存价格、图片价格、音频价格、thinking 价格、web search 价格也应按相同倍率处理

---

## 7. 钱包设计

## 7.1 钱包余额语义

用户钱包分成两个部分：

- `available_balance`：可用余额
- `frozen_balance`：冻结余额

规则：

- 充值成功后，增加 `available_balance`
- 请求预占时，从 `available_balance` 转入 `frozen_balance`
- 请求结算时，从 `frozen_balance` 扣除实际消费，并把差额退回 `available_balance`

## 7.2 推荐数据表

### `app_user`

用户表。

建议字段：

- `id`
- `email` 或 `phone`
- `password_hash`
- `status`
- `created_at`
- `updated_at`

### `app_user_wallet`

用户钱包表。

建议字段：

- `id`
- `user_id`
- `available_balance`
- `frozen_balance`
- `created_at`
- `updated_at`

说明：

- 一个用户一条钱包记录
- `available_balance` 为当前可用余额
- `frozen_balance` 为已冻结未结算金额

### `app_recharge_log`

充值流水表。

建议字段：

- `id`
- `user_id`
- `amount`
- `channel`
- `trade_no`
- `status`
- `raw_payload`
- `created_at`

### `app_wallet_reservation`

预占记录表。

建议字段：

- `id`
- `request_id`
- `user_id`
- `token_id`
- `group_id`
- `model`
- `reserved_amount`
- `actual_amount`
- `status`
- `reason`
- `expires_at`
- `created_at`
- `updated_at`

说明：

- 一次模型请求对应一条预占记录
- `status` 建议包含：
  - `held`
  - `settled`
  - `released`
  - `failed`

### `app_wallet_log`

钱包流水表。

建议字段：

- `id`
- `user_id`
- `type`
- `amount`
- `balance_before`
- `balance_after`
- `request_id`
- `reservation_id`
- `remark`
- `created_at`

说明：

- 统一记录充值、预占、结算、释放等动作

### `app_user_group`

本期最小 MVP 不再依赖这张表。

说明：

- 所有启用中的 `group` 对用户透明可选
- 用户创建 key 时直接选择某个 `group`
- 如果后续需要“用户级 group 白名单授权”，再启用这张表即可

## 7.3 现有表扩展

### `token`

建议增加：

- `owner_user_id`

作用：

- 标识这个 key 属于哪个用户
- 模型请求时可通过 token 反查所属用户钱包

---

## 8. 接口设计

## 8.1 用户侧接口前缀

建议新增一组接口前缀：

- `/user-api/*`

与现有管理接口 `/api/*`、模型代理接口 `/v1/*` 分开。

## 8.2 认证接口

### `POST /user-api/auth/register`

注册用户。

### `POST /user-api/auth/login`

用户登录。

### `GET /user-api/auth/me`

获取当前登录用户信息。

## 8.3 钱包接口

### `GET /user-api/wallet`

获取当前用户钱包信息。

返回示例：

```json
{
  "available_balance": 100.50,
  "frozen_balance": 8.20
}
```

### 当前阶段充值方式

当前最小后端闭环先不接真实支付网关。

本阶段充值先通过管理员接口完成：

- `POST /api/app_users/:id/recharge`

处理逻辑：

1. 增加 `app_user_wallet.available_balance`
2. 写入 `app_recharge_log`
3. 写入 `app_wallet_log(type=recharge)`

后续接入真实支付时，再把支付回调接到这套充值入账逻辑上。

## 8.4 分组接口

### `GET /user-api/groups`

返回当前用户可选择的 group 列表。

说明：

- 只返回当前可用的 group
- 每个 group 需要返回：
  - `group`
  - `price_multiplier`
  - `available_sets`
  - `models`
- 前端创建 key 时，应先拉取该接口，再让用户选择 group

返回示例：

```json
{
  "groups": [
    {
      "group": "A",
      "price_multiplier": 3,
      "available_sets": ["default"],
      "models": ["gpt-4.1", "gpt-4o-mini"]
    },
    {
      "group": "B",
      "price_multiplier": 1.5,
      "available_sets": ["default", "vision"],
      "models": ["claude-sonnet-4", "gemini-2.5-pro"]
    }
  ]
}
```

## 8.5 Key 接口

### `GET /user-api/keys`

获取当前用户自己的 key 列表。

### `POST /user-api/keys`

用户在指定 group 下创建 key。

说明：

- `group` 必填
- 该 key 创建后固定绑定这个 group
- 如果传 `models`，则必须是这个 group 下模型的子集
- 如果不传 `models`，则默认可使用该 group 下全部模型

请求示例：

```json
{
  "group": "default",
  "name": "my-key-1",
  "models": ["gpt-4.1", "gpt-4o-mini"]
}
```

处理逻辑：

1. 校验 group 存在且处于启用状态
2. 如果传 `models`，校验这些模型属于所选 group
3. 调用现有 token 创建逻辑
4. 写入 `owner_user_id`
5. token 绑定所选 group，后续请求直接按该 group 的倍率和价格规则扣费

### `DELETE /user-api/keys/:id`

删除自己的 key。

---

## 9. 预占 + 结算设计

## 9.1 请求前预占

在请求真正发往上游模型之前，系统需要先计算一个预估金额 `reserve_amount`，并冻结这笔钱。

冻结成功后，请求才允许继续。

冻结失败时，直接拒绝请求。

## 9.2 请求后结算

请求完成后，系统根据真实 usage 计算实际金额 `actual_amount`。

然后执行结算：

- 若 `actual_amount < reserve_amount`
  - 扣掉实际金额
  - 剩余部分退回可用余额
- 若 `actual_amount = reserve_amount`
  - 直接确认本次消费
- 若 `actual_amount > reserve_amount`
  - 优先尝试补扣差额
  - 若补扣失败，记录结算异常，后续人工处理

## 9.3 请求失败处理

若请求失败，或未产生有效消费金额，则：

- 释放全部预占金额
- 不进行实际扣费
- 保留请求日志

## 9.4 预占金额策略

预占金额必须尽量保守，优先高估，不应低估。

建议规则：

- `per_request_price` 模型：直接按次预占
- 图片模型：按当前 size / quality 对应价格预占
- 文本模型：
  - 先结合当前请求输入计算 `meta.RequestUsage`
  - 再结合请求中的输出上限参数估算
  - 用估算结果计算 `reserve_amount`
- 若无法可靠估算：
  - 使用一个系统配置的兜底预占金额

## 9.5 结算与日志职责分离

建议区分两类动作：

1. **钱包动作**
   - 预占
   - 结算
   - 释放
2. **日志动作**
   - 请求日志
   - 消费明细
   - 错误日志

本期建议：

- 钱包预占 / 结算 / 释放使用同步流程
- 请求日志和详细消费日志仍可异步

原因：

- 钱包状态必须及时一致
- 若把结算放入异步流程，容易出现冻结余额长期不释放的问题

---

## 10. 请求链路改造思路

## 10.1 当前链路

当前链路大致为：

1. `TokenAuth` 校验 key
2. 根据 token 找到 group
3. 请求前做一次余额检查
4. 进入模型分发与调用
5. 请求完成后计算实际金额
6. 异步消费并记录日志

## 10.2 改造后链路

新增逻辑建议如下：

1. `TokenAuth` 成功后，根据 token 找到 `owner_user_id`
2. 从 token 反查用户钱包
3. 根据本次请求估算 `reserve_amount`
4. 原子冻结用户余额
5. 冻结成功后继续发起模型请求
6. 请求完成后根据真实 usage 计算 `actual_amount`
7. 同步执行结算或释放
8. 继续复用现有请求日志和消费日志

## 10.3 推荐接入点

### 请求前预占

推荐接入位置：

- `core/controller/relay-controller.go`

原因：

- 这里已经具备 `price`
- 这里已经具备 `meta.RequestUsage`
- 这里已经有现成的请求前余额预估逻辑

### 请求后结算

推荐接入位置：

- `core/controller/relay-controller.go`

原因：

- 这里已经能拿到真实 `result.Usage`
- 这里已经能计算真实 `amount`
- 可以在进入异步日志之前先完成钱包结算

### 余额上下文

现有 `core/middleware/ctxkey.go` 已有 `GroupBalance` 上下文 key。

建议新增：

- `WalletReservation`
- `WalletUser`

用于跨链路传递当前用户和本次预占记录。

---

## 11. 后端开发任务

## 11.1 数据层

- 新增 `app_user`
- 新增 `app_user_wallet`
- 新增 `app_recharge_log`
- 新增 `app_wallet_reservation`
- 新增 `app_wallet_log`
- 给 `token` 增加 `owner_user_id`
- 接入数据库自动迁移

## 11.2 认证层

- 新增用户注册
- 新增用户登录
- 新增用户态认证中间件
- 在 token 请求链路中解析 `owner_user_id`

## 11.3 钱包服务层

- 新增钱包查询服务
- 新增充值入账服务
- 新增预占服务
- 新增结算服务
- 新增释放服务
- 新增钱包流水服务

## 11.4 模型调用链改造

- 请求前预估预占金额
- 请求前冻结余额
- 请求后同步结算
- 请求失败时释放冻结金额
- 结算异常时写错误日志

## 11.5 定时任务

新增超时补偿任务：

- 定时扫描长时间处于 `held` 状态的预占记录
- 自动释放异常冻结金额

---

## 12. 前端开发任务

建议新增一套“用户门户”页面，不与当前管理员后台混用。

### 12.1 页面

- 注册页
- 登录页
- 钱包页
- 充值页
- 分组选择页
- Key 管理页
- 钱包流水页

### 12.2 主要功能

- 用户注册 / 登录
- 查看可用余额与冻结余额
- 发起充值
- 查看充值结果
- 查看可用分组
- 创建 key
- 查看自己的 key 列表
- 查看钱包流水

---

## 13. 验收标准

满足以下条件即可认为本期完成：

1. 用户可以注册并登录
2. 管理员可以给用户完成一次充值到账
3. 用户可以看到自己的可用余额与冻结余额
4. 用户可以看到当前可选的 group，以及每个 group 的倍率和模型
5. 用户可以在指定 group 下创建 key
6. 用户可以使用该 key 调用现有 `/v1/*`
7. 请求发起前，系统会冻结预估金额
8. 请求成功后，系统会按实际 `amount` 结算
9. 请求失败后，系统会释放预占金额
10. 充值流水、预占流水、结算流水可查询

---

## 14. 已知限制

- 若预占金额估算过低，仍可能出现补扣场景
- 本期不处理退款
- 本期不处理发票
- 本期不做复杂财务对账
- 本期不做多渠道支付抽象

---

## 15. 后续优化方向

以下内容不在本期范围，但后续可以继续演进：

- 更智能的预占金额估算策略
- 更完善的钱包账本
- 结算异常自动重试
- 多支付渠道抽象
- 用户自助消费明细页
- 用户自助导出账单
