# 验收准则：PLUG-001 事件总线 + PLUG-002 路由钩子（07 §7 + 03 §3.2.4）

Feature: 插件通信基础设施（事件总线 + 路由钩子）

  Scenario: 事件总线发布/订阅
    Given 一个事件总线实例
    When 订阅者 on() 订阅某事件，发布者 emit() 发布该事件
    Then 所有订阅者同步收到 payload
    And off() / 退订函数可取消订阅
    And 单个订阅者抛异常不影响其余订阅者

  Scenario: 路由 beforeEach 取消导航
    Given 一个 beforeEach 钩子返回 false
    When 用户点击站内链接
    Then 导航被取消（URL 与内容均不变化）

  Scenario: 路由 beforeEach 重定向
    Given 一个 beforeEach 钩子返回字符串 "/login.md"
    When 用户点击站内链接
    Then 导航重定向到 "/login.md"

  Scenario: 路由 afterEach 在导航完成后执行
    Given 注册了 afterEach 钩子
    When 导航成功完成
    Then 钩子收到 { from, to } 上下文
    And 总线发布 doclight:routechange 事件
