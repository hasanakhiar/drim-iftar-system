# Quick Test Reference

## Run All Tests

```bash
npm test
```

## Run Test Tiers

### Unit Tests Only (35 tests, ~5 seconds)
```bash
npm test -- --testPathPattern="auth.test|validation.test|stockUtils.test"
```

### Integration Tests Only (104 tests, ~45 seconds)
```bash
npm test -- --testPathPattern="integration"
```

### E2E Tests Only (24 tests, ~120 seconds)
```bash
npm test -- e2e.test.js
```

## Run With Coverage Report

```bash
npm test -- --coverage
```

## Run Specific Service Tests

```bash
# Identity Provider (13 tests)
npm test -- identity-provider/tests/auth.test.js

# Order Gateway (65 tests)
npm test -- order-gateway/tests/

# Stock Service (61 tests)
npm test -- stock-service/tests/

# E2E Flow (24 tests)
npm test -- e2e.test.js
```

## Run Specific Test Case

```bash
npm test -- --testNamePattern="JWT token creation"
```

## Watch Mode (Re-run on file change)

```bash
npm test -- --watch
```

## Test with Docker Services

```bash
# Start services
docker-compose up -d

# Run tests (will connect to running services)
npm test -- e2e.test.js

# Stop services
docker-compose down -v
```

## GitHub Actions (Automated)

### Runs Automatically On:
- Push to main or develop (unit + integration tests)
- Pull request to main (all tests)
- Daily at 2 AM UTC (E2E + security scan)

### View Results:
- Go to GitHub → Actions → Select workflow
- Click latest run to see test results
- Download artifacts (coverage, metrics, reports)

## Test Files Location

```
identity-provider/tests/
├── auth.test.js (13 tests)

order-gateway/tests/
├── validation.test.js (14 tests)
└── integration.test.js (51 tests)

stock-service/tests/
├── stockUtils.test.js (8 tests)
└── integration.test.js (53 tests)

Root:
├── e2e.test.js (24 tests)

GitHub Actions:
.github/workflows/
├── unit-tests.yml
├── integration-tests.yml
└── e2e-tests.yml
```

## Test Summary

| Layer | Count | Duration | Coverage |
|-------|-------|----------|----------|
| Unit | 35 | 5s | 85% |
| Integration | 104 | 45s | 88% |
| E2E | 24 | 120s | 80% |
| **Total** | **163** | **~2.5 min** | **~80%** |

## Troubleshooting

**Tests hang/timeout**
```bash
# Services must be running for E2E tests
docker-compose up -d
npm test -- e2e.test.js
```

**MongoDB connection error**
```bash
# Restart MongoDB
docker-compose restart mongodb
npm test
```

**Port already in use**
```bash
# Kill process using port (e.g., 3001)
lsof -ti :3001 | xargs kill -9
docker-compose up -d
```

## Key Test Locations

📖 Full testing guide: [TESTING_GUIDE.md](TESTING_GUIDE.md)  
📊 Implementation summary: [TESTING_IMPLEMENTATION_SUMMARY.md](TESTING_IMPLEMENTATION_SUMMARY.md)  
✅ Updated requirements: [RequirementAnalysis.md](RequirementAnalysis.md)
