#!/bin/bash

echo "========================================="
echo "Field Elevate System Tests"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test results
PASSED=0
FAILED=0

# Function to test endpoint
test_endpoint() {
    local name=$1
    local url=$2
    local expected_status=${3:-200}
    
    echo -n "Testing $name... "
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$url")
    
    if [ "$response" -eq "$expected_status" ]; then
        echo -e "${GREEN}✓ PASSED${NC} (Status: $response)"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAILED${NC} (Status: $response, Expected: $expected_status)"
        ((FAILED++))
        return 1
    fi
}

# Function to test POST endpoint
test_post_endpoint() {
    local name=$1
    local url=$2
    local data=$3
    local expected_status=${4:-200}
    
    echo -n "Testing $name... "
    
    response=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" -d "$data" "$url")
    
    if [ "$response" -eq "$expected_status" ]; then
        echo -e "${GREEN}✓ PASSED${NC} (Status: $response)"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAILED${NC} (Status: $response, Expected: $expected_status)"
        ((FAILED++))
        return 1
    fi
}

# Health Check Tests
echo "1. SERVICE HEALTH CHECKS"
echo "------------------------"
test_endpoint "MCP Hub Health" "http://localhost:8000/health"
test_endpoint "Data Hub Health" "http://localhost:8001/health"
test_endpoint "AI COO Health" "http://localhost:8002/health"
test_endpoint "Risk Analyzer Health" "http://localhost:8004/health"

echo ""
echo "2. DATA HUB TESTS"
echo "-----------------"
test_endpoint "Market Quote (AAPL)" "http://localhost:8001/api/market/quote/AAPL"
test_endpoint "Market Bars (AAPL)" "http://localhost:8001/api/market/bars/AAPL"
test_endpoint "Market Technicals (AAPL)" "http://localhost:8001/api/market/technicals/AAPL"
test_endpoint "News (AAPL)" "http://localhost:8001/api/news/AAPL"
test_post_endpoint "Market Snapshot" "http://localhost:8001/api/market/snapshot" '{"symbols":["AAPL","GOOGL"]}'

echo ""
echo "3. RISK ANALYZER TESTS"
echo "----------------------"
test_endpoint "Portfolio Status" "http://localhost:8004/api/portfolio"
test_endpoint "Risk Limits" "http://localhost:8004/api/risk/limits"
test_endpoint "Risk Metrics" "http://localhost:8004/api/risk/metrics"
test_post_endpoint "Risk Evaluation" "http://localhost:8004/api/risk/evaluate" '{"symbol":"AAPL","action":"BUY","quantity":10,"price":150}'

echo ""
echo "4. AI COO TESTS"
echo "---------------"
test_endpoint "AI Insights" "http://localhost:8002/api/insights"
test_post_endpoint "AI Analysis" "http://localhost:8002/api/analyze" '{"symbols":["AAPL","GOOGL"]}'

echo ""
echo "5. MCP HUB TESTS"
echo "----------------"
test_endpoint "Service Registry" "http://localhost:8000/api/services"
test_post_endpoint "Context Update" "http://localhost:8000/api/context" '{"type":"test","data":{"message":"test"}}'

echo ""
echo "========================================="
echo "TEST SUMMARY"
echo "========================================="
echo -e "Total Tests: $((PASSED + FAILED))"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

# Generate simple HTML report
cat > test-report.html << EOF
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Field Elevate - Test Results</title>
    <style>
        body {
            font-family: -apple-system, sans-serif;
            background: #0a0a0a;
            color: #fff;
            padding: 40px;
            text-align: center;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
        }
        h1 {
            font-size: 3rem;
            background: linear-gradient(135deg, #667eea, #764ba2);
            -webkit-background-clip: text;
            background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 20px;
        }
        .summary {
            background: #1a1a1a;
            border: 1px solid #333;
            border-radius: 12px;
            padding: 40px;
            margin: 30px 0;
        }
        .stats {
            display: flex;
            justify-content: space-around;
            margin: 30px 0;
        }
        .stat {
            text-align: center;
        }
        .stat-value {
            font-size: 3rem;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .passed { color: #22c55e; }
        .failed { color: #ef4444; }
        .links {
            margin-top: 40px;
        }
        .btn {
            display: inline-block;
            padding: 15px 30px;
            margin: 10px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 500;
        }
        .btn:hover {
            opacity: 0.9;
        }
        .timestamp {
            color: #666;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Field Elevate System</h1>
        <h2>Test Results</h2>
        
        <div class="summary">
            <div class="stats">
                <div class="stat">
                    <div class="stat-value">$((PASSED + FAILED))</div>
                    <div>Total Tests</div>
                </div>
                <div class="stat">
                    <div class="stat-value passed">$PASSED</div>
                    <div>Passed</div>
                </div>
                <div class="stat">
                    <div class="stat-value failed">$FAILED</div>
                    <div>Failed</div>
                </div>
            </div>
            
            <h3>System Status: $([ $FAILED -eq 0 ] && echo "✅ All Tests Passed" || echo "⚠️ Some Tests Failed")</h3>
        </div>
        
        <div class="links">
            <h3>Access the System</h3>
            <a href="service-status.html" class="btn">Live Service Status</a>
            <a href="http://localhost:3000" class="btn">Grafana Dashboard</a>
            <a href="http://localhost:8001" class="btn">Data Hub API</a>
            <a href="http://localhost:8002" class="btn">AI COO API</a>
        </div>
        
        <p class="timestamp">Generated: $(date)</p>
    </div>
</body>
</html>
EOF

echo "Test report saved to: test-report.html"
echo "Service status page: service-status.html"