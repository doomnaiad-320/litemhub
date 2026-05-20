# 支付风险登记

更新时间：2026-05-20

说明：
- `高`：可能直接导致资金错误、重复入账、伪造支付、账号接管或大范围财务风险
- `中`：可能造成对账偏差、滥用、数据污染或可放大风险
- `低`：更多是边界、可观测性或实现层面的隐患

## 高风险

1. **OAuth 回跳地址在未配置时依赖请求头拼接**
   - 位置：`core/controller/user_auth_oauth.go`
   - 问题：`buildUserOAuthCallbackURL` / `captureUserOAuthFrontendOrigin` 在配置为空时会使用 `X-Forwarded-Host`、`X-Forwarded-Proto` 或 `req.Host`
   - 风险：代理链不可信或配置不严时，可能把 OAuth 回调和登录结果导向错误域名

2. **用户门户 JWT 以 localStorage 持久化**
   - 位置：`web/src/store/user-portal-auth.ts`
   - 问题：访问令牌被前端持久化
   - 风险：一旦发生 XSS，JWT 可被直接读取并冒用

3. **登录接口缺少服务端限流与失败锁定**
   - 位置：`core/controller/user_auth.go`
   - 问题：`LoginAppUser` 只做账号密码校验，没有看到账号/IP 级别的失败控制
   - 风险：暴力破解与撞库攻击成本低

4. **注册验证码接口可枚举邮箱是否存在**
   - 位置：`core/controller/user_auth_email_code.go`
   - 问题：已存在邮箱直接返回 `email already exists`
   - 风险：可批量探测用户是否注册

5. **支付回调依赖第三方签名与金额，但仍暴露公开回调面**
   - 位置：`core/controller/dulupay.go`
   - 问题：`DuluPayNotify` 是公网 GET 回调入口
   - 风险：虽然有签名验签和金额比对，但公开回调天然面更大，需持续关注第三方签名实现和配置正确性

## 中风险

6. **注册验证码仅按邮箱冷却，没有明显的全局/按 IP 限制**
   - 位置：`core/controller/user_auth_email_code.go`
   - 问题：`SendUserRegisterEmailCode` 主要基于邮箱记录节流
   - 风险：可用不同邮箱批量触发邮件轰炸

7. **密码策略过弱**
   - 位置：`core/controller/user_auth.go`
   - 问题：密码只要求最少 6 位
   - 风险：弱口令和被撞库命中的概率偏高

8. **OAuth 只按邮箱做账号归并**
   - 位置：`core/controller/user_auth_oauth.go`
   - 问题：邮箱已存在时直接登录对应用户
   - 风险：这是策略型风险，如果邮箱可信边界不稳，可能产生账号绑定争议

9. **邀请码/折扣码可被枚举探测**
   - 位置：`core/model/app_user_discount_code.go`、`core/controller/dulupay.go`
   - 问题：折扣码短且公开可输入
   - 风险：可能被撞库、试码和滥用

10. **支付创建接口允许客户端传入折扣码**
    - 位置：`core/controller/dulupay.go`
    - 问题：`CreateDuluPayRecharge` 接收 `discount_code`
    - 风险：虽然后端有归属校验，但这类输入本身会放大攻击面，需要持续关注错误分支和日志暴露

11. **支付回调采用 GET 且携带完整业务参数**
    - 位置：`core/router/user_api.go`、`core/controller/dulupay.go`
    - 问题：notify/return 都是 GET
    - 风险：更容易被日志、代理链路、浏览器历史记录记录，虽然验签还在，但暴露面偏大

## 低风险

12. **OAuth state cookie 只做了 HttpOnly / SameSite，没有额外签名**
    - 位置：`core/controller/user_auth_oauth.go`
    - 问题：state payload 只是 base64 JSON
    - 风险：在正常浏览器流程下问题不大，但 cookie 污染场景下鲁棒性一般

13. **支付返回页只根据回调签名结果跳转**
    - 位置：`core/controller/dulupay.go`
    - 问题：`DuluPayReturn` 只做回调验签，不显示支付最终状态细节
    - 风险：更像可观测性问题，不是直接资金安全问题

14. **当前仓库存在未提交改动**
    - 位置：工作区
    - 问题：支付、邀请、认证相关文件都在变更中
    - 风险：审查和发布时容易漏掉联动问题

