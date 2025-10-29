# HogFlix Dynamic Synthetic Traffic System

> **Comprehensive simulation of realistic user lifecycles, engagement patterns, and site-wide interactions**

This document describes the **fully dynamic** synthetic traffic system that simulates ~400 users with realistic lifecycles, irregular return patterns, FlixBuddy interactions, and natural churn/signup dynamics.

## 📋 Quick Overview

### What's Simulated

✅ **User Lifecycles**: NEW → ACTIVE → CASUAL → DORMANT → CHURNED  
✅ **Activity Patterns**: DAILY, REGULAR, WEEKEND, BINGE, MONTHLY  
✅ **Dynamic Returns**: Irregular visit patterns based on user type  
✅ **Life Events**: Vacations, sick days, busy periods, hype periods  
✅ **New Signups**: 2-5 new users daily, replacing churned users  
✅ **Churn Management**: Natural attrition with database cleanup  
✅ **FlixBuddy Chats**: 10% of active users engage with AI assistant  
✅ **Watch Behavior**: Variable session depths, completion rates  
✅ **Engagement Actions**: Ratings, watchlist, support tickets  
✅ **Streaks & Habits**: Bonus engagement for consistent users  

### Key Features

- **~400 active users** (fluctuates naturally 380-420)
- **2-5 new signups per day** (replacing churned users)
- **30-150 active sessions per day** (varies by day of week)
- **8-12 FlixBuddy interactions per day** (rate limited to 50/run)

## Usage

### Run Locally (Full Database Mode)
```bash
export PH_PROJECT_API_KEY=your_key
export SUPABASE_SERVICE_ROLE_KEY=your_service_key
export SUPABASE_URL=https://kawxtrzyllgzmmwfddil.supabase.co
node scripts/synthetic-traffic.js
```

### Automated via GitHub Actions
- Runs every 30 minutes + daily at 07:15 UTC
- See `.github/workflows/synthetic.yml`
- Personas persist via GitHub Actions cache

## System Architecture

The system maintains realistic user populations through:
1. **Lifecycle management** - users progress through states naturally
2. **Pattern-based returns** - 5 different activity patterns with unique behaviors
3. **Life events** - random events affecting engagement temporarily
4. **Churn & replacement** - old users leave, new users join daily
5. **Full-site engagement** - video watching, ratings, watchlist, FlixBuddy, support tickets

For full documentation, see the complete guide below.

---

[Rest of existing documentation continues...]
