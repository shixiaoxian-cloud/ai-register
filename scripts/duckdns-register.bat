@echo off
REM DuckDNS 域名注册脚本 (Windows 批处理版本)
REM 适用于 Windows CMD

setlocal enabledelayedexpansion

REM 检查参数
set COMMAND=%1
set DOMAIN=%2

if "%DOMAIN%"=="" (
    if not "%DUCKDNS_DOMAIN%"=="" (
        set DOMAIN=%DUCKDNS_DOMAIN%
    )
)

if "%DUCKDNS_TOKEN%"=="" (
    echo [91m错误: 需要设置 DUCKDNS_TOKEN 环境变量[0m
    echo    从这里获取 token: https://www.duckdns.org/
    exit /b 1
)

if "%DOMAIN%"=="" (
    echo [91m错误: 需要提供域名[0m
    echo    用法: duckdns-register.bat ^<command^> ^<domain^>
    echo    或设置 DUCKDNS_DOMAIN 环境变量
    exit /b 1
)

if "%COMMAND%"=="register" goto :register
if "%COMMAND%"=="update" goto :register
if "%COMMAND%"=="verify" goto :verify
if "%COMMAND%"=="clear" goto :clear
if "%COMMAND%"=="info" goto :info
goto :help

:register
echo [94m正在获取公网 IP 地址...[0m

REM 获取 IPv4 地址
for /f "delims=" %%i in ('curl -s https://api.ipify.org') do set IPV4=%%i
echo [94mIPv4: %IPV4%[0m

REM 获取 IPv6 地址（可选）
for /f "delims=" %%i in ('curl -s https://api6.ipify.org 2^>nul') do set IPV6=%%i
if not "%IPV6%"=="" (
    echo [94mIPv6: %IPV6%[0m
)

echo.
echo [94m正在更新 DuckDNS 域名: %DOMAIN%.duckdns.org[0m

REM 构建 URL
set URL=https://www.duckdns.org/update?domains=%DOMAIN%^&token=%DUCKDNS_TOKEN%^&verbose=true
if not "%IPV4%"=="" set URL=%URL%^&ip=%IPV4%
if not "%IPV6%"=="" set URL=%URL%^&ipv6=%IPV6%

REM 调用 API
for /f "delims=" %%i in ('curl -s "%URL%"') do set RESPONSE=%%i

REM 检查响应
echo %RESPONSE% | findstr /C:"OK" >nul
if %errorlevel%==0 (
    echo [92m域名更新成功[0m
    echo    域名: %DOMAIN%.duckdns.org
    echo    IPv4: %IPV4%
    if not "%IPV6%"=="" echo    IPv6: %IPV6%

    echo.
    echo [94m等待 DNS 传播 (5 秒)...[0m
    timeout /t 5 /nobreak >nul

    echo [94m验证域名解析...[0m
    nslookup %DOMAIN%.duckdns.org | findstr /C:"%IPV4%" >nul
    if %errorlevel%==0 (
        echo [92m域名验证成功！[0m
    ) else (
        echo [93m域名验证待定 (DNS 可能需要几分钟传播)[0m
    )
) else (
    echo [91m域名更新失败[0m
    exit /b 1
)
goto :end

:verify
echo [94m验证域名: %DOMAIN%.duckdns.org[0m

REM 获取当前 IP
for /f "delims=" %%i in ('curl -s https://api.ipify.org') do set IPV4=%%i

REM 验证解析
nslookup %DOMAIN%.duckdns.org | findstr /C:"%IPV4%" >nul
if %errorlevel%==0 (
    echo [92m域名正确指向 %IPV4%[0m
) else (
    echo [91m域名验证失败[0m
    exit /b 1
)
goto :end

:clear
echo [94m清除域名: %DOMAIN%.duckdns.org[0m

set URL=https://www.duckdns.org/update?domains=%DOMAIN%^&token=%DUCKDNS_TOKEN%^&ip=^&clear=true^&verbose=true

for /f "delims=" %%i in ('curl -s "%URL%"') do set RESPONSE=%%i

echo %RESPONSE% | findstr /C:"OK" >nul
if %errorlevel%==0 (
    echo [92m域名清除成功[0m
) else (
    echo [91m域名清除失败[0m
    exit /b 1
)
goto :end

:info
echo 域名信息
echo    域名: %DOMAIN%.duckdns.org
echo    提供商: DuckDNS
echo    免费: 是
echo    IPv4 支持: 是
echo    IPv6 支持: 是
echo    通配符支持: 是
echo    自动续期: 是 (永不过期)
goto :end

:help
echo DuckDNS 域名管理器 (Windows)
echo.
echo 用法:
echo   duckdns-register.bat ^<command^> ^<domain^>
echo.
echo 命令:
echo   register ^<domain^>  注册或更新 DuckDNS 子域名
echo   update ^<domain^>    register 的别名
echo   verify ^<domain^>    验证域名 DNS 解析
echo   clear ^<domain^>     清除域名 IP 地址
echo   info ^<domain^>      显示域名信息
echo.
echo 环境变量:
echo   DUCKDNS_TOKEN      你的 DuckDNS token (必需)
echo   DUCKDNS_DOMAIN     默认域名 (可选)
echo.
echo 示例:
echo   set DUCKDNS_TOKEN=your-token
echo   duckdns-register.bat register mytest
echo.
echo 从这里获取 token: https://www.duckdns.org/
goto :end

:end
endlocal
