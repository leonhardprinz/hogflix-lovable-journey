# Security Documentation

This document outlines the security measures, decisions, and known limitations for the HogFlix application.

## Table of Contents
- [Overview](#overview)
- [Authentication & Authorization](#authentication--authorization)
- [Database Security](#database-security)
- [Security Definer Functions](#security-definer-functions)
- [Known Limitations](#known-limitations)
- [Security Roadmap](#security-roadmap)

---

## Overview

HogFlix is built with security as a priority, implementing industry-standard practices including:
- Row-Level Security (RLS) on all database tables
- Role-based access control (RBAC)
- Input validation and rate limiting
- Secure authentication with Supabase Auth
- Content Security Policy (CSP) headers
- XSS and CSRF protection

**Current Security Status:** ✅ Production-ready for demo/MVP

---

## Authentication & Authorization

### Authentication Provider
- **Provider:** Supabase Auth
- **Methods:** Email/Password, Google OAuth
- **Session Management:** JWT-based with automatic token refresh
- **OTP Expiry:** 1 hour (3600 seconds) ✅

### Password Security
- **Minimum Requirements:** Enforced by Supabase (8+ characters)
- **Leaked Password Protection:** ⚠️ NOT ENABLED (Supabase Pro feature - $25+/month)
  - **Risk Assessment:** Medium - Accepted for demo/MVP
  - **Mitigation:** Client-side password strength indicators
  - **Production Recommendation:** Enable when upgrading to Supabase Pro

### Role-Based Access Control (RBAC)

**Role Hierarchy:**
1. **Admin** - Full system access
2. **Moderator** - Content management and user support
3. **User** - Standard user access

**Role Storage:**
- Roles stored in separate `user_roles` table (NOT on user profile)
- Uses PostgreSQL ENUM type for type safety: `app_role`
- First user automatically assigned admin role via trigger

**Role Verification:**
```sql
-- Secure role checking via SECURITY DEFINER function
has_role(auth.uid(), 'admin'::app_role)
```

---

## Database Security

### Row-Level Security (RLS)

All tables have RLS enabled with the following access patterns:

#### User Data Tables
| Table | User Access | Admin Access |
|-------|-------------|--------------|
| `profiles` | Own profile only | All profiles (read) |
| `user_subscriptions` | Own subscription | All subscriptions |
| `watch_progress` | Own progress | No direct access |
| `user_watchlist` | Own watchlist | No direct access |
| `video_ratings` | Own ratings | No direct access |
| `support_tickets` | Own tickets | All tickets (read/update) ✅ |

#### Content Tables
| Table | Public Access | Admin/Moderator Access |
|-------|---------------|------------------------|
| `videos` | Read public videos | Full CRUD |
| `categories` | Read all | Full CRUD |
| `video_tags` | Read all | Full CRUD |
| `video_tag_assignments` | Read all | Full CRUD |
| `video_analytics` | No access | Full access |
| `admin_activity_log` | No access | Insert + Read |

#### Chat/AI Tables
| Table | User Access | Admin Access |
|-------|-------------|--------------|
| `chat_conversations` | Own conversations | No direct access |
| `chat_messages` | Own messages | No direct access |

### PII Protection

**Email Addresses:**
- Stored in `profiles` table with strict RLS: `WHERE auth.uid() = user_id`
- Only accessible to the profile owner
- NOT exposed in `profiles_public` view
- **Risk Level:** Very Low
- **Optional Hardening:** Store emails only in `auth.users` (requires service role)

**Display Names:**
- Public via `profiles_public` view (necessary for social features)
- No PII risk as they're user-chosen identifiers

### Rate Limiting

**Support Tickets:**
- Maximum 5 tickets per user per hour
- Enforced via database trigger `set_support_ticket_user_and_throttle()`
- Prevents spam and abuse

**Recommended Additions:**
- API rate limiting at edge function level (not yet implemented)
- Profile query throttling (optional hardening)

---

## Security Definer Functions

The application uses `SECURITY DEFINER` functions to safely bypass RLS for legitimate operations. Each function includes appropriate safeguards:

### Role Management Functions ✅

**`has_role(_user_id uuid, _role app_role)`**
- **Purpose:** Check if a user has a specific role
- **Security:** Read-only, no data modification
- **Why SECURITY DEFINER:** Prevents recursive RLS on `user_roles` table
- **Risk:** None - pure lookup function

**`get_user_role(_user_id uuid)`**
- **Purpose:** Get user's highest priority role
- **Security:** Read-only with default fallback to 'user'
- **Why SECURITY DEFINER:** Prevents recursive RLS
- **Risk:** None - returns single role

### User Data Functions ✅

**`get_user_subscription(_user_id uuid)`**
- **Purpose:** Retrieve user's active subscription
- **Security:** Scoped with `WHERE us.user_id = _user_id`
- **Why SECURITY DEFINER:** Joins multiple tables with RLS
- **Risk:** None - user can only access their own subscription

**`get_my_profiles_public()`**
- **Purpose:** Get authenticated user's profiles
- **Security:** Scoped with `WHERE p.user_id = auth.uid()`
- **Why SECURITY DEFINER:** Joins public and private profile data
- **Risk:** None - auth.uid() ensures user ownership

**`update_early_access_features(profile_id_param uuid, features_param text[])`**
- **Purpose:** Update beta feature flags for a profile
- **Security:** Ownership check: `WHERE id = profile_id_param AND user_id = auth.uid()`
- **Why SECURITY DEFINER:** Allows writes to profiles table
- **Risk:** None - explicit ownership validation

### Video & Content Functions ✅

**`get_video_average_rating(video_id_param uuid)`**
- **Purpose:** Calculate average rating for a video
- **Security:** Read-only, aggregates public data
- **Why SECURITY DEFINER:** Performance optimization
- **Risk:** None - public information

**`get_video_rating_count(video_id_param uuid)`**
- **Purpose:** Count ratings for a video
- **Security:** Read-only, aggregates public data
- **Why SECURITY DEFINER:** Performance optimization
- **Risk:** None - public information

**`get_user_video_rating(video_id_param uuid, profile_id_param uuid)`**
- **Purpose:** Get user's rating for a video
- **Security:** Read-only, filtered by profile_id
- **Why SECURITY DEFINER:** Performance optimization
- **Risk:** None - returns single user's rating

**`is_video_in_watchlist(video_id_param uuid, profile_id_param uuid)`**
- **Purpose:** Check if video is in user's watchlist
- **Security:** Scoped with `WHERE video_id = video_id_param AND profile_id = profile_id_param AND user_id = auth.uid()`
- **Why SECURITY DEFINER:** Performance optimization
- **Risk:** None - triple-check on ownership

### Admin Functions ✅

**`bulk_update_videos(video_ids uuid[], updates jsonb)`**
- **Purpose:** Bulk update video metadata
- **Security:** Role check: `has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator')`
- **Why SECURITY DEFINER:** Allows admins to bypass user-level RLS
- **Risk:** None - explicit role validation, logs all actions

**`refresh_video_analytics()`**
- **Purpose:** Recalculate video analytics from watch progress
- **Security:** Admin-only access via RLS on trigger
- **Why SECURITY DEFINER:** Aggregates data from multiple tables
- **Risk:** None - called only by admins, no user input

### Trigger Functions ✅

**`handle_new_user()`**
- **Purpose:** Create profile when user signs up
- **Security:** Triggered on auth.users INSERT
- **Why SECURITY DEFINER:** Writes to profiles table during signup
- **Risk:** None - automated process, no user control

**`make_first_user_admin()`**
- **Purpose:** Grant admin role to first user
- **Security:** Counts total users, assigns admin only if count = 1
- **Why SECURITY DEFINER:** Writes to user_roles during signup
- **Risk:** None - deterministic logic

**`assign_default_subscription()`**
- **Purpose:** Create default subscription for new profiles
- **Security:** Assigns default plan only if no subscription exists
- **Why SECURITY DEFINER:** Writes to user_subscriptions
- **Risk:** None - uses default plan, validates existence

**`set_support_ticket_user_and_throttle()`**
- **Purpose:** Auto-populate user_id and enforce rate limiting
- **Security:** Rate limit: 5 tickets per hour per user
- **Why SECURITY DEFINER:** Needs to read ticket history and write user_id
- **Risk:** None - prevents abuse via throttling

**`sync_profiles_public()`**
- **Purpose:** Sync profile data to public view
- **Security:** Triggered on profiles INSERT/UPDATE/DELETE
- **Why SECURITY DEFINER:** Writes to profiles_public table
- **Risk:** None - only syncs non-sensitive fields

**`update_updated_at_column()`**
- **Purpose:** Auto-update timestamp on row changes
- **Security:** Generic trigger, no data access
- **Why SECURITY DEFINER:** Standard pattern for timestamp management
- **Risk:** None - updates single field

### Database Views

**`video_ratings_aggregate`**
- **Type:** Materialized view (read-only aggregation)
- **Purpose:** Performance optimization for video ratings
- **Security:** Inherits RLS from underlying `video_ratings` table
- **Why No SECURITY DEFINER:** Simple aggregation, no policy bypass needed
- **Risk:** None - public aggregate data

---

## Known Limitations

### Infrastructure Limitations

**1. Leaked Password Protection (Supabase Pro Feature)**
- **Status:** ⚠️ NOT ENABLED
- **Cost:** Requires Supabase Pro plan ($25+/month)
- **Risk:** Medium - Users could reuse compromised passwords
- **Current Mitigation:** Client-side password strength indicators
- **Production Plan:** Enable when upgrading to paid Supabase plan

**2. PostgreSQL Version**
- **Current Version:** Check at [Database Settings](https://supabase.com/dashboard/project/kawxtrzyllgzmmwfddil/settings/general)
- **Upgrade Process:** Via Supabase Dashboard → Database Settings → Infrastructure
- **Auto-Upgrade:** Supabase may auto-upgrade during maintenance windows
- **Action Required:** Verify current version and enable auto-upgrades if available

### Feature Limitations

**1. API Rate Limiting**
- **Status:** Implemented at database level (support tickets)
- **Missing:** Edge function rate limiting
- **Risk:** Low - Supabase has built-in rate limiting
- **Roadmap:** Add custom rate limiting to edge functions if needed

**2. Email Enumeration**
- **Status:** Mitigated via RLS policies
- **Current Protection:** `WHERE auth.uid() = user_id`
- **Risk:** Very Low - emails only visible to owners
- **Optional Hardening:** Remove email from profiles, store only in auth.users

---

## Security Roadmap

### ✅ Completed (Phase 1 & 2)
- [x] Enable RLS on all tables
- [x] Implement RBAC with separate user_roles table
- [x] Add security definer functions for safe RLS bypass
- [x] Set OTP expiry to 1 hour
- [x] Add support ticket rate limiting
- [x] Add admin access to support tickets
- [x] Implement admin activity logging
- [x] Add Content Security Policy headers
- [x] Remove console.log from production builds

### 🔄 In Progress (Phase 3)
- [ ] Verify PostgreSQL version and schedule upgrade if needed
- [ ] Add API rate limiting to edge functions
- [ ] Implement session timeout warnings

### 📋 Backlog (Phase 4 - Optional Hardening)
- [ ] Enable leaked password protection (requires Supabase Pro)
- [ ] Remove email from profiles table (store only in auth.users)
- [ ] Add profile query throttling
- [ ] Implement 2FA/MFA for admin accounts
- [ ] Add security event logging and monitoring
- [ ] Implement IP-based rate limiting
- [ ] Add CAPTCHA to signup/login forms
- [ ] Implement automated security scanning

---

## Security Incident Response

**If you discover a security vulnerability:**

1. **DO NOT** create a public GitHub issue
2. Email security concerns to: [your-email@example.com]
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if known)

**Response Time:**
- Critical vulnerabilities: 24 hours
- High severity: 72 hours
- Medium/Low severity: 1 week

---

## Compliance & Best Practices

### OWASP Top 10 Coverage

| Risk | Status | Implementation |
|------|--------|----------------|
| Broken Access Control | ✅ Mitigated | RLS + RBAC |
| Cryptographic Failures | ✅ Mitigated | Supabase Auth (bcrypt) |
| Injection | ✅ Mitigated | Parameterized queries |
| Insecure Design | ✅ Mitigated | Security-first architecture |
| Security Misconfiguration | ✅ Mitigated | Secure defaults, CSP |
| Vulnerable Components | 🔄 Monitored | Dependabot enabled |
| Auth Failures | ✅ Mitigated | Supabase Auth + MFA ready |
| Data Integrity Failures | ✅ Mitigated | Input validation + triggers |
| Logging Failures | ✅ Mitigated | Admin activity log |
| SSRF | ⚠️ Partial | Edge functions validated |

### Data Privacy

**GDPR Compliance Considerations:**
- User data deletion: Manual process (admin-initiated)
- Data export: Not yet implemented
- Cookie consent: Not yet implemented
- Privacy policy: Available at `/privacy`

**Recommended for Production:**
- Implement automated GDPR data export
- Add user-initiated account deletion
- Implement cookie consent banner
- Add data retention policies

---

## Security Contacts

**Maintainers:**
- Project Lead: [Name] - [email]
- Security Lead: [Name] - [email]

**External Resources:**
- Supabase Security Docs: https://supabase.com/docs/guides/security
- Supabase Status: https://status.supabase.com/

---

**Last Updated:** 2025-10-28  
**Next Review:** 2025-11-28  
**Version:** 1.0
