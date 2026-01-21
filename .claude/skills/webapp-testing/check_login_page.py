#!/usr/bin/env python3
"""检查登录页面是否应用了配置"""

from playwright.sync_api import sync_playwright
import json

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    # 启用控制台日志捕获
    console_logs = []
    page.on('console', lambda msg: console_logs.append(f'[{msg.type}] {msg.text}'))

    print("正在访问登录页面...")
    page.goto('http://localhost:80')

    # 等待页面加载完成
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(2000)  # 额外等待2秒确保所有资源加载

    # 截图
    screenshot_path = '/tmp/login_page.png'
    page.screenshot(path=screenshot_path, full_page=True)
    print(f"截图已保存到: {screenshot_path}")

    # 检查页面标题
    title = page.title()
    print(f"\n页面标题: {title}")

    # 检查是否有登录配置相关的元素
    print("\n检查页面元素:")

    # 查找登录标题
    login_title = page.locator('.login-form .title').first
    if login_title.count() > 0:
        print(f"- 登录标题: {login_title.text_content()}")

    # 检查背景图片样式
    login_container = page.locator('.login').first
    if login_container.count() > 0:
        style = login_container.get_attribute('style')
        print(f"- 登录容器样式: {style}")

    # 检查 localStorage 中的登录配置
    print("\n检查 localStorage 中的登录配置:")
    login_config = page.evaluate("""
        () => {
            const config = localStorage.getItem('login_config');
            return config ? JSON.parse(config) : null;
        }
    """)
    if login_config:
        print(f"登录配置缓存: {json.dumps(login_config, indent=2, ensure_ascii=False)}")
    else:
        print("未找到登录配置缓存")

    # 检查网络请求
    print("\n检查控制台日志:")
    for log in console_logs[-10:]:  # 显示最后10条日志
        print(f"  {log}")

    browser.close()

print(f"\n请查看截图: {screenshot_path}")
