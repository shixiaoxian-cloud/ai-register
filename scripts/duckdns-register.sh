#!/bin/bash

# DuckDNS 域名注册脚本 (Bash 版本)
# 适用于 Linux/macOS/Git Bash

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_info() {
    echo -e "${BLUE}🔍 $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# 获取公网 IPv4 地址
get_public_ipv4() {
    curl -s https://api.ipify.org
}

# 获取公网 IPv6 地址
get_public_ipv6() {
    curl -s https://api6.ipify.org 2>/dev/null || echo ""
}

# 更新 DuckDNS 域名
update_duckdns() {
    local domain=$1
    local token=$2
    local ip=$3
    local ipv6=$4

    local url="https://www.duckdns.org/update?domains=${domain}&token=${token}&verbose=true"

    if [ -n "$ip" ]; then
        url="${url}&ip=${ip}"
    fi

    if [ -n "$ipv6" ]; then
        url="${url}&ipv6=${ipv6}"
    fi

    curl -s "$url"
}

# 验证域名解析
verify_domain() {
    local domain=$1
    local expected_ip=$2

    if command -v nslookup &> /dev/null; then
        nslookup "${domain}.duckdns.org" | grep -q "$expected_ip"
    elif command -v dig &> /dev/null; then
        dig +short "${domain}.duckdns.org" | grep -q "$expected_ip"
    else
        print_warning "nslookup or dig not found, skipping verification"
        return 0
    fi
}

# 显示帮助信息
show_help() {
    cat << EOF
DuckDNS Domain Manager (Bash)

Usage:
  ./duckdns-register.sh <command> <domain>

Commands:
  register <domain>  Register or update a DuckDNS subdomain
  update <domain>    Alias for register
  verify <domain>    Verify domain DNS resolution
  clear <domain>     Clear domain IP address
  info <domain>      Show domain information

Environment Variables:
  DUCKDNS_TOKEN      Your DuckDNS token (required)
  DUCKDNS_DOMAIN     Default domain name (optional)

Examples:
  # Register a new subdomain
  DUCKDNS_TOKEN=your-token ./duckdns-register.sh register mytest

  # Update existing subdomain
  DUCKDNS_TOKEN=your-token ./duckdns-register.sh update mytest

  # Verify domain resolution
  DUCKDNS_TOKEN=your-token ./duckdns-register.sh verify mytest

Get your token from: https://www.duckdns.org/
EOF
}

# 主函数
main() {
    local command=$1
    local domain=${2:-$DUCKDNS_DOMAIN}
    local token=$DUCKDNS_TOKEN

    # 检查 token
    if [ -z "$token" ]; then
        print_error "DUCKDNS_TOKEN environment variable is required"
        echo "   Get your token from: https://www.duckdns.org/"
        exit 1
    fi

    # 检查域名
    if [ -z "$domain" ]; then
        print_error "Domain name is required"
        echo "   Usage: ./duckdns-register.sh <command> <domain>"
        echo "   Or set DUCKDNS_DOMAIN environment variable"
        exit 1
    fi

    case "$command" in
        register|update)
            print_info "Getting public IP addresses..."
            local ipv4=$(get_public_ipv4)
            local ipv6=$(get_public_ipv6)

            echo -e "${BLUE}📍 IPv4: ${ipv4}${NC}"
            if [ -n "$ipv6" ]; then
                echo -e "${BLUE}📍 IPv6: ${ipv6}${NC}"
            fi

            echo ""
            print_info "Updating DuckDNS domain: ${domain}.duckdns.org"

            local response=$(update_duckdns "$domain" "$token" "$ipv4" "$ipv6")
            local status=$(echo "$response" | head -n1)

            if [ "$status" = "OK" ]; then
                print_success "Domain updated successfully"
                echo "   Domain: ${domain}.duckdns.org"
                echo "   IPv4: ${ipv4}"
                if [ -n "$ipv6" ]; then
                    echo "   IPv6: ${ipv6}"
                fi

                echo ""
                print_info "Waiting for DNS propagation (5 seconds)..."
                sleep 5

                print_info "Verifying domain resolution..."
                if verify_domain "$domain" "$ipv4"; then
                    print_success "Domain verified successfully!"
                else
                    print_warning "Domain verification pending (DNS may take a few minutes to propagate)"
                fi
            else
                print_error "Failed to update domain"
                exit 1
            fi
            ;;

        verify)
            print_info "Verifying domain: ${domain}.duckdns.org"
            local ipv4=$(get_public_ipv4)

            if verify_domain "$domain" "$ipv4"; then
                print_success "Domain is correctly pointing to ${ipv4}"
            else
                print_error "Domain verification failed"
                exit 1
            fi
            ;;

        clear)
            print_info "Clearing domain: ${domain}.duckdns.org"
            local response=$(update_duckdns "$domain" "$token" "" "")
            local status=$(echo "$response" | head -n1)

            if [ "$status" = "OK" ]; then
                print_success "Domain cleared successfully"
            else
                print_error "Failed to clear domain"
                exit 1
            fi
            ;;

        info)
            echo "📋 Domain Information"
            echo "   Domain: ${domain}.duckdns.org"
            echo "   Provider: DuckDNS"
            echo "   Free: Yes"
            echo "   IPv4 Support: Yes"
            echo "   IPv6 Support: Yes"
            echo "   Wildcard Support: Yes"
            echo "   Auto-Renew: Yes (no expiration)"
            ;;

        *)
            show_help
            ;;
    esac
}

# 运行主函数
main "$@"
