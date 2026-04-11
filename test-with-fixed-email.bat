@echo off
REM 使用固定邮箱测试 OpenAI 注册流程
REM 绕过临时邮箱服务的问题

setlocal enabledelayedexpansion

echo ==========================================
echo OpenAI 注册流程测试（使用固定邮箱）
echo ==========================================
echo.

REM 检查是否提供了邮箱地址
if "%~1"=="" (
  echo 错误：请提供邮箱地址
  echo 用法：test-with-fixed-email.bat your-email@example.com
  echo.
  echo 示例：
  echo   test-with-fixed-email.bat test@gmail.com
  exit /b 1
)

set TARGET_EMAIL=%~1
echo 使用邮箱：%TARGET_EMAIL%
echo.

REM 生成随机密码
for /f %%i in ('powershell -command "Get-Date -Format 'yyyyMMddHHmmss'"') do set TIMESTAMP=%%i
set TARGET_PASSWORD=Test%TIMESTAMP%@Pwd
echo 生成的密码：%TARGET_PASSWORD%
echo.

REM 设置环境变量
set CONTINUE_AFTER_PROTECTED_CHALLENGE=true
set HEADED=true

echo ==========================================
echo 配置信息
echo ==========================================
echo 邮箱：%TARGET_EMAIL%
echo 密码：%TARGET_PASSWORD%
echo 允许手动完成验证：是
echo 有头模式：是
echo.

echo ==========================================
echo 开始测试
echo ==========================================
echo.
echo 注意：
echo 1. 测试会打开浏览器窗口
echo 2. 当需要输入验证码时，请手动检查邮箱
echo 3. 在浏览器中输入验证码后，回到终端按回车继续
echo.

REM 运行测试
call npm test

echo.
echo ==========================================
echo 测试完成
echo ==========================================

endlocal
