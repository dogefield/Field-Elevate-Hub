# Field Elevate Production Deployment Checklist

## Pre-Deployment

### Infrastructure
- [ ] All Docker images built and tested
- [ ] Database migrations completed
- [ ] Redis cluster configured
- [ ] SSL certificates installed
- [ ] Load balancers configured
- [ ] Backup systems tested

### Security
- [ ] All API keys rotated
- [ ] Firewall rules configured
- [ ] VPN access tested
- [ ] Audit logging enabled
- [ ] Encryption at rest verified
- [ ] Rate limiting configured

### Monitoring
- [ ] Prometheus targets configured
- [ ] Grafana dashboards imported
- [ ] Alert rules activated
- [ ] PagerDuty integration tested
- [ ] Log aggregation working

## Deployment Steps

### 1. Database Preparation
```bash
# Backup existing data
npm run db:backup

# Run migrations
npm run db:migrate:production

# Verify integrity
npm run db:verify
```

### 2. Deploy Infrastructure Services

```bash
# Deploy in order
docker-compose -f docker-compose.prod.yml up -d postgres redis
sleep 30
docker-compose -f docker-compose.prod.yml up -d mcp-hub
sleep 10
```

### 3. Deploy Application Services

```bash
# Deploy core services
for service in data-hub signal-forge risk-analyzer; do
  docker-compose -f docker-compose.prod.yml up -d $service
  sleep 10
  ./scripts/health-check.sh $service
done

# Deploy execution services
docker-compose -f docker-compose.prod.yml up -d trade-runner
./scripts/verify-trading-disabled.sh

# Deploy UI services
for service in investor-portal bot-concierge ops-console; do
  docker-compose -f docker-compose.prod.yml up -d $service
  sleep 5
done

# Deploy AI services
docker-compose -f docker-compose.prod.yml up -d ai-coo
```

### 4. Verification

```bash
# Run system tests
npm run test:system

# Verify all health endpoints
./scripts/health-check-all.sh

# Test critical paths
npm run test:critical-paths
```

### 5. Enable Trading

```bash
# Only after all verifications pass
./scripts/enable-trading.sh --confirm
```

## Post-Deployment

### Monitoring

- [ ] All services showing healthy
- [ ] No critical alerts firing
- [ ] Performance metrics normal
- [ ] Error rates < 0.1%

### Validation

- [ ] Execute test trade
- [ ] Verify reporting works
- [ ] Test emergency stop
- [ ] Confirm backups running

### Documentation

- [ ] Update runbooks
- [ ] Document any issues
- [ ] Update architecture diagram
- [ ] Notify team of completion

## Rollback Plan

If any issues occur:

1. **Immediate**: Stop all trading
   
   ```bash
   ./scripts/emergency-stop.sh
   ```
1. **Assessment**: Check error logs
   
   ```bash
   ./scripts/diagnose-issues.sh
   ```
1. **Rollback**: If necessary
   
   ```bash
   ./scripts/rollback-deployment.sh
   ```
1. **Restore**: From backup
   
   ```bash
   npm run db:restore
   ```

## Emergency Contacts

- **On-Call Engineer**: [Phone]
- **CTO**: [Phone]
- **DevOps Lead**: [Phone]
- **Database Admin**: [Phone]

## Sign-offs

- [ ] Engineering Lead: _________________ Date: _______
- [ ] Risk Manager: ___________________ Date: _______
- [ ] CTO: __________________________ Date: _______
